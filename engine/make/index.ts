import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { direct as directDefault, lintStoryboard, loadFacts, sha256 } from "../director/index.ts";
import { claudeCli, type ClaudeCliOptions, type LlmFn } from "../director/llm.ts";
import { runQa as runQaDefault, type QaReport } from "../qa/index.ts";
import { PLACEHOLDER, renderStoryboard as renderDefault, verifyProbe } from "../render/index.ts";
import { probe } from "../render/probe.ts";
import { BriefSchema, type Brief } from "../schemas/brief.ts";
import { StoryboardSchema, type Storyboard } from "../schemas/storyboard.ts";
import { ROOT } from "../theme/tokens.ts";
import { EngineError, ERRORS, HINTS, type ErrorCode } from "../utils/errors.ts";
import { run } from "../utils/proc.ts";
import { formatPlan } from "./plan.ts";

export { formatPlan } from "./plan.ts";

export type StageStatus = "start" | "done" | "skip" | "fail";
export interface MakeEvent {
  stage: string;
  status: StageStatus;
  outDir?: string;
}

export interface MakeOptions {
  /** Prompt libero in italiano (assente solo con `resume`). */
  prompt?: string;
  /** Cartella `out/<slug>` da riprendere: salta ciò che è già fatto e coerente. */
  resume?: string;
  format?: Brief["format"];
  durationSec?: number;
  /** Si ferma allo storyboard e mostra il piano. */
  preview?: boolean;
  /** Approvazione manuale (dopo aver letto il piano). */
  approve?: boolean;
  /** Tetto in dollari del costo stimato (`total_cost_usd` di `claude -p`; col piano a forfait è una stima). */
  maxCost?: number;
  maxRounds?: number;
  maxCalls?: number;
  workers?: number;
  /** Radice del repository e cartella `out/` (per i test). */
  root?: string;
  outRoot?: string;
  /** Riga di comando originale, scritta nel manifest. */
  command?: string;
  say?: (msg: string) => void;
  onEvent?: (e: MakeEvent) => void;
  /** Sostituibili nei test. */
  cliFactory?: (o: ClaudeCliOptions) => LlmFn;
  stages?: { direct?: typeof directDefault; render?: typeof renderDefault; qa?: typeof runQaDefault };
  /** Attese tra i tentativi quando `claude` non risponde (ms). Default 4 s e 12 s. */
  retryDelaysMs?: number[];
}

export interface Approval {
  version: 1;
  by: "user" | "auto";
  at: string;
  storyboardHash: string;
  briefHash: string;
  /** Hash approvato in origine, se la QA ha poi corretto lo storyboard. */
  approvedStoryboardHash?: string;
  revisedByQa?: boolean;
}

export interface MakeResult {
  /** `planned` = fermo al piano; `delivered` = video verificato; `draft` = consegnato come bozza (segnaposto). */
  status: "planned" | "delivered" | "draft";
  outDir: string;
  slug: string;
  brief: Brief;
  storyboard: Storyboard;
  plan: string;
  approval: Approval | null;
  videoFile: string | null;
  qa: QaReport | null;
  files: string[];
  cost: { usd: number; llmCalls: number };
  elapsedSec: number;
  warnings: string[];
}

interface Config {
  autoApprove: boolean;
  maxCalls: number;
  maxRounds: number;
  maxWallMinutes: number;
  durationSec: { min: number; max: number };
}

interface Meter {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
}

/** File di una corsa precedente nella stessa cartella: da togliere, altrimenti si mescolerebbero con quelli nuovi. */
const STALE = ["manifest.json", "qa-report.json", "approval.json", "error.json", "run.log", "preview.mp4", "video.mp4", "video-DRAFT.mp4", "qa", path.join(".work", "FAILED-QA.mp4"), path.join(".work", "UNVERIFIED.mp4")];
const VIDEOS = ["video.mp4", "video-DRAFT.mp4"];

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readJson<T = Record<string, any>>(file: string): T | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function loadConfig(root: string): Config {
  return JSON.parse(readFileSync(path.join(root, "engine", "engine.config.json"), "utf8"));
}

