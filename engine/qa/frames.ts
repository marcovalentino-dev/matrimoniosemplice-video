import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import type { Storyboard } from "../schemas/storyboard.ts";
import { ROOT } from "../theme/tokens.ts";
import { EngineError } from "../utils/errors.ts";

const FONT = path.join(ROOT, "assets", "fonts", "inter", "Inter[opsz,wght].ttf");

/** ffmpeg asincrono: non blocca il ciclo degli eventi (il revisore e i test restano reattivi durante la QA). */
function ffmpeg(args: string[], timeoutMs = 300000): Promise<{ ok: boolean; stderr: string; stdout: Buffer }> {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, stderr: e.message, stdout: Buffer.alloc(0) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stderr: err, stdout: Buffer.concat(out) });
    });
  });
}

/** Lo shot attivo al tempo `t` (start <= t < end). */
export function shotAt(sb: Pick<Storyboard, "shots">, t: number): string {
  for (const s of sb.shots) if (t >= s.start - 1e-9 && t < s.end - 1e-9) return s.id;
  return sb.shots[sb.shots.length - 1]!.id;
}

export interface FrameSet {
  /** Un fotogramma ogni secondo: `t` è l'istante, `file` il JPEG. */
  frames: { t: number; file: string; shot: string }[];
  /** Contact sheet in ordine di tempo, `cols` × `rows` miniature ciascuno. */
  sheets: { file: string; from: number; to: number; cols: number; rows: number }[];
  /** Fotogrammi a piena risoluzione, uno per shot (al massimo `maxStills`). */
  stills: { t: number; file: string; shot: string }[];
  labelled: boolean;
}

const LAYOUT = {
  "9:16": { cols: 8, rows: 2, tw: 192 },
  "16:9": { cols: 4, rows: 4, tw: 384 },
} as const;

/** Istanti dei still: a 60% di ogni shot (a regime, dopo l'entrata); se sono troppi, distribuiti ma con primo e ultimo. */
export function stillTimes(sb: Pick<Storyboard, "shots">, max: number): { t: number; shot: string }[] {
  const all = sb.shots.map((s) => ({ t: Math.round((s.start + (s.end - s.start) * 0.6) * 1000) / 1000, shot: s.id }));
  if (all.length <= max) return all;
  const out: typeof all = [];
  for (let i = 0; i < max; i++) out.push(all[Math.round((i * (all.length - 1)) / (max - 1))]!);
  return out.filter((x, i) => out.findIndex((y) => y.shot === x.shot) === i);
}

