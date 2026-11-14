import { FORMAT_IDS, safeArea, type FormatId } from "./safe-area.ts";
import { orbsHtml, textureHtml } from "./effects.ts";
import { themeCss } from "./css.ts";
import { COLOR_NAMES, SHADOW_NAMES, TEXTURE_NAMES, color, radius, shadow, texture } from "./tokens.ts";

export const BOARD_WIDTH = 2400;
/** Moltiplicatore di opacità delle texture nella riga "ispezione" (nei video è sempre 1). */
const INSPECT_BOOST = 8;

const SCALE = 0.34; // anteprime dei frame

function swatch(name: string): string {
  const hex = color[name as keyof typeof color];
  return `<div class="sw"><div class="chip" data-token="${name}" data-hex="${hex}" style="background:${hex}"></div>
<div class="sw-name">${name}</div><div class="sw-hex">${hex}</div></div>`;
}

function frameMini(format: FormatId): string {
  const sa = safeArea(format);
  const text = format === "9:16" ? "Il vostro giorno,<br>senza stress." : "Il vostro giorno, senza stress.";
  return `<div class="mini" style="width:${sa.w * SCALE}px;height:${sa.h * SCALE}px">
  <div style="transform:scale(${SCALE});transform-origin:0 0;width:${sa.w}px;height:${sa.h}px">
    <div class="frame" style="--w:${sa.w}px;--h:${sa.h}px;--orb-d:${Math.round(Math.max(sa.w, sa.h) * 0.95)}px">
      ${orbsHtml()}${textureHtml("grain")}
      <div class="safe" data-safe="${format}" style="left:${sa.left}px;right:${sa.right}px;top:${sa.top}px;bottom:${sa.bottom}px;outline:3px dashed ${color.rose};outline-offset:0">
        <div style="display:flex;flex-direction:column;justify-content:center;align-items:flex-start;height:100%;gap:28px">
          <div class="t-eyebrow" style="font-size:36px">MatrimonioSemplice</div>
          <div class="t-displayLarge" style="font-size:${format === "9:16" ? 112 : 96}px">${text}</div>
          <div class="pill-primary t-button" style="font-size:36px">Bottone primario</div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="cap">${format} · ${sa.w}×${sa.h} · margini L/R ${sa.left}, alto ${sa.top}, basso ${sa.bottom}</div>`;
}

