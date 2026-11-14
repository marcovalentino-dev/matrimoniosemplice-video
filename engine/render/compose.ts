import type { Shot, Storyboard } from "../schemas/storyboard.ts";
import { getScene, makeCtx, prepareProps, renderFrame, type AnyScene, type SceneCtx } from "../scenes/index.ts";
import type { FormatId } from "../theme/safe-area.ts";

/** Uno shot pronto al render: scena, props validate e risolte, contesto, tempi. */
export interface PreparedShot {
  shot: Shot;
  scene: AnyScene;
  props: unknown;
  ctx: SceneCtx;
  start: number;
  end: number;
  dur: number;
}

export async function prepareShots(sb: Storyboard): Promise<PreparedShot[]> {
  const out: PreparedShot[] = [];
  for (const shot of sb.shots) {
    const scene = getScene(shot.scene);
    const props = await prepareProps(scene, shot.props);
    const dur = shot.end - shot.start;
    out.push({ shot, scene, props, ctx: makeCtx(sb.format as FormatId, dur), start: shot.start, end: shot.end, dur });
  }
  return out;
}

/** Shot attivo al tempo `t`: start <= t < end (l'ultimo include `end`). */
export function activeIndex(shots: PreparedShot[], t: number): number {
  for (let i = shots.length - 1; i >= 0; i--) if (t >= shots[i].start - 1e-9) return i;
  return 0;
}

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Easing in/out morbido (BRAND_VIDEO §5: niente rimbalzi). */
const ease = (p: number) => p * p * (3 - 2 * p);

function layer(ps: PreparedShot, localT: number, style: string): string {
  const t = Math.min(Math.max(localT, 0), ps.dur);
  return `<div style="position:absolute;left:0;top:0;width:${ps.ctx.w}px;height:${ps.ctx.h}px;${style}">${renderFrame(ps.scene, ps.props, t, ps.ctx)}</div>`;
}

/** Zoom della camera dello shot al tempo locale (un solo movimento, ≤ 8%: lo impone lo schema). */
export function cameraScale(ps: PreparedShot, localT: number): number {
  const cam = ps.shot.camera;
  if (!cam || cam.move === "none") return 1;
  const amount = cam.amount ?? 0.04;
  const p = ease(clamp01(localT / ps.dur));
  return cam.move === "pushIn" ? 1 + amount * p : 1 + amount * (1 - p);
}

/**
 * HTML di un fotogramma del video al tempo globale `t`.
 * Transizioni (BRAND_VIDEO §5): lo shot entrante si compone sopra l'uscente, che resta sull'ultimo fotogramma;
 * il tempo dello shot non si sovrappone mai, quindi `end(n) == start(n+1)` resta vero.
 */
export function composeFrame(shots: PreparedShot[], t: number): string {
  const i = activeIndex(shots, t);
  const cur = shots[i];
  const lt = t - cur.start;
  const curStyle = (extra = "") => `transform:scale(${n(cameraScale(cur, lt))});transform-origin:50% 50%;${extra}`;
  const tr = cur.shot.transitionIn;
  const p = tr ? clamp01(lt / tr.dur) : 1;
  if (!tr || p >= 1) return layer(cur, lt, curStyle());

  const e = ease(p);
  const prev = i > 0 ? shots[i - 1] : null;
  const cream = `<div style="position:absolute;inset:0;background:var(--c-cream);opacity:${n(1 - e)}"></div>`;
  if (!prev || tr.type === "fromCream") {
    // Da/verso cream: il cream copre lo shot e si dissolve. Il primo shot parte sempre dal cream.
    return layer(cur, lt, curStyle()) + cream;
  }
  const prevLayer = (extra: string) => layer(prev, prev.dur, `transform:scale(${n(cameraScale(prev, prev.dur))});${extra}`);
  if (tr.type === "slide") {
    // Scorrimento morbido: lo shot entrante arriva da destra per il 6% della larghezza, mentre dissolve.
    const dx = (1 - e) * cur.ctx.w * 0.06;
    return prevLayer("") + layer(cur, lt, curStyle(`opacity:${n(e)};translate:${n(dx)}px 0;`));
  }
  return prevLayer("") + layer(cur, lt, curStyle(`opacity:${n(e)};`)); // dissolve
}