/** Estrae i fotogrammi ogni secondo, i contact sheet e gli still di revisione (JPEG, già in 9:16 o 16:9). */
export async function extractFrames(opts: { video: string; sb: Pick<Storyboard, "shots" | "format" | "durationSec" | "size">; dir: string; maxStills?: number }): Promise<FrameSet> {
  const { video, sb, dir } = opts;
  const lay = LAYOUT[sb.format as keyof typeof LAYOUT];
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, "frames"), { recursive: true });
  mkdirSync(path.join(dir, "stills"), { recursive: true });

  const th = Math.round((lay.tw * sb.size.h) / sb.size.w / 2) * 2;
  const r = await ffmpeg(["-i", video, "-vf", `fps=1,scale=${lay.tw}:${th}:flags=lanczos`, "-q:v", "3", "-start_number", "0", path.join(dir, "frames", "f-%03d.jpg")]);
  if (!r.ok) throw new EngineError("E_ENCODE", `estrazione fotogrammi: ${r.stderr.trim().slice(0, 300)}`);
  const files = readdirSync(path.join(dir, "frames")).filter((f) => f.endsWith(".jpg")).sort();
  if (!files.length) throw new EngineError("E_ENCODE", `nessun fotogramma estratto da ${video}`);
  const frames = files.map((f, k) => ({ t: k, file: path.join(dir, "frames", f), shot: shotAt(sb, Math.min(k, sb.durationSec - 0.001)) }));

  const per = lay.cols * lay.rows;
  const sheets: FrameSet["sheets"] = [];
  let labelled = existsSync(FONT);
  const BS = String.fromCharCode(92);
  const font = FONT.split(BS).join("/").split(":").join(BS + ":");
  for (let from = 0; from < frames.length; from += per) {
    const n = Math.min(per, frames.length - from);
    const file = path.join(dir, `contact-sheet-${sheets.length + 1}.jpg`);
    const input = ["-framerate", "1", "-start_number", String(from), "-i", path.join(dir, "frames", "f-%03d.jpg"), "-frames:v", "1"]; // un solo mosaico: senza questo, con più di cols×rows fotogrammi in ingresso ffmpeg ne scrive due sullo stesso file
    const tile = `tile=${lay.cols}x${lay.rows}:padding=6:margin=6:color=0xFFF8F5`;
    const label = `drawtext=fontfile='${font}':text='%{eif${BS}:n+${from}${BS}:d}s':x=6:y=6:fontsize=${Math.round(lay.tw / 9)}:fontcolor=0x1E1E1E:box=1:boxcolor=0xFFF8F5@0.85:boxborderw=4`;
    let ok = false;
    if (labelled) ok = (await ffmpeg([...input, "-vf", `${label},${tile}`, "-q:v", "3", file])).ok;
    if (!ok) {
      labelled = false;
      ok = (await ffmpeg([...input, "-vf", tile, "-q:v", "3", file])).ok;
    }
    if (!ok) throw new EngineError("E_ENCODE", "contact sheet: ffmpeg non riesce a comporre le miniature.");
    sheets.push({ file, from, to: from + n - 1, cols: lay.cols, rows: lay.rows });
  }

  const stills: FrameSet["stills"] = [];
  for (const s of stillTimes(sb, opts.maxStills ?? 8)) {
    const file = path.join(dir, "stills", `${s.shot}.jpg`);
    const t = Math.min(s.t, Math.max(0, sb.durationSec - 0.1));
    const rr = await ffmpeg(["-ss", t.toFixed(3), "-i", video, "-frames:v", "1", "-q:v", "2", file]);
    if (!rr.ok || !existsSync(file)) throw new EngineError("E_ENCODE", `still ${s.shot} a ${t} s: ${rr.stderr.trim().slice(0, 200)}`);
    stills.push({ t, file, shot: s.shot });
  }
  return { frames, sheets, stills, labelled };
}

export interface BlackHit {
  shot: string;
  t: number;
  /** Quota di pixel neri nel fotogramma (0-1). */
  fraction: number;
}

/**
 * Cerca pixel neri puri (#000000, BRAND: usare #1E1E1E) campionando 2 fotogrammi al secondo, ridotti a 1/4.
 * Soglia: tutti i canali ≤ 2 (tolleranza di codifica) e almeno lo 0,2% del fotogramma.
 */
export async function scanBlack(opts: { video: string; sb: Pick<Storyboard, "shots" | "durationSec" | "size">; minFraction?: number }): Promise<BlackHit[]> {
  const { video, sb } = opts;
  const w = Math.round(sb.size.w / 4 / 2) * 2;
  const h = Math.round(sb.size.h / 4 / 2) * 2;
  const r = await ffmpeg(["-i", video, "-vf", `fps=2,scale=${w}:${h}:flags=neighbor`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  if (!r.ok) throw new EngineError("E_ENCODE", `analisi pixel: ${r.stderr.trim().slice(0, 300)}`);
  const buf = r.stdout;
  const frame = w * h * 3;
  const min = opts.minFraction ?? 0.002;
  const hits: BlackHit[] = [];
  for (let k = 0; (k + 1) * frame <= buf.length; k++) {
    let black = 0;
    for (let i = k * frame; i < (k + 1) * frame; i += 3) if (buf[i]! <= 2 && buf[i + 1]! <= 2 && buf[i + 2]! <= 2) black++;
    const fraction = black / (w * h);
    if (fraction >= min) {
      const t = k / 2;
      hits.push({ shot: shotAt(sb, Math.min(t, sb.durationSec - 0.001)), t, fraction });
    }
  }
  return hits;
}
