import { spawnSync } from "node:child_process";

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number | null;
}

/** Esegue un comando senza shell e restituisce l'output (timeout 20 s di default). */
export function run(cmd: string, args: string[], timeoutMs = 20000): RunResult {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: timeoutMs, windowsHide: true });
  return { ok: r.status === 0 && !r.error, stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: r.status };
}
