// Componenti e CSS condivisi dalle scene. Solo token del brand (colori da var(--c-*), font da fontStack).
import { readFileSync } from "node:fs";
import path from "node:path";
import { ORB_NAMES, ROOT, color, type TextureName } from "../../theme/tokens.ts";
import { fontStack } from "../../theme/fonts.ts";
import { textureHtml } from "../../theme/effects.ts";
import { ease, lerp, n, seg, reveal } from "./anim.ts";
import { esc, richText } from "./html.ts";
import type { SceneCtx } from "./types.ts";

/** rgba derivato da un colore del brand (l'hex resta quello del token). */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

export const SHARED_CSS = `
.abs{position:absolute}
.serif{font-family:${fontStack.heading}}
.sans{font-family:${fontStack.body}}
.hd{font-family:${fontStack.heading};color:var(--c-ink);margin:0;font-weight:600;line-height:1.1}
.eb{font-family:${fontStack.body};font-weight:600;text-transform:uppercase;letter-spacing:.18em;color:var(--c-champagne);line-height:1.25;margin:0}
.bd{font-family:${fontStack.body};font-weight:400;color:var(--c-muted);line-height:1.5;margin:0}
.ripple{position:absolute;border-radius:50%;background:${rgba(color.blush, 0.55)};pointer-events:none}
.pillbtn{font-family:${fontStack.body};font-weight:600;letter-spacing:.04em;text-align:center;display:flex;align-items:center;justify-content:center;border-radius:var(--r-pill);background:var(--c-blush);color:var(--c-ink);box-shadow:var(--sh-blush);white-space:nowrap}
.skl{background:var(--c-parchment);border-radius:8px}
.ph-body{position:absolute;inset:0;border-radius:78px;background:var(--c-ink);box-shadow:0 18px 60px ${rgba(color.ink, 0.18)}}
.ph-screen{position:absolute;left:16px;top:16px;width:518px;height:968px;border-radius:62px;overflow:hidden;background:var(--c-cream)}
.ph-status{position:absolute;left:0;top:0;width:518px;height:110px;z-index:5;background:linear-gradient(180deg,var(--c-cream) 0%,var(--c-cream) 62%,${rgba(color.cream, 0)} 100%)}
`;

/** Orbi ambientali con deriva lentissima (BRAND_VIDEO §2). */
export function orbsLayer(t: number): string {
  const drift = [
    [Math.sin(t * 0.21) * 40, Math.cos(t * 0.17) * 30],
    [Math.cos(t * 0.19) * 40, Math.sin(t * 0.23) * 30],
    [Math.sin(t * 0.15 + 1) * 30, Math.cos(t * 0.2) * 40],
  ];
  return `<div class="orbs">${ORB_NAMES.map(
    (name, i) => `<div class="orb orb-${name}" style="transform:translate(calc(-50% + ${n(drift[i][0])}px),calc(-50% + ${n(drift[i][1])}px))"></div>`,
  ).join("")}</div>`;
}

export interface BackdropOpts {
  /** hero = sfondo coverHero del frame; cream/parchment = tinta unita. */
  bg?: "hero" | "cream" | "parchment";
  /** Una sola texture per inquadratura. Default: grana (1,8%). */
  texture?: TextureName;
}

/** Sfondo + orbi + contenuto + texture (la texture sta sopra, come carta). */
export function compose(t: number, o: BackdropOpts, content: string): string {
  const bg =
    o.bg === "cream" ? `<div class="abs" style="inset:0;background:var(--c-cream)"></div>` :
    o.bg === "parchment" ? `<div class="abs" style="inset:0;background:var(--c-parchment)"></div>` : "";
  return bg + orbsLayer(t) + content + textureHtml(o.texture ?? "grain");
}

// ---------- Icone (tratto semplice, 24x24) ----------

