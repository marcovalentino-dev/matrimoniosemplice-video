import { z } from "zod";
import { HOLD, ceilHalf, ease, lerp, revealStyle, seg, textDuration } from "../_shared/anim.ts";
import { richText, wordCount } from "../_shared/html.ts";
import { compose, eyebrowHtml, safeBox } from "../_shared/ui.ts";
import { defineScene, type OnScreenText } from "../_shared/types.ts";

const Props = z.object({
  eyebrow: z.string().max(40).optional().describe("Etichetta sopra il titolo (Inter 600, maiuscolo, champagne)"),
  title: z.string().min(1).max(80).describe("Titolo in Playfair Display. `*parola*` = corsivo, `\\n` = a capo"),
  subtitle: z.string().max(120).optional().describe("Sottotitolo in Inter, colore muted"),
  shimmer: z.string().optional().describe("Sottostringa del titolo con sfumatura shimmer. Al massimo una per video"),
});
type P = z.output<typeof Props>;

const TIMES = { eyebrow: 0.2, title: 0.4, divider: 0.9, sub: 1.0 };

function lastEnter(p: P) {
  return p.subtitle ? TIMES.sub + 0.7 : TIMES.title + 0.7;
}

export const TitleCard = defineScene({
  name: "TitleCard",
  summary: "Titolo centrato con sottotitolo su sfondo hero con orbi ambientali.",
  mockup: false,
  schema: Props,
  duration(p) {
    const words = wordCount(p.title) + (p.subtitle ? wordCount(p.subtitle) : 0) + (p.eyebrow ? wordCount(p.eyebrow) : 0);
    const min = ceilHalf(Math.max(textDuration(words), lastEnter(p) + HOLD));
    return { min, recommended: min + 1 };
  },
  render(p, t, ctx) {
    const fs = ctx.landscape ? 132 : 140;
    const eb = p.eyebrow ? `<div style="${revealStyle(t, TIMES.eyebrow)};margin-bottom:36px">${eyebrowHtml(p.eyebrow, 36)}</div>` : "";
    const title = `<h1 class="hd" style="font-size:${fs}px;font-weight:600;max-width:${ctx.landscape ? 1500 : ctx.safe.width}px;${revealStyle(t, TIMES.title, 0.8)}">${richText(p.title, p.shimmer, lerp(0, 100, ease(seg(t, 0.8, 4.8))))}</h1>`;
    const dv = seg(t, TIMES.divider, TIMES.divider + 0.5);
    const divider = p.subtitle
      ? `<div style="width:60px;height:2px;background:var(--c-champagne);margin:44px 0 40px;transform:scaleX(${ease(dv)});opacity:${ease(dv)}"></div>`
      : "";
    const sub = p.subtitle
      ? `<p class="bd" style="font-size:52px;font-weight:400;max-width:${ctx.landscape ? 1100 : 860}px;${revealStyle(t, TIMES.sub)}">${richText(p.subtitle)}</p>`
      : "";
    return compose(t, { bg: "hero" }, safeBox(ctx, eb + title + divider + sub, "display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center"));
  },
  css: "",
  texts(p) {
    const out: OnScreenText[] = [];
    if (p.eyebrow) out.push({ text: p.eyebrow, role: "eyebrow", origin: "prop" });
    out.push({ text: p.title.replace(/\*/g, ""), role: "headline", origin: "prop" });
    if (p.subtitle) out.push({ text: p.subtitle, role: "sub", origin: "prop" });
    return out;
  },
  preview: { props: { eyebrow: "MatrimonioSemplice", title: "Il tuo sito matrimonio\n*in pochi minuti.*", subtitle: "Conferme semplici, lista nozze senza commissioni." }, t: 2.6 },
  notes: ["Lo shimmer va usato su una sola headline per video (BRAND_VIDEO §2).", "Titolo: massimo 80 caratteri, circa 3 righe in 9:16."],
});
