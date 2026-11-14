import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sha256 } from "../director/index.ts";
import { ROOT } from "../theme/tokens.ts";
import { EngineError, type ErrorCode } from "../utils/errors.ts";
import { make, type MakeOptions, type MakeResult } from "./index.ts";

export type JobStatus = "running" | "planned" | "done" | "draft" | "failed";

export interface JobState {
  hash: string;
  status: JobStatus;
  outDir?: string;
  slug?: string;
  attempts: number;
  startedAt: string;
  finishedAt?: string;
  error?: { code: string; message: string };
  costUsd?: number;
  llmCalls?: number;
}

export interface BatchState {
  version: 1;
  jobs: Record<string, JobState>;
}

export interface BatchOptions extends Pick<MakeOptions, "format" | "durationSec" | "preview" | "maxCost" | "maxRounds" | "maxCalls" | "workers" | "root" | "outRoot" | "cliFactory" | "stages" | "retryDelaysMs"> {
  /** Cartella con i brief `.md`. */
  dir: string;
  /** Rifà tutto da capo, anche i brief già consegnati. */
  force?: boolean;
  say?: (msg: string) => void;
  /** Sostituibile nei test. */
  makeFn?: typeof make;
}

export interface BatchSummary {
  total: number;
  done: string[];
  planned: string[];
  failed: { file: string; code: string; message: string }[];
  skipped: string[];
  /** Brief rimasti in coda perché il batch si è fermato (ambiente o Claude non disponibili). */
  notRun: string[];
  aborted: string | null;
  stateFile: string;
  logFile: string;
  costUsd: number;
}

/** Codici per cui continuare con il brief successivo sarebbe inutile: fallirebbero tutti allo stesso modo. */
const FATAL: ErrorCode[] = ["E_ENV", "E_LLM_UNAVAILABLE"];

const KEYS: Record<string, "format" | "durationSec"> = { format: "format", formato: "format", duration: "durationSec", durata: "durationSec" };

/**
 * Un brief è un `.md` con il prompt in italiano. In testa si può mettere, tra due righe `---`,
 * `formato: 9:16|16:9` e `durata: 20` (anche `format`/`duration`).
 */
export function parseBriefFile(text: string): { prompt: string; format?: "9:16" | "16:9"; durationSec?: number } {
  let body = text.replace(/^﻿/, "");
  const out: { prompt: string; format?: "9:16" | "16:9"; durationSec?: number } = { prompt: "" };
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(body);
  if (m) {
    body = body.slice(m[0].length);
    for (const line of m[1]!.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const kv = /^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(line);
      const key = kv && KEYS[kv[1]!.toLowerCase()];
      if (!kv || !key) throw new EngineError("E_USAGE", `Riga non valida in testa al brief: "${line.trim()}". Sono ammessi solo formato e durata.`);
      if (key === "format") {
        if (kv[2] !== "9:16" && kv[2] !== "16:9") throw new EngineError("E_USAGE", `formato accetta solo 9:16 o 16:9, trovato "${kv[2]}".`);
        out.format = kv[2];
      } else {
        const n = Number(kv[2]!.replace(",", "."));
        if (!Number.isFinite(n) || n <= 0) throw new EngineError("E_USAGE", `durata vuole un numero di secondi, trovato "${kv[2]}".`);
        out.durationSec = n;
      }
    }
  }
  out.prompt = body.trim();
  if (!out.prompt) throw new EngineError("E_USAGE", "Il brief è vuoto: scrivi il prompt sotto l'intestazione.");
  return out;
}

export function listBriefs(dir: string): string[] {
  if (!existsSync(dir)) throw new EngineError("E_USAGE", `La cartella dei brief non esiste: ${dir}`);
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.md$/i.test(e.name) && !/^[._]/.test(e.name) && !/^readme\.md$/i.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "it"));
}

