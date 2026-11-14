import { z } from "zod";
import { HOLD, ceilHalf, ease, lerp, revealStyle, seg, textDuration, reveal, n } from "../_shared/anim.ts";
import { tokenize, wordCount, wordsHtml, richText } from "../_shared/html.ts";
import { compose, eyebrowHtml, safeBox } from "../_shared/ui.ts";
import { defineScene, type OnScreenText } from "../_shared/types.ts";

const Props = z.object({
  eyebrow: z.string().max(40).optional().describe("Etichetta sopra il gancio"),
  headline: z.string().min(1).max(70).describe("Gancio in Playfair Display, entra parola per parola. `*parola*` = corsivo, `\\n` = a capo"),
  sub: z.string().max(100).optional().describe("Riga di supporto in Inter, muted"),
  shimmer: z.string().optional().describe("Sottostringa della headline con sfumatura shimmer. Al massimo una per video"),
  align: z.enum(["left", "center"]).default("left").describe("Allineamento del testo"),
});
type P = z.output<typeof Props>;

const WORD_START = 0.3;
const WORD_STEP = 0.1;
const WORD_DUR = 0.6;

function wordsEnd(p: P) {
  const k = tokenize(p.headline).filter((x) => !x.br).length;
  return WORD_START + (k - 1) * WORD_STEP + WORD_DUR;
}
const subStart = (p: P) => wordsEnd(p) + 0.1;

export const HookText = defineScene({
  name: "HookText",
  summary: "Gancio: eyebrow + headline Playfair che entra parola per parola, riga di supporto opzionale.",
  mockup: false,
  schema: Props,
  duration(p) {
    const words = wordCount(p.headline) + (p.sub ? wordCount(p.sub) : 0) + (p.eyebrow ? wordCount(p.eyebrow) : 0);
    const end = p.sub ? subStart(p) + 0.7 : wordsEnd(p);
    const min = ceilHalf(Math.max(2.5, textDuration(words), end + HOLD));
    return { min, recommended: Math.max(3, min + 0.5) };
  },
  render(p, t, ctx) {
    const center = p.align === "center";
    const fs = ctx.landscape ? 128 : 148;
    const eb = p.eyebrow ? `<div style="${revealStyle(t, 0.1)};margin-bottom:40px">${eyebrowHtml(p.eyebrow, 36)}</div>` : "";
    const shimmerPos = lerp(0, 100, ease(seg(t, 0.8, 4.8)));
    const words = wordsHtml(
      p.headline,
      p.shimmer,
      (i) => {
        const r = reveal(t, WORD_START + i * WORD_STEP, WORD_DUR, 20);
        return `opacity:${n(r.p)};transform:translateY(${n(r.y)}px)`;
      },
      shimmerPos,
    );
    const hl = `<h1 class="hd" style="font-size:${fs}px;font-weight:700;line-height:1.08;max-width:${ctx.landscape ? 1500 : ctx.safe.width}px">${words}</h1>`;
    const bar = `<div style="width:120px;height:8px;border-radius:4px;background:var(--c-blush);margin-top:48px;opacity:${n(ease(seg(t, wordsEnd(p) - 0.2, wordsEnd(p) + 0.4)))}"></div>`;
    const sub = p.sub ? `<p class="bd" style="font-size:52px;margin-top:40px;max-width:${ctx.landscape ? 1100 : 860}px;${revealStyle(t, subStart(p))}">${richText(p.sub)}</p>` : "";
    const align = center ? "center" : "flex-start";
    return compose(
      t,
      { bg: "hero" },
      safeBox(ctx, eb + hl + bar + sub, `display:flex;flex-direction:column;justify-content:center;align-items:${align};text-align:${center ? "center" : "left"}`),
    );
  },
  css: "",
  texts(p) {
    const out: OnScreenText[] = [];
    if (p.eyebrow) out.push({ text: p.eyebrow, role: "eyebrow", origin: "prop" });
    out.push({ text: p.headline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    if (p.sub) out.push({ text: p.sub, role: "sub", origin: "prop" });
    return out;
  },
  preview: { props: { eyebrow: "RSVP", headline: "Niente app.\nNiente *account.*", sub: "Gli invitati confermano dal link del sito." }, t: 2.6 },
  notes: ["Gancio da 3-6 parole: 2,5-3 s. Massimo 2 righe di testo corrente per inquadratura."],
});
