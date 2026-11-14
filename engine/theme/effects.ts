import { ORB_NAMES, TEXTURE_NAMES, color, gradientTokens, orbColor, texture, type OrbName, type TextureName } from "./tokens.ts";

type GradientName = keyof typeof gradientTokens;

/** Gradiente CSS lineare dai token (stop equidistanti). */
export function gradientCss(name: GradientName): string {
  const g = gradientTokens[name];
  return `linear-gradient(${g.angle}deg, ${g.stops.map((s) => s.toUpperCase()).join(", ")})`;
}

export const gradient = {
  shimmer: gradientCss("shimmer"),
  coverHero: gradientCss("coverHero"),
};

// ---------- Orbi ----------

/** Posizione del centro dell'orbo, in % del frame (dai token: alto sx, basso dx, centro dx). */
export const ORB_POSITION: Record<OrbName, { x: number; y: number }> = {
  blush: { x: 10, y: 12 },
  rose: { x: 90, y: 90 },
  warm: { x: 96, y: 50 },
};

/** Diametro dell'orbo come frazione del lato maggiore del frame. */
export const ORB_DIAMETER = 0.95;

export function orbCss(): string {
  const orbs = ORB_NAMES.map(
    (n) =>
      `.orb-${n}{left:${ORB_POSITION[n].x}%;top:${ORB_POSITION[n].y}%;background:radial-gradient(circle closest-side, ${orbColor[n]} 0%, ${orbColor[n].replace(/[\d.]+\)$/, "0)")} 100%);}`,
  ).join("\n");
  return (
    `.orbs{position:absolute;inset:0;overflow:hidden;pointer-events:none;}\n` +
    `.orb{position:absolute;width:var(--orb-d);height:var(--orb-d);transform:translate(-50%,-50%);border-radius:50%;}\n` +
    orbs
  );
}

export function orbsHtml(): string {
  return `<div class="orbs">${ORB_NAMES.map((n) => `<div class="orb orb-${n}"></div>`).join("")}</div>`;
}

// ---------- Texture ----------

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const unit = (hex: string) => rgb(hex).map((v) => (v / 255).toFixed(3));
const svgUri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Rumore frattale tinto: colore costante (da token), alpha dal rumore. Mai nero puro. */
function noiseSvg(baseFrequency: number, octaves: number, tint: string, gain: number, bias: number, size: number): string {
  const [r, g, b] = unit(tint);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${octaves}" stitchTiles="stitch"/>` +
    `<feColorMatrix values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${gain} ${bias}"/></filter>` +
    `<rect width="100%" height="100%" filter="url(#n)"/></svg>`
  );
}

function petalsSvg(): string {
  const petals = [
    [40, 50, 20], [150, 30, 100], [260, 90, 160], [90, 170, 60], [210, 200, 130],
    [320, 230, 30], [60, 290, 140], [170, 320, 80], [290, 330, 170],
  ]
    .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="20" ry="9" transform="rotate(${a} ${x} ${y})"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360"><g fill="${color.blush}">${petals}</g></svg>`;
}

const TEXTURE_BG: Record<TextureName, { image: string; size: string }> = {
  grain: { image: svgUri(noiseSvg(0.85, 2, color.ink, 1.6, -0.15, 256)), size: "256px 256px" },
  linen: {
    image: `repeating-linear-gradient(0deg, ${color.ink} 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, ${color.ink} 0 1px, transparent 1px 4px)`,
    size: "auto",
  },
  watercolor: { image: svgUri(noiseSvg(0.012, 3, color.champagne, 2.4, -0.5, 512)), size: "512px 512px" },
  petals: { image: svgUri(petalsSvg()), size: "360px 360px" },
};

export function textureCss(): string {
  const base = `.tx{position:absolute;inset:0;pointer-events:none;}`;
  const each = TEXTURE_NAMES.map(
    (n) => `.tx-${n}{background-image:${TEXTURE_BG[n].image};background-size:${TEXTURE_BG[n].size};opacity:${texture[n]};}`,
  ).join("\n");
  return base + "\n" + each;
}

/**
 * Layer di texture a pieno frame. `boost` moltiplica l'opacità del token: usare 1 nei video;
 * valori > 1 solo per ispezione (es. la tavola di prova).
 */
export function textureHtml(name: TextureName, boost = 1): string {
  const o = Math.min(1, texture[name] * boost);
  return `<div class="tx tx-${name}"${boost === 1 ? "" : ` style="opacity:${o}"`}></div>`;
}