/** Controlli sui limiti, uguali per CLI e uso da codice. */
export function validateOptions(o: MakeOptions, cfg: Config): void {
  const bad = (m: string) => {
    throw new EngineError("E_USAGE", m);
  };
  if (!o.prompt?.trim() && !o.resume) bad("Manca il prompt (o --resume con la cartella da riprendere).");
  if (o.prompt && o.resume) bad("Usa il prompt oppure --resume, non entrambi.");
  if (o.durationSec !== undefined && (o.durationSec < cfg.durationSec.min || o.durationSec > cfg.durationSec.max))
    bad(`La durata deve stare tra ${cfg.durationSec.min} e ${cfg.durationSec.max} secondi, ricevuto ${o.durationSec}.`);
  if (o.maxCost !== undefined && !(o.maxCost > 0)) bad(`--max-cost deve essere un numero positivo, ricevuto ${o.maxCost}.`);
  if (o.maxRounds !== undefined && !(Number.isInteger(o.maxRounds) && o.maxRounds >= 0)) bad(`--max-rounds deve essere un intero >= 0, ricevuto ${o.maxRounds}.`);
  if (o.maxCalls !== undefined && !(Number.isInteger(o.maxCalls) && o.maxCalls >= 1)) bad(`--max-calls deve essere un intero >= 1, ricevuto ${o.maxCalls}.`);
}

/** Registro strutturato `run.log` (una riga JSON per evento): da lì si ricavano tempi e costi di tutte le corse. */
class RunLog {
  private file: string | undefined;
  private buffer: string[] = [];
  attach(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, "run.log");
    if (this.buffer.length) {
      try {
        appendFileSync(this.file, this.buffer.join(""));
        this.buffer = [];
      } catch {
        /* resta nel buffer */
      }
    }
  }
  add(e: Record<string, unknown>) {
    const line = JSON.stringify({ t: new Date().toISOString(), ...e }) + "\n";
    if (this.file) {
      try {
        appendFileSync(this.file, line);
      } catch {
        this.buffer.push(line); // file bloccato (antivirus, indicizzatore): il registro non deve far cadere il video
      }
    } else this.buffer.push(line);
  }
  /** Scrive il registro in una cartella che non è (ancora) quella del video, ad esempio per un errore del regista. */
  dump(dir: string) {
    if (!this.buffer.length) return;
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, "run.log"), this.buffer.join(""));
  }
  static read(dir: string): Record<string, any>[] { // eslint-disable-line @typescript-eslint/no-explicit-any
    const f = path.join(dir, "run.log");
    if (!existsSync(f)) return [];
    return readFileSync(f, "utf8").split("\n").filter(Boolean).flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
  }
}

/** Chiamate a Claude con tetto di chiamate e di costo, e due nuovi tentativi se `claude` non risponde. */
function budgeted(meter: Meter, limits: { maxCalls: number; maxCost?: number }, cli: LlmFn, delays: number[]): LlmFn {
  return async (req) => {
    for (let attempt = 0; ; attempt++) {
      if (meter.calls >= limits.maxCalls) throw new EngineError("E_BUDGET", `Chiamate al modello: ${meter.calls}/${limits.maxCalls}.`);
      if (limits.maxCost !== undefined && meter.usd >= limits.maxCost)
        throw new EngineError("E_BUDGET", `Costo stimato $${meter.usd.toFixed(2)} oltre il tetto di $${limits.maxCost} (--max-cost).`);
      meter.calls++;
      try {
        return await cli(req);
      } catch (e) {
        const retry = e instanceof EngineError && e.code === "E_LLM_UNAVAILABLE" && !/Timeout/i.test(e.message) && attempt < delays.length;
        if (!retry) throw e;
        await sleep(delays[attempt]!);
      }
    }
  };
}

