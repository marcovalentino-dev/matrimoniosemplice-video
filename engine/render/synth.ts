import { spawnSync } from "node:child_process";
import { EngineError } from "../utils/errors.ts";

/**
 * Musica sintetizzata in codice con ffmpeg (sinusoidi): nessun campione né brano di terzi, quindi nessuna licenza da registrare.
 * Un tappeto caldo e minimale: quattro accordi (Cmaj7, Am7, Fmaj7, G6) da quattro battiti l'uno, con basso, tremolo lento e un po' di eco.
 */
const CHORDS: { notes: number[]; bass: number }[] = [
  { notes: [261.63, 329.63, 392.0, 493.88], bass: 65.41 }, // Cmaj7
  { notes: [220.0, 261.63, 329.63, 392.0], bass: 55.0 }, // Am7
  { notes: [174.61, 220.0, 261.63, 329.63], bass: 87.31 }, // Fmaj7
  { notes: [196.0, 246.94, 293.66, 329.63], bass: 98.0 }, // G6
];

export const SYNTH_LICENSE = "sintetizzata in codice (render/synth.ts), nessun campione di terzi";

/** Argomenti di ffmpeg che producono `duration` secondi di musica sintetica a `bpm`. Esportata per i test. */
export function synthArgs(bpm: number, duration: number, out: string): string[] {
  const beat = 60 / Math.min(160, Math.max(50, bpm));
  const bar = beat * 4;
  const n = Math.ceil(duration / bar) + 1;
  const inputs: string[] = [];
  const graph: string[] = [];
  let idx = 0;
  const labels: string[] = [];
  for (let k = 0; k < n; k++) {
    const c = CHORDS[k % CHORDS.length]!;
    // ogni accordo dura una battuta più una piccola coda, così i fade si sovrappongono senza buchi
    const len = bar + 0.25;
    const ins: string[] = [];
    for (const [i, f] of [...c.notes, c.bass].entries()) {
      inputs.push("-f", "lavfi", "-i", `sine=frequency=${f}:sample_rate=48000:duration=${len.toFixed(3)}`);
      graph.push(`[${idx}:a]volume=${i === c.notes.length ? 0.9 : 0.28}[v${idx}]`);
      ins.push(`[v${idx}]`);
      idx++;
    }
    graph.push(`${ins.join("")}amix=inputs=${ins.length}:normalize=0,afade=t=in:st=0:d=0.35,afade=t=out:st=${(len - 0.35).toFixed(3)}:d=0.35,adelay=${Math.round(k * bar * 1000)}:all=1[c${k}]`);
    labels.push(`[c${k}]`);
  }
  graph.push(`${labels.join("")}amix=inputs=${n}:normalize=0,tremolo=f=0.25:d=0.25,aecho=0.8:0.6:380:0.25,lowpass=f=1800,aresample=48000,aformat=channel_layouts=stereo[out]`);
  return ["-hide_banner", "-y", "-loglevel", "error", ...inputs, "-filter_complex", graph.join(";"), "-map", "[out]", "-t", duration.toFixed(3), "-ar", "48000", "-ac", "2", out];
}

export function synthMusic(o: { bpm: number; duration: number; out: string; log: (cmd: string) => void }): void {
  const args = synthArgs(o.bpm, o.duration, o.out);
  o.log(`ffmpeg ${args.filter((a) => !a.startsWith("sine=")).join(" ").slice(0, 400)}…   # ${args.filter((a) => a.startsWith("sine=")).length} sinusoidi`);
  const r = spawnSync("ffmpeg", args, { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new EngineError("E_AUDIO", `sintesi: ${(r.stderr ?? "").split(/\r?\n/).slice(-4).join(" ").trim()}`);
}
