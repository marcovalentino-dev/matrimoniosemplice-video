import type { Probe } from "../render/probe.ts";

export type Severity = "major" | "minor";

export interface Expected {
  durationSec: number;
  toleranceSec: number;
  w: number;
  h: number;
  fps: number;
  audio: "none" | "synth" | "library";
  /** Da dove vengono i valori attesi. */
  from: "brief.json" | "storyboard.json";
}

export interface ProbeProblem {
  severity: Severity;
  what: string;
}

export interface ProbeCheck {
  ok: boolean;
  problems: ProbeProblem[];
  expected: Expected;
  actual: Probe;
}

/**
 * Livello 6a (SPEC §8.2): ffprobe contro il brief. Durata ±0,1 s, risoluzione, fps, H.264/yuv420p,
 * numero di fotogrammi e audio. Un video muto con `audio: synth|library` è un avviso, non un blocco:
 * senza tracce con licenza il motore esporta senza audio e lo dichiara nel manifest (SPEC §8.1).
 */
export function checkProbe(p: Probe, e: Expected, silentReason?: string | null): ProbeCheck {
  const problems: ProbeProblem[] = [];
  const major = (what: string) => problems.push({ severity: "major", what });
  if (Math.abs(p.durationSec - e.durationSec) > e.toleranceSec) major(`durata ${p.durationSec.toFixed(3)} s invece di ${e.durationSec} s (±${e.toleranceSec} s)`);
  if (p.w !== e.w || p.h !== e.h) major(`risoluzione ${p.w}x${p.h} invece di ${e.w}x${e.h}`);
  if (Math.abs(p.fps - e.fps) > 0.01) major(`${p.fps} fps invece di ${e.fps}`);
  if (p.vcodec !== "h264") major(`codec video ${p.vcodec} invece di h264`);
  if (p.pixFmt !== "yuv420p") major(`pix_fmt ${p.pixFmt} invece di yuv420p`);
  const frames = Math.round(e.durationSec * e.fps);
  if (p.frames !== null && p.frames !== frames) major(`${p.frames} fotogrammi invece di ${frames}`);
  if (e.audio === "none" && p.acodec) major(`il brief dice audio: none ma il file ha una traccia ${p.acodec}`);
  if (e.audio !== "none") {
    if (!p.acodec) problems.push({ severity: "minor", what: `il brief chiede audio (${e.audio}) ma il file è muto${silentReason ? `: ${silentReason}` : ""}` });
    else if (p.acodec !== "aac" || p.sampleRate !== 48000) major(`audio ${p.acodec} ${p.sampleRate} Hz invece di AAC 48000 Hz`);
    else if (p.audioDurationSec !== null && Math.abs(p.audioDurationSec - p.durationSec) > 0.25) major(`l'audio dura ${p.audioDurationSec.toFixed(2)} s, il video ${p.durationSec.toFixed(2)} s`);
  }
  return { ok: !problems.some((x) => x.severity === "major"), problems, expected: e, actual: p };
}
