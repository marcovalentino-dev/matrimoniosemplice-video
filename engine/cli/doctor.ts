import { existsSync, readFileSync } from "node:fs";
import { run } from "../utils/proc.ts";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  required: boolean;
}

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];

export function firstLine(s: string): string {
  return s.split(/\r?\n/)[0]?.trim() ?? "";
}

export function findChrome(configured?: string | null): string | null {
  for (const p of [configured, process.env.CHROME_PATH, ...CHROME_CANDIDATES]) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

export function versionAtLeast(version: string, min: number[]): boolean {
  const v = version.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < min.length; i++) {
    const a = v[i] ?? 0;
    if (a > min[i]) return true;
    if (a < min[i]) return false;
  }
  return true;
}

export function doctor(configPath: string): Check[] {
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const checks: Check[] = [];
  const nodeOk = versionAtLeast(process.version, [22, 18]);
  checks.push({ name: "Node", ok: nodeOk, detail: process.version + (nodeOk ? "" : " (serve >= 22.18)"), required: true });
  for (const bin of ["ffmpeg", "ffprobe"]) {
    const r = run(bin, ["-version"]);
    checks.push({ name: bin, ok: r.ok, detail: r.ok ? firstLine(r.stdout) : "non trovato nel PATH", required: true });
  }
  const chrome = findChrome(cfg.chromePath);
  checks.push({ name: "Chrome", ok: !!chrome, detail: chrome ?? "non trovato (imposta CHROME_PATH o chromePath)", required: true });
  const py = run("python", ["--version"]);
  checks.push({ name: "Python (solo prototipo dal-caos)", ok: py.ok, detail: py.ok ? firstLine(py.stdout || py.stderr) : "non trovato (serve solo per rigenerare il prototipo storico: il motore sintetizza la musica con ffmpeg)", required: false });
  const claude = run("claude", ["--version"]);
  checks.push({ name: "Claude CLI", ok: claude.ok, detail: claude.ok ? firstLine(claude.stdout) : "non trovato (serve per brief, regista, QA)", required: true });
  return checks;
}
