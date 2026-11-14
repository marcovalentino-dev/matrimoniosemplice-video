import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { EngineError } from "../utils/errors.ts";

export interface MakeArgs {
  prompt?: string;
  resume?: string;
  format?: "9:16" | "16:9";
  durationSec?: number;
  preview: boolean;
  approve: boolean;
  maxCost?: number;
  maxRounds?: number;
  maxCalls?: number;
  workers?: number;
}

export interface BatchArgs {
  dir?: string;
  format?: "9:16" | "16:9";
  durationSec?: number;
  preview: boolean;
  force: boolean;
  maxCost?: number;
  maxRounds?: number;
  maxCalls?: number;
  workers?: number;
}

const usage = (msg: string) => new EngineError("E_USAGE", msg);

function num(name: string, v: string | undefined, o: { min?: number; int?: boolean; gt?: number } = {}): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n) || v.trim() === "") throw usage(`${name} vuole un numero, ricevuto "${v}".`);
  if (o.int && !Number.isInteger(n)) throw usage(`${name} vuole un numero intero, ricevuto "${v}".`);
  if (o.gt !== undefined && n <= o.gt) throw usage(`${name} deve essere maggiore di ${o.gt}, ricevuto ${v}.`);
  if (o.min !== undefined && n < o.min) throw usage(`${name} deve essere almeno ${o.min}, ricevuto ${v}.`);
  return n;
}

function fmt(v: string | undefined): "9:16" | "16:9" | undefined {
  if (v === undefined) return undefined;
  if (v !== "9:16" && v !== "16:9") throw usage(`--format accetta solo 9:16 o 16:9, ricevuto "${v}".`);
  return v;
}

function parse<T extends Record<string, { type: "string" | "boolean" }>>(argv: string[], options: T, hint: string) {
  try {
    return parseArgs({ args: argv, allowPositionals: true, strict: true, options });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") throw usage(`Opzione sconosciuta: ${/'([^']+)'/.exec(err.message)?.[1] ?? err.message}. ${hint}`);
    if (err.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") throw usage(`Manca il valore di un'opzione (${/'([^']+)'/.exec(err.message)?.[1] ?? err.message}). ${hint}`);
    throw usage(`${err.message} ${hint}`);
  }
}

export const MAKE_USAGE = 'Uso: npm run make -- "<prompt>" [--format 9:16|16:9] [--duration s] [--preview] [--max-cost usd] [--max-rounds n] [--max-calls n]  oppure  npm run make -- --resume out/<slug> [--approve]';
export const BATCH_USAGE = "Uso: npm run batch -- [cartella-brief] [--format 9:16|16:9] [--duration s] [--preview] [--force] [--max-cost usd] [--max-rounds n] [--max-calls n]";

export function parseMakeArgs(argv: string[]): MakeArgs {
  const { values, positionals } = parse(
    argv,
    {
      format: { type: "string" }, duration: { type: "string" }, preview: { type: "boolean" }, approve: { type: "boolean" },
      "max-cost": { type: "string" }, "max-rounds": { type: "string" }, "max-calls": { type: "string" }, workers: { type: "string" }, resume: { type: "string" },
    },
    MAKE_USAGE,
  );
  const prompt = positionals.join(" ").trim();
  if (!prompt && !values.resume) throw usage(`Manca il prompt. ${MAKE_USAGE}`);
  if (prompt && values.resume) throw usage("Usa il prompt oppure --resume, non entrambi (con --resume il brief è già nella cartella).");
  if (values.resume && (values.format || values.duration)) throw usage("Con --resume formato e durata sono quelli già decisi nel brief: togli --format e --duration.");
  return {
    prompt: prompt || undefined,
    resume: values.resume,
    format: fmt(values.format),
    durationSec: num("--duration", values.duration, { gt: 0 }),
    preview: !!values.preview,
    approve: !!values.approve,
    maxCost: num("--max-cost", values["max-cost"], { gt: 0 }),
    maxRounds: num("--max-rounds", values["max-rounds"], { min: 0, int: true }),
    maxCalls: num("--max-calls", values["max-calls"], { min: 1, int: true }),
    workers: num("--workers", values.workers, { min: 1, int: true }),
  };
}

export function parseBatchArgs(argv: string[]): BatchArgs {
  const { values, positionals } = parse(
    argv,
    {
      format: { type: "string" }, duration: { type: "string" }, preview: { type: "boolean" }, force: { type: "boolean" },
      "max-cost": { type: "string" }, "max-rounds": { type: "string" }, "max-calls": { type: "string" }, workers: { type: "string" },
    },
    BATCH_USAGE,
  );
  if (positionals.length > 1) throw usage(`Una sola cartella alla volta (ricevute ${positionals.length}). ${BATCH_USAGE}`);
  return {
    dir: positionals[0],
    format: fmt(values.format),
    durationSec: num("--duration", values.duration, { gt: 0 }),
    preview: !!values.preview,
    force: !!values.force,
    maxCost: num("--max-cost", values["max-cost"], { gt: 0 }),
    maxRounds: num("--max-rounds", values["max-rounds"], { min: 0, int: true }),
    maxCalls: num("--max-calls", values["max-calls"], { min: 1, int: true }),
    workers: num("--workers", values.workers, { min: 1, int: true }),
  };
}

/** `npm run` parte da engine/, ma briefs/ e out/ stanno nella radice del repo: prova prima la cartella corrente, poi la radice. */
export function resolveFromCwdOrRoot(p: string, root: string): string {
  const here = path.resolve(p);
  if (existsSync(here)) return here;
  const there = path.resolve(root, p);
  return existsSync(there) ? there : here;
}