const ICON_PATHS = {
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  heart: `<path d="M12 20S4 14.8 4 9.2C4 6.4 6.1 4.6 8.4 4.6c1.6 0 3 .9 3.6 2.2.6-1.3 2-2.2 3.6-2.2 2.3 0 4.4 1.8 4.4 4.6C20 14.8 12 20 12 20z"/>`,
  calendar: `<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M8 3v4M16 3v4"/>`,
  gift: `<rect x="4" y="11" width="16" height="9" rx="2"/><rect x="3" y="7.5" width="18" height="3.5" rx="1.2"/><path d="M12 7.5V20M12 7.5c-1-3-5-3.2-5-1.2 0 1.4 3 1.2 5 1.2zM12 7.5c1-3 5-3.2 5-1.2 0 1.4-3 1.2-5 1.2z"/>`,
  users: `<circle cx="9" cy="8" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.2 14.2c2.8-.2 4.8 1.5 4.8 4.3"/>`,
  table: `<circle cx="12" cy="12" r="4"/><circle cx="12" cy="4.6" r="1.4"/><circle cx="12" cy="19.4" r="1.4"/><circle cx="4.6" cy="12" r="1.4"/><circle cx="19.4" cy="12" r="1.4"/>`,
  list: `<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>`,
  phone: `<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>`,
  link: `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
  clock: `<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>`,
  mail: `<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7.5l8.5 6 8.5-6"/>`,
} as const;
export type IconName = keyof typeof ICON_PATHS;
export const ICON_NAMES = Object.keys(ICON_PATHS) as [IconName, ...IconName[]];

export function icon(name: IconName, size: number, stroke: string = color.ink, sw = 1.8): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

/** Spunta che si disegna (p: 0..1). */
export function checkSvg(size: number, p: number, stroke: string = color.ink, sw = 9): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 150 150" aria-hidden="true"><path d="M44 78 L66 100 L108 52" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="110" stroke-dashoffset="${n(110 * (1 - ease(p)))}"/></svg>`;
}

/** Onda blush morbida (simulazione di tap) centrata in (x, y) dall'istante `at`. */
export function ripple(x: number, y: number, t: number, at: number, size = 120): string {
  const k = seg(t, at, at + 0.8);
  const o = k > 0 && k < 1 ? 0.7 * (1 - ease(k)) : 0;
  return `<div class="ripple" style="left:${n(x - size / 2)}px;top:${n(y - size / 2)}px;width:${size}px;height:${size}px;opacity:${n(o)};transform:scale(${n(lerp(0.35, 1.9, ease(k)))})"></div>`;
}

/** Etichetta Premium: obbligatoria su planning e tavoli (decisione 13, SPEC §16). */
export function premiumBadge(fs = 36): string {
  return `<span class="badge sans" style="font-size:${fs}px;font-weight:600;letter-spacing:.04em;color:var(--c-ink);line-height:1.2">Premium</span>`;
}

/** Bottone a pillola primario. `pressed` = sfondo rose (stato premuto). */
export function pill(label: string, o: { fs: number; w?: number; h: number; pressed?: number; extra?: string; raw?: boolean }): string {
  const bg = (o.pressed ?? 0) > 0.5 ? "var(--c-rose)" : "var(--c-blush)";
  return `<div class="pillbtn" style="font-size:${o.fs}px;${o.w ? `width:${o.w}px;` : ""}height:${o.h}px;background:${bg};${o.extra ?? ""}">${o.raw ? label : esc(label)}</div>`;
}

// ---------- Logo ----------

