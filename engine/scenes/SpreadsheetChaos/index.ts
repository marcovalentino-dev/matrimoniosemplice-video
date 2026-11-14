import { z } from "zod";
import { HOLD, ceilHalf, ease, lerp, n, reveal, rng, seg, textDuration } from "../_shared/anim.ts";
import { esc, richText, wordCount } from "../_shared/html.ts";
import { compose, rgba } from "../_shared/ui.ts";
import { defineScene, type Cue, type OnScreenText } from "../_shared/types.ts";
import { color } from "../../theme/tokens.ts";
import { fontStack } from "../../theme/fonts.ts";

const NAMES = ["Anna R.", "Luca B", "Sara", "Paolo G.", "Elena M", "D. Ferri", "Chiara", "Marta Gallo", "zio Franco", "Giorgia", "Matteo", "Irene", "Nonna Rosa", "Stefano", "Valentina", "Fabio", "Laura +fam", "Andrea", "Silvia", "Marco B.", "Roberta", "Enrico", "Claudia", "Tommaso", "Alice", "Gianni", "Monica", "Riccardo", "Federica", "Simone"];
const MENU = ["carne", "pesce", "vegetariano", "veg?", "boh", "carne/pesce", "", "pesce", "celiaca", "bimbi", "vegano?", "carne", "", "pesce?", "vedi chat"];
const ALLERGIE = ["", "lattosio", "noci!!", "?", "glutine", "", "vedi chat", "", "nichel?", "", "crostacei", "", "arachidi", "", ""];
const PIU1 = ["+1", "1?", "2 (bimbi)", "", "forse +1", "no", "+1", "sì?", "+2", "", "famiglia", "+1", "boh", "", " 1"];
const DEFAULT_ROWS = NAMES.map((nm, i) => [nm, MENU[(i * 7) % MENU.length], ALLERGIE[(i * 5 + 2) % ALLERGIE.length], PIU1[(i * 4 + 1) % PIU1.length]]);

const Props = z.object({
  title: z.string().max(30).default("Invitati_FINALE_v3").describe("Nome del file (dato fittizio)"),
  columns: z.array(z.string().max(14)).min(2).max(5).default(["Nome", "Menu", "Allergie", "+1"]).describe("Intestazioni di colonna (fittizie)"),
  rows: z.array(z.array(z.string().max(18))).min(8).default(DEFAULT_ROWS).describe("Righe di celle (fittizie), una cella per colonna"),
  caption: z.string().max(70).optional().describe("Didascalia in card sopra il foglio (Inter)"),
});
type P = z.output<typeof Props>;

const ROW_H = 96;
const SCROLL_START = 0.3;

/** Istanti dei tasti: raffiche deterministiche tra 1,3 s e la fine dello scorrimento. */
function keyTimes(dur: number): number[] {
  const r = rng(7);
  const keys: number[] = [];
  let t = 1.3;
  while (t < dur - 0.6) {
    const k = 4 + Math.floor(r() * 5);
    for (let i = 0; i < k && t < dur - 0.6; i++) {
      keys.push(Math.round(t * 1000) / 1000);
      t += 0.09 + r() * 0.07;
    }
    t += 0.35 + r() * 0.5;
  }
  return keys;
}

