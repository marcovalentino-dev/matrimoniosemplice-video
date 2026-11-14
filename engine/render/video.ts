import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { startPreview } from "../cli/preview.ts";
import { findChrome } from "../cli/doctor.ts";
import type { Storyboard } from "../schemas/storyboard.ts";
import { hostHtml } from "../scenes/index.ts";
import type { FormatId } from "../theme/safe-area.ts";
import { ROOT } from "../theme/tokens.ts";
import { EngineError } from "../utils/errors.ts";
import { composeFrame, type PreparedShot } from "./compose.ts";

export interface Profile {
  name: "preview" | "final";
  /** Fattore di scala del viewport: 0.5 → 540×960. */
  scale: number;
  fps: number;
  crf: number;
  preset: string;
}

export const PREVIEW = { name: "preview", scale: 0.5, crf: 28, preset: "veryfast" } as const;
export const FINAL = { name: "final", scale: 1, crf: 16, preset: "medium" } as const;

/** Rec.709, intervallo limitato (SPEC §8.1). */
const COLOR_ARGS = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];
const SCALE_VF = "scale=out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p";

function encodeArgs(p: Profile, out: string): string[] {
  return [
    "-hide_banner", "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(p.fps), "-c:v", "png", "-i", "-",
    "-vf", SCALE_VF, "-c:v", "libx264", "-preset", p.preset, "-crf", String(p.crf),
    "-pix_fmt", "yuv420p", ...COLOR_ARGS, "-r", String(p.fps), "-g", String(p.fps * 2), "-an", out,
  ];
}

export interface RenderVideoOptions {
  sb: Storyboard;
  shots: PreparedShot[];
  profile: Profile;
  out: string;
  workDir: string;
  workers: number;
  chromePath?: string | null;
  log: (cmd: string) => void;
  progress?: (done: number, total: number) => void;
}

export interface RenderVideoResult {
  frames: number;
  chromeVersion: string;
}

const quote = (a: string) => (/[\s|;=\[\]]/.test(a) ? `"${a}"` : a);

/** Versione del formato dei blocchi in cache: cambiarla invalida tutto. */
const CHUNK_VERSION = 1;
const sha = (b: string) => createHash("sha256").update(b).digest("hex").slice(0, 32);

/**
 * Renderizza il video senza audio, a blocchi di 1 s (`fps` fotogrammi): N pagine Chrome prendono i blocchi da una coda,
 * ogni blocco manda i PNG in pipe a un ffmpeg che scrive un piccolo MP4; poi concatenazione senza ricodifica.
 *
 * I blocchi sono in cache (`<workDir>/chunks-<profilo>/<hash>.mp4`) con chiave = hash dell'HTML di tutti i loro fotogrammi
 * + profilo: dopo la modifica di uno shot si ri-renderizzano solo i blocchi che lo toccano (giri di QA, SPEC §8.2).
 */