function loadState(file: string): BatchState {
  try {
    const s = JSON.parse(readFileSync(file, "utf8")) as BatchState;
    if (s.version === 1 && s.jobs) return s;
  } catch {
    /* stato assente o rovinato: si riparte dai file di ogni cartella */
  }
  return { version: 1, jobs: {} };
}

function saveState(file: string, s: BatchState) {
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n");
  renameSync(tmp, file); // sostituzione atomica: un crash a metà non lascia uno stato spezzato
}

function deliveredOk(outDir: string | undefined): boolean {
  if (!outDir) return false;
  try {
    const m = JSON.parse(readFileSync(path.join(outDir, "manifest.json"), "utf8"));
    return m.status === "final" && existsSync(path.join(outDir, "video.mp4")) && existsSync(path.join(outDir, "qa-report.json"));
  } catch {
    return false;
  }
}

/**
 * Elabora in coda, uno alla volta, tutti i `.md` di una cartella. Stato in `out/_batch/state.json`, log in `out/_batch/batch.log`.
 * Rilanciando lo stesso comando si saltano i brief già consegnati (stesso testo e stesse opzioni) e si riprendono
 * gli altri dalla cartella `out/<slug>` già avviata, senza rifare brief, storyboard e render già fatti.
 */
export async function batch(opts: BatchOptions): Promise<BatchSummary> {
  const root = opts.root ?? ROOT;
  const outRoot = opts.outRoot ?? path.join(root, "out");
  const dir = path.resolve(opts.dir);
  const stateDir = path.join(outRoot, "_batch");
  mkdirSync(stateDir, { recursive: true });
  const stateFile = path.join(stateDir, "state.json");
  const logFile = path.join(stateDir, "batch.log");
  const say = opts.say ?? (() => {});
  const makeFn = opts.makeFn ?? make;
  const note = (file: string | null, msg: string) => {
    appendFileSync(logFile, `${new Date().toISOString()} ${file ? `[${file}] ` : ""}${msg.replace(/\r?\n/g, " ⏎ ")}\n`);
    say(file ? `[${file}] ${msg}` : msg);
  };

  const files = listBriefs(dir);
  const state = loadState(stateFile);
  const summary: BatchSummary = { total: files.length, done: [], planned: [], failed: [], skipped: [], notRun: [], aborted: null, stateFile, logFile, costUsd: 0 };
  if (!files.length) {
    note(null, `Nessun file .md in ${dir}.`);
    return summary;
  }
  note(null, `Batch: ${files.length} brief in ${dir}${opts.force ? " (--force)" : ""}`);

  for (const [i, file] of files.entries()) {
    if (summary.aborted) {
      summary.notRun.push(file);
      continue;
    }
    const tag = `${i + 1}/${files.length}`;
    let parsed: ReturnType<typeof parseBriefFile>;
    let text: string;
    try {
      text = readFileSync(path.join(dir, file), "utf8");
      parsed = parseBriefFile(text);
    } catch (e) {
      const err = e as EngineError;
      state.jobs[file] = { hash: "", status: "failed", attempts: (state.jobs[file]?.attempts ?? 0) + 1, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), error: { code: err.code ?? "E_USAGE", message: err.message } };
      saveState(stateFile, state);
      summary.failed.push({ file, code: err.code ?? "E_USAGE", message: err.message });
      note(file, `(${tag}) brief non valido: ${err.message}`);
      continue;
    }
    // Il flag del comando vince su quello del file (è la richiesta più recente).
    const format = opts.format ?? parsed.format;
    const durationSec = opts.durationSec ?? parsed.durationSec;
    const hash = sha256(JSON.stringify({ text, format: format ?? null, durationSec: durationSec ?? null }));
    const prev = state.jobs[file];
    const same = prev && prev.hash === hash && !opts.force;

    if (same && (prev.status === "done" || prev.status === "draft") && deliveredOk(prev.outDir) === (prev.status === "done")) {
      summary.skipped.push(file);
      note(file, `(${tag}) già consegnato in ${prev.outDir}, salto (usa --force per rifarlo).`);
      continue;
    }
    if (same && prev.status === "planned" && opts.preview) {
      summary.skipped.push(file);
      note(file, `(${tag}) piano già pronto in ${prev.outDir}, salto.`);
      continue;
    }

    const resume = same && prev.outDir && existsSync(path.join(prev.outDir, "brief.json")) ? prev.outDir : undefined;
    const job: JobState = { hash, status: "running", outDir: resume, slug: prev?.slug, attempts: (prev?.attempts ?? 0) + 1, startedAt: new Date().toISOString() };
    state.jobs[file] = job;
    saveState(stateFile, state);
    note(file, `(${tag}) ${resume ? `ripresa da ${resume}` : "avvio"}, tentativo ${job.attempts}`);

    try {
      const r: MakeResult = await makeFn({
        prompt: resume ? undefined : parsed.prompt,
        resume,
        format: resume ? undefined : format,
        durationSec: resume ? undefined : durationSec,
        preview: opts.preview,
        maxCost: opts.maxCost,
        maxRounds: opts.maxRounds,
        maxCalls: opts.maxCalls,
        workers: opts.workers,
        root,
        outRoot,
        cliFactory: opts.cliFactory,
        stages: opts.stages,
        retryDelaysMs: opts.retryDelaysMs,
        command: `npm run batch -- ${path.relative(root, dir).split(path.sep).join("/") || "."}  # ${file}`,
        say: (m) => appendFileSync(logFile, m.split("\n").map((l) => `${new Date().toISOString()} [${file}]   ${l}\n`).join("")),
        onEvent: (e) => {
          if (e.outDir && job.outDir !== e.outDir) {
            job.outDir = e.outDir;
            saveState(stateFile, state); // lo slug è noto: se il processo muore, la ripresa sa dove guardare
          }
          if (e.status !== "start") note(file, `${e.stage}: ${e.status === "done" ? "ok" : e.status === "skip" ? "già fatto" : "ERRORE"}`);
        },
      });
      job.status = r.status === "planned" ? "planned" : r.status === "draft" ? "draft" : "done";
      job.outDir = r.outDir;
      job.slug = r.slug;
      job.costUsd = r.cost.usd;
      job.llmCalls = r.cost.llmCalls;
      job.finishedAt = new Date().toISOString();
      summary.costUsd += r.cost.usd;
      (job.status === "planned" ? summary.planned : summary.done).push(file);
      note(file, `(${tag}) ${job.status === "planned" ? "piano pronto" : job.status === "draft" ? "BOZZA consegnata" : "consegnato"}: ${r.videoFile ?? r.outDir} — ${r.elapsedSec} s, ~$${r.cost.usd} stimati, ${r.cost.llmCalls} chiamata/e`);
    } catch (e) {
      const err = e instanceof EngineError ? e : null;
      const code = err?.code ?? "E_INTERNAL";
      job.status = "failed";
      job.finishedAt = new Date().toISOString();
      job.error = { code, message: (e as Error).message };
      summary.failed.push({ file, code, message: (e as Error).message });
      note(file, `(${tag}) FALLITO ${code}: ${(e as Error).message}`);
      if (err && FATAL.includes(err.code)) {
        summary.aborted = `${code}: continuare sarebbe inutile, i brief rimasti fallirebbero allo stesso modo`;
        note(null, `Batch interrotto — ${summary.aborted}. Risolvi e rilancia lo stesso comando: riprende da qui.`);
      }
    }
    saveState(stateFile, state);
  }

  note(null, `Fine batch: ${summary.done.length} consegnati, ${summary.planned.length} piani, ${summary.skipped.length} saltati, ${summary.failed.length} falliti, ${summary.notRun.length} non eseguiti. Costo stimato ~$${summary.costUsd.toFixed(2)}.`);
  return summary;
}