export const SpreadsheetChaos = defineScene({
  name: "SpreadsheetChaos",
  summary: "Foglio di calcolo disordinato (celle evidenziate a caso, note a margine) che scorre lentamente.",
  mockup: true,
  schema: Props,
  duration(p) {
    const cap = p.caption ? 0.9 + 0.7 + HOLD : 0;
    const min = ceilHalf(Math.max(3, cap, p.caption ? textDuration(wordCount(p.caption)) : 0));
    return { min, recommended: min + 2 };
  },
  render(p, t, ctx) {
    const sa = ctx.safe;
    const cardW = ctx.landscape ? 1400 : sa.width;
    const cardH = ctx.landscape ? sa.height : sa.height;
    const cardX = sa.x + (sa.width - cardW) / 2;
    const cardY = sa.y;
    const nCols = p.columns.length;
    const weights = p.columns.map((_, i) => (i === 0 ? 1.15 : 1));
    const wSum = weights.reduce((a, b) => a + b, 0);
    const colW = weights.map((w) => (w / wSum) * cardW);

    const bodyTop = 84 + 80;
    const maxScroll = Math.max(0, p.rows.length * ROW_H - (cardH - bodyTop));
    const dist = Math.min(maxScroll, 1250);
    const scroll = lerp(0, dist, ease(seg(t, SCROLL_START, Math.max(SCROLL_START + 1, ctx.dur - 0.2))));
    // Il disordine è fissato dalla posizione (riga, colonna), mai da t.
    const hh = (i: number, j: number) => (((i * 73856093) ^ (j * 19349663) ^ ((i + 3) * (j + 7) * 83492791)) >>> 0);
    const first = Math.max(0, Math.floor(scroll / ROW_H) - 1);
    const last = Math.min(p.rows.length - 1, Math.ceil((scroll + cardH) / ROW_H));
    let cells = "";
    for (let i = first; i <= last; i++) {
      let x = 0;
      p.columns.forEach((_, j) => {
        const h = hh(i, j);
        const v = p.rows[i][j] ?? "";
        const st = [
          `left:${n(x)}px;top:${i * ROW_H}px;width:${n(colW[j])}px`,
          h % 7 === 0 ? `background:${rgba(color.blush, 0.42)}` : "",
          h % 5 === 0 && j > 0 ? "padding-left:44px" : "",
          h % 11 === 0 && v ? "text-decoration:line-through" : "",
          h % 13 === 0 && j === nCols - 1 ? "text-align:right" : "",
          h % 9 === 0 && j === 1 ? "font-style:italic" : "",
          `color:${h % 4 === 0 ? "var(--c-muted)" : "var(--c-ink)"}`,
        ].filter(Boolean).join(";");
        cells += `<div class="ss-cell" style="${st}">${esc(v)}</div>`;
        x += colW[j];
      });
    }
    const head = (() => {
      let x = 0;
      return p.columns
        .map((c, j) => {
          const s = `<div class="abs sans" style="left:${n(x)}px;top:0;width:${n(colW[j])}px;height:80px;line-height:80px;box-sizing:border-box;padding:0 18px;font-size:26px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--c-muted)">${esc(c)}</div>`;
          x += colW[j];
          return s;
        })
        .join("");
    })();
    const enter = reveal(t, 0.1, 0.8, 24);
    const sheet = `<div class="card abs" data-mock style="left:${cardX}px;top:${cardY}px;width:${cardW}px;height:${cardH}px;box-shadow:var(--sh-soft-md);opacity:${n(enter.p)};transform:translateY(${n(enter.y)}px)">
<div class="abs" style="left:0;top:0;width:100%;height:84px;background:var(--c-white);border-bottom:1px solid var(--c-border);z-index:3"><div class="abs sans" style="left:28px;top:20px;font-size:32px;font-weight:600;color:var(--c-muted)">${esc(p.title)}</div></div>
<div class="abs" style="left:0;top:84px;width:100%;height:80px;background:var(--c-parchment);z-index:3;border-bottom:1px solid var(--c-border)">${head}</div>
<div class="abs" style="left:0;top:${bodyTop}px;width:100%;height:${cardH - bodyTop}px;overflow:hidden"><div class="abs" style="left:0;top:0;width:100%;height:${p.rows.length * ROW_H}px;transform:translateY(${n(-scroll)}px)">${cells}</div></div></div>`;

    const cr = reveal(t, 0.9, 0.7, 20);
    const capW = ctx.landscape ? 1000 : sa.width - 80;
    const caption = p.caption
      ? `<div class="card abs" style="left:${sa.x + (sa.width - capW) / 2}px;top:${sa.y + sa.height - 190}px;width:${capW}px;height:170px;display:flex;align-items:center;justify-content:center;text-align:center;box-shadow:var(--sh-soft-lg);opacity:${n(cr.p)};transform:translateY(${n(cr.y)}px)"><div class="sans" style="font-size:44px;font-weight:500;line-height:1.3;color:var(--c-ink);padding:0 40px">${richText(p.caption)}</div></div>`
      : "";
    return compose(t, { bg: "parchment" }, sheet + caption);
  },
  css: `.ss-cell{position:absolute;height:${ROW_H}px;line-height:${ROW_H}px;font-family:${fontStack.body};font-size:32px;box-sizing:border-box;padding:0 18px;border-right:1px solid var(--c-border);border-bottom:1px solid var(--c-border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
  cues(p, ctx) {
    return keyTimes(ctx.dur).map((t): Cue => ({ t, type: "key" }));
  },
  texts(p) {
    const out: OnScreenText[] = [{ text: p.title, role: "mock", origin: "mock" }, ...p.columns.map((c): OnScreenText => ({ text: c, role: "mock", origin: "mock" }))];
    if (p.caption) out.unshift({ text: p.caption.replace(/\*/g, ""), role: "caption", origin: "prop" });
    return out;
  },
  preview: { props: { caption: "Menu, allergie, +1…\novunque." }, t: 4.2 },
  notes: ["Dati del foglio tutti fittizi (`source: mock`).", "Lo scorrimento si adatta alla durata dello shot: copre al massimo 1250 px."],
});