/** Componente di prova: una tavola con tutto il tema. Restituisce una pagina HTML completa. */
export function brandTestHtml(fontBaseUrl = "/"): string {
  const css = themeCss("9:16", fontBaseUrl) + `
.board{width:${BOARD_WIDTH}px;padding:72px 80px 88px;background:var(--c-cream);position:relative;overflow:hidden}
.board>*{position:relative}
h2.sec{margin:56px 0 20px}
.t-eyebrow{margin:0}
.grid{display:grid;gap:24px}
.sw{width:100%}
.chip{height:104px;border-radius:var(--r-card);border:1px solid var(--c-border)}
.sw-name{margin-top:10px;font:600 15px/1.2 var(--font-body)}
.sw-hex{font:400 14px/1.4 var(--font-body);color:var(--c-muted);font-variant-numeric:tabular-nums}
.row{display:flex;gap:48px;align-items:flex-start}
.col{flex:1}
.lbl{font:500 12px/1.2 ${"var(--font-body)"};text-transform:uppercase;letter-spacing:.08em;color:var(--c-subtle);margin:18px 0 6px}
.shbox{height:120px;background:var(--c-white);border-radius:var(--r-card);display:flex;align-items:center;justify-content:center;font:500 14px var(--font-body);color:var(--c-muted)}
.rad{height:96px;background:var(--c-parchment);border:1px solid var(--c-border);display:flex;align-items:center;justify-content:center;font:500 14px var(--font-body);color:var(--c-muted)}
.tile{position:relative;height:190px;border-radius:var(--r-card);border:1px solid var(--c-border);overflow:hidden;background:var(--c-cream)}
.tile .tn{position:absolute;left:14px;bottom:10px;font:500 13px var(--font-body);color:var(--c-muted)}
.orbtile{position:relative;height:420px;border-radius:var(--r-card);border:1px solid var(--c-border);overflow:hidden;background:var(--c-cream);--orb-d:640px}
.mini{position:relative;overflow:hidden;border-radius:12px;border:1px solid var(--c-border);box-shadow:var(--sh-soft-md)}
.cap{font:400 14px var(--font-body);color:var(--c-muted);margin-top:10px}
`;
  const typeRows = [
    ["displayLarge", "88 · Playfair Display", "Il vostro giorno"],
    ["displaySmall", "56 · Playfair Display", "Senza stress"],
    ["h3", "32 · Playfair Display", "Titolo di card"],
    ["eyebrow", "12 · Inter 600", "Eyebrow champagne"],
    ["body", "16 · Inter 400", "Testo corrente: il brand respira, non è affollato."],
    ["bodySmall", "14 · Inter 400", "Descrizioni e note, un po' più piccole."],
    ["label", "12 · Inter 500", "Label UI"],
  ]
    .map(
      ([cls, meta, txt]) =>
        `<div class="lbl">${cls} — ${meta}</div><div class="t-${cls}" style="--ts:1">${txt}</div>`,
    )
    .join("");

  const body = `<div class="board">
  <div class="t-eyebrow">MatrimonioSemplice · Tema video</div>
  <div class="t-displaySmall" style="margin-top:8px">Tavola di prova del brand</div>

  <h2 class="sec t-h3">Colori</h2>
  <div class="grid" style="grid-template-columns:repeat(7,1fr)">${COLOR_NAMES.map(swatch).join("")}</div>

  <h2 class="sec t-h3">Tipografia, bottoni, forme</h2>
  <div class="row">
    <div class="col">
      ${typeRows}
      <div class="lbl">displaySmall corsivo · gradiente shimmer</div>
      <div class="t-displaySmall italic shimmer">Il giorno più bello</div>
      <div class="lbl">button — 14 · Inter 600 · 0.04em</div>
      <div style="display:flex;gap:16px;align-items:center">
        <span class="pill-primary t-button">Crea il tuo sito</span>
        <span class="pill-secondary t-button">Scopri di più</span>
        <span class="badge t-label">Badge</span>
      </div>
    </div>
    <div class="col">
      <div class="lbl">Raggi: pill ${radius.pill} · card ${radius.card} · input ${radius.input} · badge ${radius.badge}</div>
      <div class="grid" style="grid-template-columns:2fr 1fr 1fr 1fr;gap:16px">
        <div class="rad" style="border-radius:var(--r-pill)">pill</div>
        <div class="rad" style="border-radius:var(--r-card)">card</div>
        <div class="rad" style="border-radius:var(--r-input)">input</div>
        <div class="rad" style="border-radius:var(--r-badge)">badge</div>
      </div>
      <div class="lbl">Ombre</div>
      <div class="grid" style="grid-template-columns:repeat(5,1fr);gap:20px;padding:16px 8px 24px">
        ${SHADOW_NAMES.map((n) => `<div class="shbox" style="box-shadow:${shadow[n]}">${n}</div>`).join("")}
      </div>
      <div class="lbl">Gradienti: coverHero (160°) · shimmer (90°)</div>
      <div style="display:flex;gap:16px">
        <div style="flex:1;height:96px;border-radius:var(--r-card);border:1px solid var(--c-border);background:var(--g-cover-hero)"></div>
        <div style="flex:1;height:96px;border-radius:var(--r-card);background:var(--g-shimmer)"></div>
      </div>
      <div class="lbl">Card con overlay blush</div>
      <div class="card" style="padding:24px"><div class="t-h3">Fondo regalo</div><div class="t-bodySmall" style="color:var(--c-muted)">Esempio di card: bianca, bordo, raggio 20, ombra soft.</div></div>
    </div>
  </div>

  <h2 class="sec t-h3">Orbi e texture</h2>
  <div class="row">
    <div style="flex:1.1">
      <div class="orbtile" style="background:var(--g-cover-hero)">${orbsHtml()}<span class="tn" style="position:absolute;left:14px;bottom:10px;font:500 13px var(--font-body);color:var(--c-muted)">blush alto sx · rose basso dx · warm centro dx</span></div>
    </div>
    <div style="flex:1.4">
      <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:16px">
        ${TEXTURE_NAMES.map((n) => `<div class="tile">${textureHtml(n)}<span class="tn">${n} · ${texture[n]}</span></div>`).join("")}
        ${TEXTURE_NAMES.map((n) => `<div class="tile">${textureHtml(n, INSPECT_BOOST)}<span class="tn">${n} · ×${INSPECT_BOOST} (ispezione)</span></div>`).join("")}
      </div>
    </div>
  </div>

  <h2 class="sec t-h3">Safe area</h2>
  <div class="row" style="align-items:flex-end;gap:64px">
    ${FORMAT_IDS.map((f) => `<div>${frameMini(f)}</div>`).join("")}
  </div>
</div>`;

  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Brand test</title><style>
:root{--font-body:"Inter",system-ui,sans-serif}
${css}</style></head><body>${body}</body></html>`;
}