function resetRunFiles(dir: string) {
  for (const f of STALE) rmSync(path.join(dir, f), { recursive: true, force: true });
}

function moveAside(outDir: string, reason: string): void {
  const mf = path.join(outDir, "manifest.json");
  const m = readJson(mf);
  for (const name of VIDEOS) {
    const f = path.join(outDir, name);
    if (!existsSync(f)) continue;
    const to = path.join(outDir, ".work", "UNVERIFIED.mp4");
    mkdirSync(path.dirname(to), { recursive: true });
    rmSync(to, { force: true });
    renameSync(f, to);
    if (m) {
      m.quarantine = { from: name, reason, wasStatus: m.status };
      m.status = "failed";
    }
  }
  if (m) writeFileSync(mf, JSON.stringify(m, null, 2) + "\n");
}

function parseBrief(dir: string): Brief {
  const f = path.join(dir, "brief.json");
  const j = readJson(f);
  const p = j ? BriefSchema.safeParse(j) : null;
  if (!p) throw new EngineError("E_SCHEMA", `Manca ${f}: la cartella non contiene un video da riprendere (usa prima \`make "<prompt>"\`).`);
  if (!p.success) throw new EngineError("E_SCHEMA", `${f}: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return p.data;
}

function parseStoryboard(dir: string): { sb: Storyboard; text: string } {
  const f = path.join(dir, "storyboard.json");
  if (!existsSync(f)) throw new EngineError("E_SCHEMA", `Manca ${f}.`);
  const text = readFileSync(f, "utf8");
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch (e) {
    throw new EngineError("E_SCHEMA", `${f} non è un JSON valido: ${(e as Error).message}`);
  }
  const p = StoryboardSchema.safeParse(j);
  if (!p.success) throw new EngineError("E_SCHEMA", `${f}: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return { sb: p.data, text };
}

const placeholdersOf = (sb: Storyboard) => [...new Set(JSON.stringify(sb.shots.map((s) => s.props)).match(new RegExp(PLACEHOLDER.source, "g")) ?? [])];

/**
 * brief → storyboard → (piano) → approvazione → render → audio → QA → consegna in `out/<slug>/`.
 * Ogni stadio è ripetibile: con `resume` si riparte da ciò che manca. Non c'è successo senza MP4 verificato con ffprobe.
 */
export async function make(opts: MakeOptions): Promise<MakeResult> {
  const t0 = Date.now();
  const root = opts.root ?? ROOT;
  const cfg = loadConfig(root);
  validateOptions(opts, cfg);
  const outRoot = opts.outRoot ?? path.join(root, "out");
  const say = opts.say ?? (() => {});
  const maxCalls = opts.maxCalls ?? cfg.maxCalls;
  const maxRounds = opts.maxRounds ?? cfg.maxRounds;
  const stagesFn = { direct: opts.stages?.direct ?? directDefault, render: opts.stages?.render ?? renderDefault, qa: opts.stages?.qa ?? runQaDefault };
  const cliFactory = opts.cliFactory ?? claudeCli;
  const delays = opts.retryDelaysMs ?? [4000, 12000];

  const meter: Meter = { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 };
  const onUsage: ClaudeCliOptions["onUsage"] = (u) => {
    meter.inputTokens += u.inputTokens ?? 0;
    meter.outputTokens += u.outputTokens ?? 0;
    meter.usd += u.costUsd ?? 0;
  };
  const limits = { maxCalls, maxCost: opts.maxCost };
  const log = new RunLog();
  let outDir: string | undefined = opts.resume ? path.resolve(opts.resume) : undefined;
  const failDir = path.join(outRoot, "_errori", new Date().toISOString().replace(/[:.]/g, "-"));
  let current = "avvio";
  let rendered = false;
  let delivered = false;
  const mark = { calls: 0, usd: 0, inputTokens: 0, outputTokens: 0 };

  const emit = (stage: string, status: StageStatus) => opts.onEvent?.({ stage, status, outDir });
  async function stage<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    current = name;
    log.add({ stage: name, status: "start" });
    emit(name, "start");
    const s = Date.now();
    try {
      const r = await fn();
      log.add({ stage: name, status: "done", sec: round((Date.now() - s) / 1000) });
      emit(name, "done");
      return r;
    } catch (e) {
      log.add({ stage: name, status: "fail", sec: round((Date.now() - s) / 1000), detail: (e as Error).message.slice(0, 500) });
      emit(name, "fail");
      throw e;
    } finally {
      const d = { calls: meter.calls - mark.calls, usd: meter.usd - mark.usd, inputTokens: meter.inputTokens - mark.inputTokens, outputTokens: meter.outputTokens - mark.outputTokens };
      if (d.calls > 0) log.add({ stage: name, status: "usage", ...d, usd: round(d.usd, 4) });
      Object.assign(mark, { calls: meter.calls, usd: meter.usd, inputTokens: meter.inputTokens, outputTokens: meter.outputTokens });
    }
  }
  const skip = (name: string, why: string) => {
    log.add({ stage: name, status: "skip", detail: why });
    emit(name, "skip");
    say(`  ${name}: già fatto (${why}), salto.`);
  };
  const wall = () => {
    if ((Date.now() - t0) / 60000 > cfg.maxWallMinutes) throw new EngineError("E_BUDGET", `Tempo totale oltre ${cfg.maxWallMinutes} minuti (maxWallMinutes).`);
  };

  log.add({ stage: "avvio", status: "start", command: opts.command ?? null });
  try {
    const { facts } = loadFacts(path.join(root, "brand", "PRODOTTO_FATTI.md"));
    let brief: Brief;
    let warnings: string[] = [];

    // ---- 1. brief + storyboard ----
    if (opts.resume) {
      brief = parseBrief(outDir!);
      const { sb } = parseStoryboard(outDir!);
      const lint = lintStoryboard({ brief, storyboard: sb, facts });
      if (lint.errors.length) throw new EngineError(lint.errors[0]!.code, `${outDir}/storyboard.json non passa più il lint:\n${lint.errors.map((x) => `- ${x.msg}`).join("\n")}`);
      warnings = lint.warnings;
      log.attach(outDir!);
      skip("regista", "brief.json e storyboard.json esistono");
      say(`Riprendo ${outDir}`);
    } else {
      say("Brief e storyboard: chiamo il regista…");
      const directorLlm = budgeted(meter, limits, cliFactory({ cwd: root, onUsage }), delays);
      const res = await stage("regista", () =>
        stagesFn.direct({
          prompt: opts.prompt!.trim(),
          root,
          expect: { durationSec: opts.durationSec, format: opts.format },
          llm: directorLlm,
          maxCalls,
          failDir,
          outDir: (b) => {
            outDir = path.join(outRoot, b.slug);
            if (existsSync(outDir) && (existsSync(path.join(outDir, "manifest.json")) || existsSync(path.join(outDir, "brief.json")))) {
              say(`  La cartella ${path.relative(root, outDir)} esiste già: i file della corsa precedente vengono sostituiti.`);
              resetRunFiles(outDir);
            }
            return outDir;
          },
        }),
      );
      brief = res.brief;
      warnings = res.warnings;
      if (!outDir) outDir = path.join(outRoot, brief.slug);
      log.attach(outDir);
    }
    const dir = outDir!;
    const { sb, text: sbText } = parseStoryboard(dir);
    const sbHash = sha256(sbText);
    const placeholders = placeholdersOf(sb);

    // ---- 2. piano e approvazione ----
    current = "approvazione";
    const blockers: string[] = [];
    if (warnings.length) blockers.push(`${warnings.length} avviso/i del lint dello storyboard`);
    if (brief.needsFromUser.length) blockers.push(`il brief chiede dati all'utente (${brief.needsFromUser.map((n) => n.field).join(", ")})`);
    if (placeholders.length) blockers.push(`restano segnaposto nelle props (${placeholders.join(", ")}): il video uscirebbe come bozza`);
    const plan = formatPlan(brief, sb, { warnings, blockers });
    say("\n" + plan + "\n");

    const shown = (d: string) => {
      const r = path.relative(root, d).split(path.sep).join("/");
      return r.startsWith("..") ? d : r;
    };
    const approvalFile = path.join(dir, "approval.json");
    const files = (...names: string[]) => names.map((n) => path.join(dir, n)).filter(existsSync);
    const result = (r: Partial<MakeResult>): MakeResult => ({
      status: "planned", outDir: dir, slug: brief.slug, brief, storyboard: sb, plan, approval: null, videoFile: null, qa: null,
      files: files("brief.json", "storyboard.json", "approval.json", "manifest.json", "qa-report.json", "run.log"),
      cost: { usd: round(meter.usd, 4), llmCalls: meter.calls }, elapsedSec: round((Date.now() - t0) / 1000), warnings, ...r,
    });

    if (opts.preview) {
      log.add({ stage: "approvazione", status: "done", detail: "fermo al piano (--preview)" });
      return result({});
    }

    let approval = readJson<Approval>(approvalFile);
    if (approval && approval.storyboardHash !== sbHash) approval = null;
    if (approval) {
      skip("approvazione", `già approvato da ${approval.by === "user" ? "te" : "approvazione automatica"}`);
    } else {
      let by: Approval["by"];
      if (opts.approve) by = "user";
      else if (cfg.autoApprove && !blockers.length) by = "auto";
      else
        throw new EngineError(
          "E_NOT_APPROVED",
          cfg.autoApprove
            ? `Approvazione automatica non consentita: ${blockers.join("; ")}.\nRileggi il piano qui sopra e, se va bene, riprendi con: npm run make -- --resume ${shown(dir)} --approve`
            : `Con autoApprove spento serve la tua approvazione: npm run make -- --resume ${shown(dir)} --approve`,
        );
      approval = { version: 1, by, at: new Date().toISOString(), storyboardHash: sbHash, briefHash: sb.briefHash };
      writeFileSync(approvalFile, JSON.stringify(approval, null, 2) + "\n");
      log.add({ stage: "approvazione", status: "done", by });
      say(`Storyboard approvato (${by === "user" ? "da te" : "automaticamente: lint pulito, nessun segnaposto"}).`);
    }

    // ---- 3. render + audio ----
    wall();
    const manifestFile = path.join(dir, "manifest.json");
    let m = readJson(manifestFile);
    const hasVideo = () => !!m?.output?.file && existsSync(path.join(dir, m.output.file));
    // La corsa precedente si è fermata dopo il render, prima della QA: il video c'è, era solo stato messo da parte.
    const aside = path.join(dir, ".work", "UNVERIFIED.mp4");
    if (m && m.storyboardHash === sbHash && !hasVideo() && existsSync(aside) && ["final", "draft"].includes(m.quarantine?.wasStatus)) {
      renameSync(aside, path.join(dir, m.output.file));
      m.status = m.quarantine.wasStatus;
      delete m.quarantine;
      writeFileSync(manifestFile, JSON.stringify(m, null, 2) + "\n");
    }
    rendered = true;
    if (m && m.storyboardHash === sbHash && m.status !== "failed" && hasVideo()) {
      skip("render", "video già renderizzato per questo storyboard");
    } else {
      say("Render e audio…");
      let last = "";
      await stage("render", () =>
        stagesFn.render({
          input: dir,
          workers: opts.workers,
          progress: (st, done, total) => {
            const key = `${st}${Math.floor((done / total) * 4)}`;
            if (key !== last && done > 0) {
              last = key;
              say(`  ${st}: ${done}/${total} fotogrammi`);
            }
          },
        }),
      );
      m = readJson(manifestFile);
    }
    if (!m?.output) throw new EngineError("E_ENCODE", "Il render non ha scritto manifest.json con il video.");
    const videoName: string = m.output.file;
    for (const w of m.warnings ?? []) say(`  attenzione: ${w}`);

    // ---- 4. QA ----
    wall();
    const qaDone = ["pass", "warn"].includes(m.qa?.verdict) && existsSync(path.join(dir, "qa-report.json"));
    let qa: QaReport | null = readJson<QaReport>(path.join(dir, "qa-report.json"));
    if (qaDone) skip("qa", `verdetto ${m.qa.verdict} già registrato`);
    else {
      const remaining = maxCalls - meter.calls;
      if (remaining <= 0) throw new EngineError("E_BUDGET", `Chiamate al modello: ${meter.calls}/${maxCalls}: non resta nulla per la revisione.`);
      say("QA: ffprobe, contact sheet, revisione…");
      const qaLlm = budgeted(meter, limits, cliFactory({ cwd: root, tools: ["Read"], addDirs: [dir], timeoutMs: 600000, onUsage }), delays);
      qa = (
        await stage("qa", () =>
          stagesFn.qa({ input: dir, root, maxRounds, maxCalls: remaining, workers: opts.workers, llm: qaLlm, progress: (s) => say(`  ${s}`) }),
        )
      ).report;
      m = readJson(manifestFile) ?? m;
    }

    // La QA può aver corretto lo storyboard: se è cambiato un testo serve una nuova approvazione.
    const after = parseStoryboard(dir);
    const afterHash = sha256(after.text);
    if (afterHash !== sbHash && approval.storyboardHash !== afterHash) {
      if (qa?.needsReapproval) {
        const lint = lintStoryboard({ brief, storyboard: after.sb, facts });
        const clean = !lint.errors.length && !lint.warnings.length && !placeholdersOf(after.sb).length;
        if (approval.by === "auto" && clean) {
          approval = { ...approval, at: new Date().toISOString(), storyboardHash: afterHash, approvedStoryboardHash: approval.approvedStoryboardHash ?? approval.storyboardHash, revisedByQa: true };
          say("La QA ha corretto dei testi a schermo: lint pulito, riapprovato in automatico.");
        } else {
          moveAside(dir, "la QA ha cambiato i testi a schermo: serve una nuova approvazione");
          throw new EngineError("E_NOT_APPROVED", `La QA ha corretto dei testi a schermo e ${approval.by === "user" ? "avevi approvato la versione precedente" : "il lint non è più pulito"}.\nRileggi ${path.join(dir, "storyboard.json")} (la versione prima della QA è in qa/storyboard.before-qa.json) e riprendi con: npm run make -- --resume ${shown(dir)} --approve`);
        }
      } else {
        approval = { ...approval, storyboardHash: afterHash, approvedStoryboardHash: approval.approvedStoryboardHash ?? approval.storyboardHash, revisedByQa: true };
      }
      writeFileSync(approvalFile, JSON.stringify(approval, null, 2) + "\n");
    }

    // ---- 5. verifica finale e consegna ----
    current = "consegna";
    const videoFile = path.join(dir, videoName);
    if (!existsSync(videoFile)) throw new EngineError("E_QA_BLOCKER", `Il video ${videoName} non c'è dopo la QA.`);
    const p = probe(videoFile);
    const bad = verifyProbe(p, after.sb, m!.audio?.mode !== "none");
    if (bad.length) {
      moveAside(dir, "ffprobe finale fallito");
      throw new EngineError("E_ENCODE", `ffprobe finale: ${bad.join("; ")}.`);
    }
    if (!existsSync(path.join(dir, "qa-report.json")) || !qa) throw new EngineError("E_QA_BLOCKER", "Manca qa-report.json: nessuna consegna senza QA.");

    const entries = RunLog.read(dir);
    const sec: Record<string, number> = {};
    const usage = { calls: 0, usd: 0, inputTokens: 0, outputTokens: 0 };
    for (const e of entries) {
      if (e.status === "done" && typeof e.sec === "number") sec[e.stage] = round((sec[e.stage] ?? 0) + e.sec);
      if (e.status === "usage") {
        usage.calls += e.calls ?? 0;
        usage.usd += e.usd ?? 0;
        usage.inputTokens += e.inputTokens ?? 0;
        usage.outputTokens += e.outputTokens ?? 0;
      }
    }
    const spent = entries.filter((e) => e.status === "done" && typeof e.sec === "number").reduce((a, e) => a + e.sec, 0);
    const cmds = [...new Set(entries.map((e) => e.command).filter((c): c is string => typeof c === "string"))];
    const claude = run("claude", ["--version"]);
    const final = readJson(manifestFile) ?? m!;
    const renderCommands: string[] = (final.commands ?? []).filter((c: string) => !c.startsWith("npm run make"));
    Object.assign(final, {
      durationSec: after.sb.durationSec,
      approval: { by: approval.by, at: approval.at, storyboardHash: approval.storyboardHash, ...(approval.revisedByQa ? { revisedByQa: true } : {}) },
      claimsUsed: [...new Set(after.sb.shots.flatMap((s) => s.onScreenText.flatMap((t) => (t.source.kind === "claim" ? [t.source.id] : []))))],
      cost: {
        usd: round(usage.usd, 4), estimated: true, llmCalls: usage.calls, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        maxUsd: opts.maxCost ?? null, maxCalls,
        note: "stima da `total_cost_usd` di `claude -p`: col piano a forfait non è un addebito; vale 0 se il CLI non lo espone",
      },
      timing: { totalSec: round(spent), stages: { regista: sec["regista"] ?? 0, render: sec["render"] ?? 0, qa: sec["qa"] ?? 0, ...Object.fromEntries(Object.entries(final.timing?.stages ?? {}).map(([k, v]) => [`render.${k}`, v])) } },
      versions: { ...(final.versions ?? {}), claudeCli: claude.ok ? claude.stdout.trim().split(/\r?\n/)[0] : null },
      commands: [...cmds, ...renderCommands],
      outputs: Object.fromEntries(["video", "storyboard", "qa-report", "manifest"].map((k) => [k, k === "video" ? videoName : `${k}.json`])),
    });
    writeFileSync(manifestFile, JSON.stringify(final, null, 2) + "\n");
    rmSync(path.join(dir, "error.json"), { force: true });
    delivered = true;
    log.add({ stage: "consegna", status: "done", video: videoName });

    const draft = videoName !== "video.mp4" || final.status !== "final";
    return result({
      status: draft ? "draft" : "delivered", approval, videoFile, qa,
      files: files(videoName, "storyboard.json", "qa-report.json", "manifest.json", "brief.json", "approval.json", "run.log"),
      cost: { usd: round(usage.usd, 4), llmCalls: usage.calls },
    });
  } catch (e) {
    const err = e instanceof EngineError ? e : null;
    const code = (err?.code ?? "E_INTERNAL") as ErrorCode | "E_INTERNAL";
    const info = {
      code, stage: current, at: new Date().toISOString(), message: (e as Error).message,
      exit: err ? ERRORS[err.code].exit : 1, hint: err ? HINTS[err.code] ?? null : null,
    };
    try {
      if (!delivered && rendered && outDir && existsSync(outDir) && VIDEOS.some((v) => existsSync(path.join(outDir!, v)))) moveAside(outDir, `interrotto in "${current}": ${code}`);
      const where = outDir && existsSync(outDir) ? outDir : failDir;
      mkdirSync(where, { recursive: true });
      if (where === failDir) log.dump(failDir);
      writeFileSync(path.join(where, "error.json"), JSON.stringify(info, null, 2) + "\n");
    } catch {
      /* il rapporto d'errore non deve nascondere l'errore vero */
    }
    throw e;
  }
}
