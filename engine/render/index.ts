import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { StoryboardSchema, type Storyboard } from "../schemas/storyboard.ts";
import { BriefSchema } from "../schemas/brief.ts";
import { ROOT } from "../theme/tokens.ts";
import { EngineError } from "../utils/errors.ts";
import { run } from "../utils/proc.ts";
import { loadIndex, mixMusic, selectTrack, type Loudness, type Selection } from "./audio.ts";
import { prepareShots } from "./compose.ts";
import { probe, type Probe } from "./probe.ts";
import { SYNTH_LICENSE, synthMusic } from "./synth.ts";
import { FINAL, PREVIEW, mux, renderVideo } from "./video.ts";

export { composeFrame, prepareShots } from "./compose.ts";
export { selectTrack, loadIndex } from "./audio.ts";

const ENGINE = path.join(ROOT, "engine");
export const PLACEHOLDER = /\[[A-ZÀ-Ü][A-ZÀ-Ü0-9 _-]*\]/;
const sha = (b: string | Buffer) => "sha256:" + createHash("sha256").update(b).digest("hex");

export interface RenderOptions {
  /** Percorso di storyboard.json oppure della cartella che lo contiene. */
  input: string;
  /** Cartella di output (default: la cartella dello storyboard). */
  outDir?: string;
  preview?: boolean;
  final?: boolean;
  /** Forza l'export senza audio. */
  noAudio?: boolean;
  workers?: number;
  /** Radice di assets/audio (per i test). */
  audioDir?: string;
  progress?: (stage: string, done: number, total: number) => void;
}

export interface RenderResult {
  outDir: string;
  manifestFile: string;
  manifest: Manifest;
  previewFile: string | null;
  videoFile: string | null;
  commands: string[];
}

export interface Manifest {
  version: 1;
  slug: string;
  status: "final" | "draft" | "failed";
  createdAt: string;
  prompt: string | null;
  briefHash: string;
  storyboardHash: string;
  preview: { file: string; probe: Pick<Probe, "durationSec" | "w" | "h" | "fps"> } | null;
  output: { file: string; bytes: number; sha256: string; probe: Probe } | null;
  audio: {
    mode: "library" | "synth" | "none";
    reason: string | null;
    tracks: { id: string; titolo: string; file: string; licenza: string; fonte: string; attribuzione: string | null; looped: boolean; matchedTags: string[] }[];
    rejected: { id: string; reason: string }[];
    loudnessLUFS: number | null;
    truePeakDb: number | null;
    targetLUFS: number;
    fadeIn: number | null;
    fadeOut: number | null;
  };
  licenses: { fonts: { name: string; license: string; file: string }[]; music: string };
  placeholders: string[];
  warnings: string[];
  qa: { verdict: "not-run" | "pass" | "warn" | "fail" | "error"; score?: number | null; rounds?: number; report?: string };
  timing: { totalSec: number; stages: Record<string, number> };
  versions: { engine: string; node: string; ffmpeg: string; chrome: string };
  commands: string[];
}

