import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BriefSchema, type Brief } from "../schemas/brief.ts";
import { DirectorOutputSchema, StoryboardSchema, type Storyboard } from "../schemas/storyboard.ts";
import { EngineError } from "../utils/errors.ts";
import { loadFacts } from "./facts.ts";
import { claudeCli, extractJson, type LlmFn, type LlmUsage } from "./llm.ts";
import { lintStoryboard, worstCode, type LintIssue } from "./lint.ts";
import { buildPrompt, SYSTEM_PROMPT, type DirectorConfig } from "./prompt.ts";

export { lintStoryboard } from "./lint.ts";
export { parseFacts, loadFacts } from "./facts.ts";
export { claudeCli, extractJson } from "./llm.ts";
export type { LlmFn } from "./llm.ts";

export interface DirectOptions {
  /** Prompt libero in italiano. */
  prompt: string;
  /** Cartella di uscita, o funzione dello slug del brief. Se manca non scrive nulla. */
  outDir?: string | ((brief: Brief) => string);
  /** Dove scrivere gap-report.md e director.error.json quando non c'è ancora uno slug (outDir è una funzione). */
  failDir?: string;
  /** Radice del repository (contiene brand/ ed engine/). Default: due livelli sopra questo file. */
  root?: string;
  /** Vincoli fissati dall'utente (flag CLI): il brief deve rispettarli. */
  expect?: { durationSec?: number; format?: Brief["format"] };
  /** Chiamata al modello; default `claude -p` in sola lettura. */
  llm?: LlmFn;
  /** Tetto di chiamate (default: engine.config.json `maxCalls`). */
  maxCalls?: number;
}

export interface DirectResult {
  brief: Brief;
  storyboard: Storyboard;
  warnings: string[];
  usage: LlmUsage;
  files: string[];
}

const DEFAULT_ROOT = path.resolve(import.meta.dirname, "..", "..");

export const sha256 = (s: string) => "sha256:" + createHash("sha256").update(s).digest("hex");

interface EngineConfig extends DirectorConfig {
  schemaRetries: number;
  maxCalls: number;
}

function loadConfig(root: string): EngineConfig {
  return JSON.parse(readFileSync(path.join(root, "engine", "engine.config.json"), "utf8"));
}

function gapReport(prompt: string, gap: { reason: string; missing: string[] }): string {
  return [
    "# Gap report",
    "",
    `**Richiesta:** ${prompt}`,
    "",
    `**Perché non si può fare con il catalogo e PRODOTTO_FATTI:** ${gap.reason}`,
    "",
    ...(gap.missing.length ? ["**Cosa manca:**", ...gap.missing.map((m) => `- ${m}`), ""] : []),
    "Il regista non improvvisa: serve una nuova scena o un fatto verificato in `brand/`.",
    "",
  ].join("\n");
}

/**
 * Regista: prompt libero -> brief.json + storyboard.json, validati con zod e col lint deterministico.
 * Una chiamata al modello; se la risposta non è valida la rifà con gli errori, fino a `schemaRetries` volte (2).
 */
export async function direct(opts: DirectOptions): Promise<DirectResult> {
  const root = opts.root ?? DEFAULT_ROOT;
  const config = loadConfig(root);
  const { md, facts } = loadFacts(path.join(root, "brand", "PRODOTTO_FATTI.md"));
  const usage: LlmUsage = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const llm =
    opts.llm ??
    claudeCli({
      cwd: root,
      onUsage: (u) => {
        usage.inputTokens += u.inputTokens ?? 0;
        usage.outputTokens += u.outputTokens ?? 0;
        usage.costUsd += u.costUsd ?? 0;
      },
    });
  const maxCalls = opts.maxCalls ?? config.maxCalls;
  const attempts = 1 + config.schemaRetries;
  const size = (f: string) => config.formats[f]!;

  let retry: { previous: string; issues: (LintIssue | string)[] } | undefined;
  let lastIssues: (LintIssue | string)[] = [];
  let lastRaw = "";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (usage.calls >= maxCalls) throw new EngineError("E_BUDGET", `Chiamate: ${usage.calls}/${maxCalls}.`);
    usage.calls++;
    const raw = await llm({ system: SYSTEM_PROMPT, prompt: buildPrompt({ prompt: opts.prompt, factsMd: md, facts, config, expect: opts.expect, retry }) });
    lastRaw = raw;

    const issues: (LintIssue | string)[] = [];
    let result: DirectResult | undefined;
    try {
      const out = DirectorOutputSchema.safeParse(extractJson(raw));
      if (!out.success) {
        issues.push(...out.error.issues.map((x) => `JSON non valido — ${x.path.join(".") || "(radice)"}: ${x.message}`));
      } else if ("gap" in out.data) {
        const gap = out.data.gap;
        writeOut(opts, root, undefined, { "gap-report.md": gapReport(opts.prompt, gap) });
        throw new EngineError("E_GAP", gap.reason);
      } else {
        const b = out.data.brief;
        const brief = BriefSchema.parse({ version: 1, prompt: opts.prompt, ...b, size: { w: size(b.format).w, h: size(b.format).h }, fps: size(b.format).fps });
        const storyboard = StoryboardSchema.parse({
          version: 1,
          briefHash: sha256(JSON.stringify(brief, null, 2)),
          format: brief.format,
          size: brief.size,
          fps: brief.fps,
          durationSec: brief.durationSec,
          ...out.data.storyboard,
        });
        const lint = lintStoryboard({ brief, storyboard, facts, expect: opts.expect });
        if (lint.errors.length) issues.push(...lint.errors);
        else result = { brief, storyboard, warnings: lint.warnings, usage, files: [] };
      }
    } catch (e) {
      if (e instanceof EngineError) throw e;
      issues.push(`JSON non valido — ${(e as Error).message}`);
    }

    if (result) {
      result.files = writeOut(opts, root, result, {
        "brief.json": JSON.stringify(result.brief, null, 2) + "\n",
        "storyboard.json": JSON.stringify(result.storyboard, null, 2) + "\n",
        "storyboard.lint.json": JSON.stringify({ errors: [], warnings: result.warnings, attempts: attempt }, null, 2) + "\n",
      });
      return result;
    }
    lastIssues = issues;
    retry = { previous: raw, issues };
  }

  const structured = lastIssues.filter((x): x is LintIssue => typeof x !== "string");
  const code = structured.length === lastIssues.length ? worstCode(structured) : "E_SCHEMA";
  const detail = lastIssues.map((x) => `- ${typeof x === "string" ? x : x.msg}`).join("\n");
  writeOut(opts, root, undefined, { "director.error.json": JSON.stringify({ code, attempts, issues: lastIssues, lastResponse: lastRaw }, null, 2) + "\n" });
  throw new EngineError(code, `Dopo ${attempts} tentativi:\n${detail}`);
}

function writeOut(opts: DirectOptions, _root: string, done: DirectResult | undefined, files: Record<string, string>): string[] {
  if (!opts.outDir) return [];
  let dir: string;
  if (typeof opts.outDir === "function") {
    if (!done && !opts.failDir) return []; // senza brief non c'è lo slug: niente cartella
    dir = done ? opts.outDir(done.brief) : opts.failDir!;
  } else dir = opts.outDir;
  mkdirSync(dir, { recursive: true });
  return Object.entries(files).map(([name, body]) => {
    const f = path.join(dir, name);
    writeFileSync(f, body);
    return f;
  });
}
