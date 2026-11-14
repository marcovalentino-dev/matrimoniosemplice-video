import { spawn } from "node:child_process";
import { EngineError } from "../utils/errors.ts";

export interface LlmRequest {
  system: string;
  prompt: string;
}
/** Una chiamata al modello: restituisce il testo della risposta. Sostituibile nei test. */
export type LlmFn = (req: LlmRequest) => Promise<string>;

export interface LlmUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ClaudeCliOptions {
  /** Cartella di lavoro: da qui il modello può leggere i file di brand/. */
  cwd: string;
  timeoutMs?: number;
  model?: string;
  /** Strumenti consentiti: solo lettura. */
  tools?: string[];
  /** Cartelle in più che gli strumenti di lettura possono aprire (es. i fotogrammi della QA, fuori da `cwd`). */
  addDirs?: string[];
  onUsage?: (u: Partial<LlmUsage>) => void;
}

/**
 * `claude -p` non interattivo, output JSON, solo strumenti di lettura.
 * Il prompt passa da stdin (su Windows la riga di comando ha un limite di lunghezza).
 */
export function claudeCli(opts: ClaudeCliOptions): LlmFn {
  const tools = opts.tools ?? ["Read", "Grep", "Glob"];
  const timeoutMs = opts.timeoutMs ?? 300000;
  return ({ system, prompt }) =>
    new Promise<string>((resolve, reject) => {
      const args = [
        "-p",
        "--output-format", "json",
        "--tools", tools.join(","),
        "--allowedTools", tools.join(","),
        "--permission-mode", "dontAsk",
        "--no-session-persistence",
        "--system-prompt", system,
      ];
      if (opts.model) args.push("--model", opts.model);
      if (opts.addDirs?.length) args.push("--add-dir", ...opts.addDirs);
      const child = spawn("claude", args, { cwd: opts.cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new EngineError("E_LLM_UNAVAILABLE", `Timeout di ${timeoutMs / 1000} s.`));
      }, timeoutMs);
      child.stdout.setEncoding("utf8").on("data", (d: string) => (out += d));
      child.stderr.setEncoding("utf8").on("data", (d: string) => (err += d));
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(new EngineError("E_LLM_UNAVAILABLE", e.message));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        let json: Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
        try {
          json = JSON.parse(out);
        } catch {
          /* gestito sotto */
        }
        if (code !== 0 || !json || json.is_error || typeof json.result !== "string") {
          const why = json?.result ?? (err.trim() || out.trim().slice(0, 300) || `uscita ${code}`);
          return reject(new EngineError("E_LLM_UNAVAILABLE", String(why).slice(0, 400)));
        }
        const u = json.usage ?? {};
        opts.onUsage?.({
          inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
          outputTokens: u.output_tokens ?? 0,
          costUsd: json.total_cost_usd ?? 0,
        });
        resolve(json.result);
      });
      child.stdin.end(prompt);
    });
}

/** Estrae il primo oggetto JSON da una risposta (ignora recinti ``` e testo attorno). */
export function extractJson(text: string): unknown {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1]! : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("nessun oggetto JSON nella risposta");
  return JSON.parse(body.slice(start, end + 1));
}