export async function renderVideo(o: RenderVideoOptions): Promise<RenderVideoResult> {
  const { sb, profile } = o;
  const format = sb.format as FormatId;
  const chrome = findChrome(o.chromePath);
  if (!chrome) throw new EngineError("E_ENV", "Chrome non trovato.");
  const total = Math.round(sb.durationSec * profile.fps);
  const chunkLen = profile.fps;
  const nChunks = Math.ceil(total / chunkLen);
  const workers = Math.max(1, Math.min(o.workers, nChunks));
  const segDir = path.join(o.workDir, `chunks-${profile.name}`);
  mkdirSync(segDir, { recursive: true });
  const profKey = `${CHUNK_VERSION}|${profile.name}|${profile.scale}|${profile.fps}|${profile.crf}|${profile.preset}|${sb.size.w}x${sb.size.h}`;

  const srv = await startPreview(ROOT, 0, { "/__host.html": hostHtml(format, "/") });
  const port = (srv.address() as { port: number }).port;
  // Un browser per worker: in headless le pagine in secondo piano non producono fotogrammi e screenshot() va in timeout.
  const browsers: Browser[] = [];
  let chromeVersion = "";
  let done = 0;
  let next = 0;
  o.log(`ffmpeg ${encodeArgs(profile, "<blocco>.mp4").map(quote).join(" ")}   # ${nChunks} blocchi da 1 s in cache, ${workers} worker, PNG di Chrome in pipe`);

  const segs: string[] = new Array(nChunks);
  try {
    await Promise.all(
      Array.from({ length: workers }, async () => {
        let page: Page | null = null;
        const errors: string[] = [];
        for (;;) {
          const c = next++;
          if (c >= nChunks) break;
          const from = c * chunkLen;
          const to = Math.min(total, from + chunkLen);
          const htmls: string[] = [];
          for (let i = from; i < to; i++) htmls.push(composeFrame(o.shots, i / profile.fps));
          const seg = path.join(segDir, `${sha(profKey + "|" + htmls.join("<!--frame-->"))}-${to - from}.mp4`);
          segs[c] = seg;
          if (existsSync(seg)) {
            o.progress?.((done += to - from), total);
            continue;
          }

          if (!page) {
            const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
            browsers.push(browser);
            if (!chromeVersion) chromeVersion = await browser.version();
            page = await browser.newPage();
            page.on("pageerror", (e) => errors.push(String(e)));
            page.on("requestfailed", (r) => errors.push(`richiesta fallita: ${r.url()}`));
            await page.setViewport({ width: sb.size.w, height: sb.size.h, deviceScaleFactor: profile.scale });
            await page.goto(`http://127.0.0.1:${port}/__host.html`, { waitUntil: "networkidle0" });
            await page.evaluate(async () => {
              await Promise.all([...document.fonts].map((f) => f.load()));
              await document.fonts.ready;
            });
          }

          // Si scrive su un file temporaneo e si rinomina a fine blocco: un blocco incompleto non entra mai in cache.
          const tmp = seg.replace(/\.mp4$/, ".part.mp4");
          const ff = spawn("ffmpeg", encodeArgs(profile, tmp), { stdio: ["pipe", "ignore", "pipe"], windowsHide: true });
          let ffErr = "";
          ff.stderr.on("data", (d) => (ffErr += d));
          const closed = new Promise<number | null>((res) => ff.on("close", res));
          ff.stdin.on("error", () => {});
          try {
            for (const html of htmls) {
              await page.evaluate(async (h) => {
                document.getElementById("root")!.innerHTML = h;
                await document.fonts.ready;
              }, html);
              const png = Buffer.from((await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: sb.size.w, height: sb.size.h } })) as Uint8Array);
              if (!ff.stdin.write(png)) await new Promise<void>((r) => ff.stdin.once("drain", () => r()));
              o.progress?.(++done, total);
            }
          } finally {
            ff.stdin.end();
          }
          const code = await closed;
          if (code !== 0) throw new EngineError("E_ENCODE", `blocco ${c}: ${ffErr.trim().split(/\r?\n/).slice(-4).join(" ")}`);
          if (errors.length) throw new EngineError("E_RENDER_PAGE", errors.join("; "));
          renameSync(tmp, seg);
        }
        await page?.close();
      }),
    );
  } finally {
    await Promise.all(browsers.map((b) => b.close()));
    srv.close();
  }

  const keep = new Set(segs.map((s) => path.basename(s)));
  for (const f of readdirSync(segDir)) if (f.endsWith(".mp4") && !keep.has(f)) rmSync(path.join(segDir, f), { force: true });
  for (const f of readdirSync(segDir)) if (f.endsWith(".part.mp4")) rmSync(path.join(segDir, f), { force: true });

  const list = path.join(segDir, `list-${path.basename(o.out, ".mp4")}.txt`);
  writeFileSync(list, segs.map((s) => `file '${path.basename(s)}'`).join("\n") + "\n");
  const concat = ["-hide_banner", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", o.out];
  o.log(`ffmpeg ${concat.map(quote).join(" ")}`);
  const r = spawnSync("ffmpeg", concat, { encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw new EngineError("E_ENCODE", `concat: ${r.stderr.trim()}`);
  return { frames: total, chromeVersion: chromeVersion || "(tutti i blocchi da cache)" };
}

/** Mux: video già codificato + WAV → AAC 48 kHz, faststart. Con `audio` null copia solo il video. */
export function mux(video: string, audio: string | null, out: string, duration: number, log: (c: string) => void): void {
  const args = audio
    ? ["-hide_banner", "-y", "-loglevel", "error", "-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", duration.toFixed(3), "-movflags", "+faststart", out]
    : ["-hide_banner", "-y", "-loglevel", "error", "-i", video, "-c:v", "copy", "-an", "-movflags", "+faststart", out];
  log(`ffmpeg ${args.map(quote).join(" ")}`);
  const r = spawnSync("ffmpeg", args, { encoding: "utf8", windowsHide: true });
  if (r.status !== 0) throw new EngineError("E_ENCODE", `mux: ${r.stderr.trim()}`);
}
