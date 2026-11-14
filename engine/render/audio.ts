import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { EngineError } from "../utils/errors.ts";

/** Una traccia dell'indice `assets/audio/index.json` (SPEC §8.1). */
export const AudioTrackSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  titolo: z.string().default(""),
  durata: z.number().positive(),
  bpm: z.number().positive().optional(),
  tag: z.array(z.string()).default([]),
  licenza: z.string().default(""),
  fonte: z.string().default(""),
  attribuzione: z.string().optional(),
});
export type AudioTrack = z.infer<typeof AudioTrackSchema>;

/** L'indice è `{ "tracks": [...] }` oppure direttamente un array. */
export const AudioIndexSchema = z.union([z.object({ tracks: z.array(z.unknown()) }).transform((o) => o.tracks), z.array(z.unknown())]);

const PLACEHOLDER = /^(todo|tbd|n\/?a|\?+|-+|da verificare|da compilare|sconosciut[ao]|unknown)$/i;

/** Una traccia è utilizzabile solo se licenza e fonte sono compilate (non segnaposto) e il file esiste. */
export function licenseProblem(t: AudioTrack, audioDir: string): string | null {
  if (!t.licenza.trim() || PLACEHOLDER.test(t.licenza.trim())) return "licenza non registrata";
  if (!t.fonte.trim() || PLACEHOLDER.test(t.fonte.trim())) return "fonte non registrata";
  if (!existsSync(path.join(audioDir, t.file))) return `file mancante (${t.file})`;
  return null;
}

export interface MusicRequest {
  mood: string;
  bpm?: number;
  fadeIn: number;
  fadeOut: number;
}

export interface Selection {
  track: AudioTrack | null;
  /** Perché non c'è audio (se `track` è null) o come è stata scelta la traccia. */
  reason: string;
  rejected: { id: string; reason: string }[];
  score?: number;
  matchedTags?: string[];
  looped?: boolean;
}

const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Sceglie la traccia dall'indice: scarta quelle senza licenza registrata, poi ordina per tag in comune
 * con `mood` (almeno uno), vicinanza di bpm e durata sufficiente; a pari punteggio vince l'id minore (deterministico).
 */
export function selectTrack(index: unknown, music: MusicRequest | undefined, videoDur: number, audioDir: string): Selection {
  const none = (reason: string, rejected: Selection["rejected"] = []): Selection => ({ track: null, reason, rejected });
  if (!music) return none("lo storyboard non chiede musica (nessun campo `music`)");
  const raw = AudioIndexSchema.safeParse(index);
  if (!raw.success) return none("indice audio non valido");
  const rejected: Selection["rejected"] = [];
  const usable: AudioTrack[] = [];
  for (const r of raw.data) {
    const p = AudioTrackSchema.safeParse(r);
    if (!p.success) {
      rejected.push({ id: String((r as { id?: unknown })?.id ?? "?"), reason: "voce dell'indice non valida" });
      continue;
    }
    const problem = licenseProblem(p.data, audioDir);
    if (problem) rejected.push({ id: p.data.id, reason: problem });
    else usable.push(p.data);
  }
  if (!usable.length) return none(raw.data.length ? "nessuna traccia con licenza registrata" : "l'indice audio è vuoto", rejected);

  const want = new Set([...words(music.mood), music.mood.toLowerCase().trim()]);
  const scored = usable
    .map((t) => {
      const matched = t.tag.map((x) => x.toLowerCase().trim()).filter((x) => want.has(x) || words(x).some((w) => want.has(w)));
      const bpmBonus = music.bpm && t.bpm ? 0.5 * (1 - Math.min(1, Math.abs(music.bpm - t.bpm) / 40)) : 0;
      const durBonus = t.durata >= videoDur ? 0.25 : 0;
      return { t, matched, score: matched.length + bpmBonus + durBonus };
    })
    .filter((x) => x.matched.length > 0)
    .sort((a, b) => b.score - a.score || a.t.id.localeCompare(b.t.id));
  if (!scored.length) return none(`nessuna traccia con tag compatibili con "${music.mood}"`, rejected);
  const best = scored[0];
  return { track: best.t, reason: "scelta per tag", rejected, score: best.score, matchedTags: best.matched, looped: best.t.durata < videoDur };
}

export function loadIndex(audioDir: string): { index: unknown; reason: string | null } {
  const f = path.join(audioDir, "index.json");
  if (!existsSync(f)) return { index: [], reason: "assets/audio/index.json non esiste" };
  try {
    return { index: JSON.parse(readFileSync(f, "utf8")), reason: null };
  } catch (e) {
    return { index: [], reason: `assets/audio/index.json illeggibile: ${(e as Error).message}` };
  }
}

export interface Loudness {
  integratedLUFS: number;
  truePeakDb: number;
  lra: number;
}

interface LoudnormJson {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

const quote = (a: string) => (/[\s|;=\[\]]/.test(a) ? `"${a}"` : a);

function ffmpeg(args: string[], log: (c: string) => void): string {
  log(`ffmpeg ${args.map(quote).join(" ")}`);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-y", ...args], { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new EngineError("E_AUDIO", `ffmpeg: ${(r.stderr ?? "").split(/\r?\n/).slice(-6).join(" ").trim()}`);
  return r.stderr ?? "";
}

function parseLoudnorm(stderr: string): LoudnormJson {
  const m = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) throw new EngineError("E_AUDIO", "loudnorm non ha restituito le misure.");
  return JSON.parse(m[0]) as LoudnormJson;
}

/** Misura loudness integrato e true peak di un file (ffmpeg loudnorm, solo analisi). */
export function measure(file: string, log: (c: string) => void): Loudness {
  const j = parseLoudnorm(ffmpeg(["-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-"], log));
  return { integratedLUFS: Number(j.input_i), truePeakDb: Number(j.input_tp), lra: Number(j.input_lra) };
}

export interface MixOptions {
  /** Traccia della libreria... */
  track?: AudioTrack;
  audioDir?: string;
  /** ...oppure un file già pronto (la musica sintetizzata). */
  src?: string;
  out: string;
  duration: number;
  fadeIn: number;
  fadeOut: number;
  targetLUFS: number;
  truePeakDb: number;
  log: (cmd: string) => void;
}

/**
 * Mix della musica: loop se più corta del video, taglio alla durata esatta, fade in/out, loudnorm a due passate
 * (misura, poi correzione lineare) e WAV 48 kHz stereo.
 */
export function mixMusic(o: MixOptions): Loudness {
  const src = o.src ?? path.join(o.audioDir!, o.track!.file);
  const fi = Math.min(o.fadeIn, o.duration / 2);
  const fo = Math.min(o.fadeOut, o.duration / 2);
  const d = o.duration.toFixed(3);
  const fades = [fi > 0 ? `afade=t=in:st=0:d=${fi}` : "", fo > 0 ? `afade=t=out:st=${(o.duration - fo).toFixed(3)}:d=${fo}` : ""].filter(Boolean);
  const input = ["-stream_loop", "-1", "-i", src, "-t", d];
  const target = `I=${o.targetLUFS}:TP=${o.truePeakDb}:LRA=11`;
  const pre = [...fades, `loudnorm=${target}:print_format=json`].join(",");
  const m = parseLoudnorm(ffmpeg([...input, "-af", pre, "-f", "null", "-"], o.log));
  const post = [
    ...fades,
    `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
    "aresample=48000",
  ].join(",");
  ffmpeg([...input, "-af", post, "-ar", "48000", "-ac", "2", o.out], o.log);
  return measure(o.out, o.log);
}