let logoSvg: string | null = null;
/** Logo del brand (assets/logo/icon.svg) inline: nessuna richiesta di rete, nessun file da caricare. */
export function logoHtml(size: number): string {
  logoSvg ??= readFileSync(path.join(ROOT, "assets", "logo", "icon.svg"), "utf8").replace(/<\?xml[^>]*>\s*/, "").trim();
  return logoSvg.replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `);
}

// ---------- Telefono ----------

export const PHONE = { w: 550, h: 1000, screenW: 518, screenH: 968 } as const;

export interface PhoneLayout {
  s: number;
  left: number;
  top: number;
  /** Area per il testo (headline) accanto o sopra il telefono. */
  text: { x: number; y: number; w: number; h: number; align: "center" | "left" };
}

/** Posiziona il telefono nella safe area: sopra il testo in 9:16, a destra del testo in 16:9. */
export function phoneLayout(ctx: SceneCtx, hasText: boolean): PhoneLayout {
  const sa = ctx.safe;
  if (!ctx.landscape) {
    const textH = hasText ? 270 : 0;
    const availH = sa.height - textH;
    const s = Math.min(availH / PHONE.h, sa.width / PHONE.w, 1.3);
    const pw = PHONE.w * s;
    return {
      s,
      left: sa.x + (sa.width - pw) / 2,
      top: sa.y + textH + (availH - PHONE.h * s) / 2,
      text: { x: sa.x, y: sa.y, w: sa.width, h: textH, align: "center" },
    };
  }
  const s = Math.min(sa.height / PHONE.h, 1);
  const pw = PHONE.w * s;
  const left = hasText ? sa.x + sa.width - pw - 24 : sa.x + (sa.width - pw) / 2;
  return {
    s,
    left,
    top: sa.y + (sa.height - PHONE.h * s) / 2,
    text: { x: sa.x, y: sa.y, w: Math.max(0, left - sa.x - 96), h: sa.height, align: "left" },
  };
}

/** Telefono con schermo (coordinate dello schermo: 518x968). Entra con dissolvenza dall'istante `enterAt`. */
export function phoneShell(L: PhoneLayout, t: number, screenHtml: string, enterAt = 0.1, time = "14:20"): string {
  const r = reveal(t, enterAt, 0.8, 24);
  return `<div class="abs" style="left:${n(L.left)}px;top:${n(L.top)}px;width:${PHONE.w}px;height:${PHONE.h}px;transform-origin:0 0;transform:translateY(${n(r.y)}px) scale(${n(L.s)});opacity:${n(r.p)}">
<div class="ph-body"></div>
<div class="ph-screen" data-mock>${screenHtml}
<div class="ph-status"><div class="abs" style="left:164px;top:16px;width:190px;height:44px;border-radius:22px;background:var(--c-ink)"></div>
<div class="abs sans" style="left:44px;top:22px;font-size:24px;font-weight:600;color:var(--c-ink)">${time}</div>
<div class="abs" style="left:430px;top:28px;width:44px;height:22px;border-radius:6px;border:3px solid var(--c-ink);box-sizing:border-box"></div></div>
</div></div>`;
}

/** Blocco di testo (eyebrow + headline) accanto al telefono. Dimensioni in px a 1080 di lato corto. */
export function phoneText(L: PhoneLayout, ctx: SceneCtx, t: number, o: { eyebrow?: string; headline?: string; shimmer?: string }, start = 0.2): string {
  if (!o.eyebrow && !o.headline) return "";
  const { x, y, w, h, align } = L.text;
  const fs = ctx.landscape ? 88 : 64;
  const eb = o.eyebrow ? `<div class="eb" style="font-size:36px;margin-bottom:14px;${revealStyle2(t, start)}">${esc(o.eyebrow)}</div>` : "";
  const hd = o.headline
    ? `<div class="hd ${ctx.landscape ? "" : "italic"}" style="font-size:${fs}px;font-weight:${ctx.landscape ? 600 : 400};${revealStyle2(t, start + 0.2)}">${richText(o.headline, o.shimmer, lerp(0, 100, ease(seg(t, 0.6, 4.6))))}</div>`
    : "";
  return `<div class="abs" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:${align === "center" ? "flex-start" : "center"};text-align:${align};${align === "center" ? "padding-top:12px;" : ""}">${eb}${hd}</div>`;
}

function revealStyle2(t: number, start: number): string {
  const r = reveal(t, start, 0.7, 20);
  return `opacity:${n(r.p)};transform:translateY(${n(r.y)}px)`;
}

/** Titolo di colonna/blocco con eyebrow, usato dalle scene a card. */
export const eyebrowHtml = (text: string, fs = 36, extra = "") => `<div class="eb" style="font-size:${fs}px;${extra}">${esc(text)}</div>`;

/** Prime lettera maiuscola del nome, per gli avatar. */
export const initial = (s: string) => esc((s.trim()[0] ?? "?").toUpperCase());

/** Contenitore a tutta safe area (posizionato in assoluto). */
export function safeBox(ctx: SceneCtx, inner: string, style = ""): string {
  const s = ctx.safe;
  return `<div class="abs" style="left:${s.x}px;top:${s.y}px;width:${s.width}px;height:${s.height}px;${style}">${inner}</div>`;
}

/** Raggruppa le cifre con spazio sottile (es. conteggi): 1 234. Solo per mockup. */
export const dots = (count: number, size: number, gap: number, fill: string) =>
  Array.from({ length: count }, () => `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:${fill};margin-right:${gap}px"></span>`).join("");
