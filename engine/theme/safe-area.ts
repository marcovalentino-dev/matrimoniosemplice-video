import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./tokens.ts";

export type FormatId = "9:16" | "16:9";

/**
 * Margini della safe area: PROPOSTA di brand/BRAND_VIDEO.md §7, non ancora verificata
 * contro Reel/TikTok/Shorts. Le dimensioni del canvas vengono da engine.config.json.
 */
const MARGINS: Record<FormatId, { left: number; right: number; top: number; bottom: number }> = {
  "9:16": { left: 64, right: 64, top: 220, bottom: 340 },
  "16:9": { left: 96, right: 96, top: 54, bottom: 54 },
};

export interface SafeArea {
  format: FormatId;
  w: number;
  h: number;
  fps: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Rettangolo sicuro: origine e dimensioni. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FORMAT_IDS: FormatId[] = ["9:16", "16:9"];

export function safeArea(format: FormatId): SafeArea {
  const cfg = JSON.parse(readFileSync(path.join(ROOT, "engine", "engine.config.json"), "utf8"));
  const f = cfg.formats[format] as { w: number; h: number; fps: number };
  const m = MARGINS[format];
  return {
    format, w: f.w, h: f.h, fps: f.fps, ...m,
    x: m.left, y: m.top, width: f.w - m.left - m.right, height: f.h - m.top - m.bottom,
  };
}

/** True se il rettangolo sta interamente dentro la safe area. */
export function insideSafeArea(sa: SafeArea, r: { x: number; y: number; width: number; height: number }): boolean {
  return r.x >= sa.x && r.y >= sa.y && r.x + r.width <= sa.x + sa.width && r.y + r.height <= sa.y + sa.height;
}