function readStoryboard(input: string): { file: string; text: string; sb: Storyboard } {
  const file = existsSync(input) && statSync(input).isDirectory() ? path.join(input, "storyboard.json") : input;
  if (!existsSync(file)) throw new EngineError("E_SCHEMA", `Storyboard non trovato: ${file}`);
  const text = readFileSync(file, "utf8");
  const parsed = StoryboardSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new EngineError("E_SCHEMA", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return { file, text, sb: parsed.data };
}

/** Controlli che il render dà per scontati: formato, fps, continuità degli shot. */
function checkStoryboard(sb: Storyboard, formats: Record<string, { w: number; h: number; fps: number }>): void {
  const f = formats[sb.format];
  if (!f || sb.size.w !== f.w || sb.size.h !== f.h || sb.fps !== f.fps) {
    throw new EngineError("E_SCHEMA", `${sb.format} deve essere ${f?.w}x${f?.h} a ${f?.fps} fps (trovato ${sb.size.w}x${sb.size.h} a ${sb.fps} fps).`);
  }
  const eps = 1e-6;
  if (Math.abs(sb.shots[0].start) > eps) throw new EngineError("E_SCHEMA", "Il primo shot deve iniziare a 0.");
  sb.shots.forEach((s, i) => {
    if (s.end <= s.start) throw new EngineError("E_SCHEMA", `${s.id}: end <= start.`);
    if (i > 0 && Math.abs(s.start - sb.shots[i - 1].end) > eps) throw new EngineError("E_SCHEMA", `${s.id}: start (${s.start}) != end dello shot precedente (${sb.shots[i - 1].end}).`);
  });
  const last = sb.shots[sb.shots.length - 1];
  if (Math.abs(last.end - sb.durationSec) > eps) throw new EngineError("E_SCHEMA", `L'ultimo shot finisce a ${last.end} s, durationSec è ${sb.durationSec} s.`);
}

function ffmpegVersion(): string {
  const r = run("ffmpeg", ["-version"]);
  return r.stdout.split(/\r?\n/)[0]?.match(/version (\S+)/)?.[1] ?? "?";
}

/** Verifica con ffprobe ciò che CLAUDE.md richiede prima di dichiarare finito un video. */
export function verifyProbe(p: Probe, sb: Storyboard, expectAudio: boolean): string[] {
  const bad: string[] = [];
  if (Math.abs(p.durationSec - sb.durationSec) > 0.1) bad.push(`durata ${p.durationSec.toFixed(3)} s invece di ${sb.durationSec} s`);
  if (p.w !== sb.size.w || p.h !== sb.size.h) bad.push(`risoluzione ${p.w}x${p.h} invece di ${sb.size.w}x${sb.size.h}`);
  if (Math.abs(p.fps - sb.fps) > 0.01) bad.push(`${p.fps} fps invece di ${sb.fps}`);
  if (p.vcodec !== "h264") bad.push(`codec video ${p.vcodec}`);
  if (p.pixFmt !== "yuv420p") bad.push(`pix_fmt ${p.pixFmt}`);
  if (expectAudio && (p.acodec !== "aac" || p.sampleRate !== 48000)) bad.push(`audio atteso AAC 48 kHz, trovato ${p.acodec} ${p.sampleRate}`);
  if (!expectAudio && p.acodec) bad.push(`audio inatteso (${p.acodec})`);
  if (p.frames !== null && p.frames !== Math.round(sb.durationSec * sb.fps)) bad.push(`${p.frames} fotogrammi invece di ${Math.round(sb.durationSec * sb.fps)}`);
  return bad;
}

/** Da storyboard.json a preview.mp4 e video.mp4 con audio mixato, più manifest.json. */
export async function renderStoryboard(opts: RenderOptions): Promise<RenderResult> {
  const t0 = Date.now();
  const stages: Record<string, number> = {};
  const timed = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
    const s = Date.now();
    try {
      return await fn();
    } finally {
      stages[name] = Math.round((Date.now() - s) / 100) / 10;
    }
  };

  const cfg = JSON.parse(readFileSync(path.join(ENGINE, "engine.config.json"), "utf8")) as {
    formats: Record<string, { w: number; h: number; fps: number }>;
    audio: { targetLUFS: number; truePeakDb: number };
  };
  const { file: sbFile, text: sbText, sb } = readStoryboard(opts.input);
  checkStoryboard(sb, cfg.formats);

  const dir = path.dirname(sbFile);
  const outDir = path.resolve(opts.outDir ?? dir);
  const work = path.join(outDir, ".work");
  mkdirSync(work, { recursive: true });

  const briefFile = path.join(dir, "brief.json");
  const brief = existsSync(briefFile) ? BriefSchema.safeParse(JSON.parse(readFileSync(briefFile, "utf8"))) : null;
  const slug = brief?.success ? brief.data.slug : path.basename(outDir);

  const commands: string[] = [];
  const log = (c: string) => commands.push(c);
  const warnings: string[] = [];
  const tick = (stage: string) => (done: number, total: number) => opts.progress?.(stage, done, total);

  const shots = await prepareShots(sb);
  for (const p of shots) {
    const min = p.scene.duration(p.props).min;
    if (p.dur + 1e-6 < min) warnings.push(`${p.shot.id} (${p.shot.scene}): dura ${p.dur} s, il minimo della scena è ${min} s`);
  }
  const placeholders = JSON.stringify(sb.shots.map((s) => s.props)).match(new RegExp(PLACEHOLDER.source, "g")) ?? [];

  // ---- Audio ----
  const audioDir = opts.audioDir ?? path.join(ROOT, "assets", "audio");
  let sel: Selection;
  const audioWanted = brief?.success ? brief.data.audio : sb.music ? "synth" : "none";
  let synth = false;
  if (opts.noAudio) sel = { track: null, reason: "audio disattivato (--no-audio)", rejected: [] };
  else if (audioWanted === "none") sel = { track: null, reason: brief?.success ? "brief.audio = none" : "lo storyboard non chiede musica", rejected: [] };
  else if (audioWanted === "synth") {
    sel = { track: null, reason: "musica sintetizzata in codice", rejected: [] };
    synth = true;
  } else {
    const { index, reason } = loadIndex(audioDir);
    sel = selectTrack(index, sb.music, sb.durationSec, audioDir);
    if (reason) sel.reason = `${reason}; ${sel.reason}`;
  }
  let loud: Loudness | null = null;
  let mixFile: string | null = null;
  const mixCommon = { duration: sb.durationSec, fadeIn: sb.music?.fadeIn ?? 1, fadeOut: sb.music?.fadeOut ?? 2, targetLUFS: cfg.audio.targetLUFS, truePeakDb: cfg.audio.truePeakDb, log };
  if (synth) {
    mixFile = path.join(work, "mix.wav");
    const raw = path.join(work, "synth.wav");
    loud = await timed("audio", () => {
      synthMusic({ bpm: sb.music?.bpm ?? 96, duration: sb.durationSec, out: raw, log });
      return mixMusic({ ...mixCommon, src: raw, out: mixFile! });
    });
  } else if (sel.track) {
    mixFile = path.join(work, "mix.wav");
    const track = sel.track;
    loud = await timed("audio", () => mixMusic({ ...mixCommon, track, audioDir, out: mixFile!, fadeIn: sb.music?.fadeIn ?? 0, fadeOut: sb.music?.fadeOut ?? 0 }));
  }
  if (loud) {
    if (Math.abs(loud.integratedLUFS - cfg.audio.targetLUFS) > 1) warnings.push(`loudness ${loud.integratedLUFS} LUFS, target ${cfg.audio.targetLUFS} ±1`);
    if (loud.truePeakDb > cfg.audio.truePeakDb + 0.3) warnings.push(`true peak ${loud.truePeakDb} dBTP oltre ${cfg.audio.truePeakDb}`);
  } else {
    warnings.push(`ESPORTATO SENZA AUDIO: ${sel.reason}`);
  }

  // ---- Video ----
  const workers = opts.workers ?? 3;
  let previewFile: string | null = null;
  let previewProbe: Probe | null = null;
  let chrome = "?";
  if (opts.preview !== false) {
    const silent = path.join(work, "preview-silent.mp4");
    const r = await timed("preview", () =>
      renderVideo({ sb, shots, profile: { ...PREVIEW, fps: 15 }, out: silent, workDir: work, workers, log, progress: tick("anteprima") }),
    );
    chrome = r.chromeVersion;
    previewFile = path.join(outDir, "preview.mp4");
    mux(silent, mixFile, previewFile, sb.durationSec, log);
    previewProbe = probe(previewFile);
  }

  let videoFile: string | null = null;
  let output: Manifest["output"] = null;
  let status: Manifest["status"] = "failed";
  if (opts.final !== false) {
    const silent = path.join(work, "video-silent.mp4");
    const r = await timed("final", () =>
      renderVideo({ sb, shots, profile: { ...FINAL, fps: sb.fps }, out: silent, workDir: work, workers, log, progress: tick("finale") }),
    );
    chrome = r.chromeVersion;
    const draft = placeholders.length > 0;
    videoFile = path.join(outDir, draft ? "video-DRAFT.mp4" : "video.mp4");
    mux(silent, mixFile, videoFile, sb.durationSec, log);
    const p = probe(videoFile);
    const bad = verifyProbe(p, sb, !!mixFile);
    output = { file: path.basename(videoFile), bytes: statSync(videoFile).size, sha256: sha(readFileSync(videoFile)), probe: p };
    if (bad.length) warnings.push(`ffprobe: ${bad.join("; ")}`);
    status = bad.length ? "failed" : draft ? "draft" : "final";
  }

  const manifest: Manifest = {
    version: 1,
    slug,
    status,
    createdAt: new Date().toISOString(),
    prompt: brief?.success ? brief.data.prompt : null,
    briefHash: sb.briefHash,
    storyboardHash: sha(sbText),
    preview: previewProbe && previewFile ? { file: path.basename(previewFile), probe: { durationSec: previewProbe.durationSec, w: previewProbe.w, h: previewProbe.h, fps: previewProbe.fps } } : null,
    output,
    audio: {
      mode: synth ? "synth" : sel.track ? "library" : "none",
      reason: mixFile ? null : sel.reason,
      tracks: sel.track
        ? [{ id: sel.track.id, titolo: sel.track.titolo, file: `assets/audio/${sel.track.file}`, licenza: sel.track.licenza, fonte: sel.track.fonte, attribuzione: sel.track.attribuzione ?? null, looped: !!sel.looped, matchedTags: sel.matchedTags ?? [] }]
        : [],
      rejected: sel.rejected,
      loudnessLUFS: loud?.integratedLUFS ?? null,
      truePeakDb: loud?.truePeakDb ?? null,
      targetLUFS: cfg.audio.targetLUFS,
      fadeIn: mixFile ? mixCommon.fadeIn : null,
      fadeOut: mixFile ? mixCommon.fadeOut : null,
    },
    licenses: {
      fonts: [
        { name: "Playfair Display", license: "OFL-1.1", file: "assets/fonts/playfair-display/OFL.txt" },
        { name: "Inter", license: "OFL-1.1", file: "assets/fonts/inter/OFL.txt" },
      ],
      music: synth ? SYNTH_LICENSE : sel.track ? `${sel.track.licenza} — ${sel.track.fonte}` : "nessuna musica",
    },
    placeholders: [...new Set(placeholders)],
    warnings,
    qa: { verdict: "not-run" },
    timing: { totalSec: Math.round((Date.now() - t0) / 100) / 10, stages },
    versions: { engine: "0.1.0", node: process.versions.node, ffmpeg: ffmpegVersion(), chrome },
    commands,
  };
  const manifestFile = path.join(outDir, "manifest.json");
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  if (status === "failed") throw new EngineError("E_ENCODE", `Verifica ffprobe fallita: ${warnings.filter((w) => w.startsWith("ffprobe")).join(" ")}`);
  return { outDir, manifestFile, manifest, previewFile, videoFile, commands };
}
