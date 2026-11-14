import { EngineError } from "../utils/errors.ts";
import { run } from "../utils/proc.ts";

export interface Probe {
  durationSec: number;
  w: number;
  h: number;
  fps: number;
  vcodec: string;
  pixFmt: string;
  acodec: string | null;
  sampleRate: number | null;
  audioDurationSec: number | null;
  frames: number | null;
}

const rate = (r: string) => {
  const [a, b] = r.split("/").map(Number);
  return b ? a / b : a;
};

/** ffprobe: durata, risoluzione, fps e codec reali del file (CLAUDE.md: nessun video è "finito" senza questo). */
export function probe(file: string): Probe {
  const r = run("ffprobe", ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", file], 120000);
  if (!r.ok) throw new EngineError("E_ENCODE", `ffprobe non legge ${file}: ${r.stderr.trim()}`);
  const j = JSON.parse(r.stdout) as { streams: Record<string, string>[]; format: { duration: string } };
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  if (!v) throw new EngineError("E_ENCODE", `${file}: nessuno stream video.`);
  return {
    durationSec: Number(j.format.duration),
    w: Number(v.width),
    h: Number(v.height),
    fps: rate(v.avg_frame_rate),
    vcodec: v.codec_name,
    pixFmt: v.pix_fmt,
    acodec: a?.codec_name ?? null,
    sampleRate: a ? Number(a.sample_rate) : null,
    audioDurationSec: a?.duration ? Number(a.duration) : null,
    frames: v.nb_read_frames ? Number(v.nb_read_frames) : null,
  };
}
