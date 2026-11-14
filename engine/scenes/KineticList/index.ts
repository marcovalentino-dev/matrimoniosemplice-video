import { z } from "zod";
import { HOLD, ceilHalf, clamp, ease, n, reveal, seg, textDuration } from "../_shared/anim.ts";
import { esc, richText, wordCount } from "../_shared/html.ts";
import { ICON_NAMES, compose, eyebrowHtml, icon, safeBox } from "../_shared/ui.ts";
import { defineScene, type Cue, type OnScreenText } from "../_shared/types.ts";

const Props = z.object({
  eyebrow: z.string().max(30).optional().describe("Etichetta sopra il titolo"),
  title: z.string().max(60).optional().describe("Titolo sopra l'elenco (Playfair)"),
  items: z
    .array(z.object({ icon: z.enum(ICON_NAMES).describe(`Icona: ${ICON_NAMES.join(", ")}`), text: z.string().min(1).max(48).describe("Testo, al massimo 8 parole") }))
    .min(2)
    .max(5)
    .describe("Voci dell'elenco, mostrate una dopo l'altra"),
  step: z.number().min(1.4).max(4).default(2).describe("Secondi tra una voce e la successiva (si accorcia se lo shot è corto)"),
});
type P = z.output<typeof Props>;

const START = 0.5;
const ENTER = 0.7;
const MIN_STEP = 1.4;

/** Passo effettivo: quello richiesto, ma mai oltre quello che lo shot permette. */
function stepFor(p: P, dur: number): number {
  const k = p.items.length;
  return k <= 1 ? p.step : clamp((dur - START - ENTER - HOLD) / (k - 1), MIN_STEP, p.step);
}

export const KineticList = defineScene({
  name: "KineticList",
  summary: "Elenco animato: una voce alla volta con icona semplice, le precedenti si attenuano.",
  mockup: false,
  schema: Props,
  duration(p) {
    const k = p.items.length;
    const words = p.items.reduce((a, it) => a + wordCount(it.text), 0) + (p.title ? wordCount(p.title) : 0);
    const min = ceilHalf(Math.max(textDuration(wordCount(p.items[k - 1].text)), START + (k - 1) * MIN_STEP + ENTER + HOLD));
    const rec = ceilHalf(Math.max(min, START + (k - 1) * p.step + ENTER + 2, 1.2 + 0.15 * words));
    return { min, recommended: rec };
  },
  render(p, t, ctx) {
    const step = stepFor(p, ctx.dur);
    const at = (i: number) => START + i * step;
    const k = p.items.length;
    const rows = p.items
      .map((it, i) => {
        const r = reveal(t, at(i), ENTER, 24);
        const dim = i < k - 1 ? 0.5 * ease(seg(t, at(i + 1) + 0.2, at(i + 1) + 0.8)) : 0;
        const fs = ctx.landscape ? 72 : 64;
        return `<div style="display:flex;align-items:center;gap:40px;opacity:${n(r.p * (1 - dim))};transform:translateY(${n(r.y)}px)">
<div style="flex:none;width:136px;height:136px;border-radius:50%;background:var(--c-blush);box-shadow:var(--sh-blush);display:flex;align-items:center;justify-content:center">${icon(it.icon, 68, undefined, 1.8)}</div>
<div class="hd" style="font-size:${fs}px;line-height:1.12;max-width:${ctx.landscape ? 1100 : 700}px">${richText(it.text)}</div></div>`;
      })
      .join("");
    const hr = reveal(t, 0.1, 0.7, 20);
    const head =
      p.title || p.eyebrow
        ? `<div style="margin-bottom:${ctx.landscape ? 40 : 64}px;opacity:${n(hr.p)};transform:translateY(${n(hr.y)}px)">${p.eyebrow ? eyebrowHtml(p.eyebrow, 36, "margin-bottom:14px") : ""}${p.title ? `<h1 class="hd italic" style="font-size:${ctx.landscape ? 72 : 88}px;font-weight:400">${richText(p.title)}</h1>` : ""}</div>`
        : "";
    return compose(
      t,
      { bg: "hero" },
      safeBox(ctx, head + `<div style="display:flex;flex-direction:column;gap:${ctx.landscape ? 40 : 56}px">${rows}</div>`, "display:flex;flex-direction:column;justify-content:center;align-items:flex-start"),
    );
  },
  css: "",
  cues(p, ctx) {
    const step = stepFor(p, ctx.dur);
    return p.items.map((_, i): Cue => ({ t: START + i * step, type: "tick" }));
  },
  texts(p) {
    const out: OnScreenText[] = p.items.map((it): OnScreenText => ({ text: it.text.replace(/\*/g, ""), role: "headline", origin: "prop" }));
    if (p.title) out.unshift({ text: p.title.replace(/\*/g, ""), role: "headline", origin: "prop" });
    if (p.eyebrow) out.unshift({ text: p.eyebrow, role: "eyebrow", origin: "prop" });
    return out;
  },
  preview: {
    props: {
      eyebrow: "MatrimonioSemplice",
      title: "Tutto in un posto",
      items: [
        { icon: "phone", text: "Il sito, pronto in pochi minuti" },
        { icon: "check", text: "Conferme senza account" },
        { icon: "gift", text: "Lista nozze senza commissioni" },
      ],
    },
    t: 6.2,
  },
  notes: ["Massimo 5 voci da 8 parole. Ogni voce deve essere un claim di PRODOTTO_FATTI.", "Durata: circa 2 s a voce (consigliata), 1,4 s a voce al minimo; se lo shot è corto il passo si accorcia da solo."],
});

