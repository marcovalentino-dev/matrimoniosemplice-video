import { z } from "zod";
import { HOLD, ceilHalf, ease, n, pulse, reveal, seg, textDuration } from "../_shared/anim.ts";
import { esc, richText, wordCount } from "../_shared/html.ts";
import { compose, dots, icon, pill, ripple } from "../_shared/ui.ts";
import { defineScene, type Cue, type OnScreenText } from "../_shared/types.ts";

const Props = z.object({
  headline: z.string().max(60).optional().describe("Titolo sopra la card (Playfair). Dire solo: lista nozze senza commissioni, bonifico diretto"),
  title: z.string().max(24).default("Fondo regalo").describe("Titolo della card"),
  subtitle: z.string().max(40).default("Bonifico diretto").describe("Riga sotto il titolo"),
  copyLabel: z.string().max(20).default("Copia IBAN").describe("Etichetta del bottone prima del tap"),
  copiedLabel: z.string().max(20).default("Copiato").describe("Etichetta del bottone dopo il tap"),
  thankYou: z.string().max(40).default("Grazie di cuore!").describe("Messaggio di ringraziamento che compare dopo la copia"),
});
type P = z.output<typeof Props>;

const TAP = 1.9;
const THANKS = TAP + 0.5;

export const GiftFundCard = defineScene({
  name: "GiftFundCard",
  summary: "Sezione fondo regalo: l'IBAN (segnaposto grafico, mai reale) si copia con un tap e compare il grazie.",
  mockup: true,
  schema: Props,
  duration(p) {
    const words = wordCount(p.thankYou) + (p.headline ? wordCount(p.headline) : 0);
    const min = ceilHalf(Math.max(textDuration(words), THANKS + 0.7 + HOLD));
    return { min, recommended: min + 1 };
  },
  render(p, t, ctx) {
    const sa = ctx.safe;
    const cardW = ctx.landscape ? 860 : sa.width;
    const cardX = ctx.landscape ? sa.x + sa.width - cardW : sa.x;
    const press = pulse(t, TAP);
    const copied = t >= TAP + 0.1;
    const th = reveal(t, THANKS, 0.7, 20);
    const cr = reveal(t, 0.3, 0.8, 24);

    const btnLabel = copied
      ? `<span style="display:inline-flex;align-items:center;gap:16px">${icon("check", 48, undefined, 2.4)}${esc(p.copiedLabel)}</span>`
      : esc(p.copyLabel);
    const btn = pill(btnLabel, { fs: 44, h: 120, pressed: press, extra: "width:100%;", raw: true });

    const body = `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;height:100%;justify-content:center;padding:56px 64px;gap:28px">
<div style="width:120px;height:120px;border-radius:50%;background:var(--c-blush);box-shadow:var(--sh-blush);display:flex;align-items:center;justify-content:center">${icon("gift", 64)}</div>
<div><div class="hd" style="font-size:72px">${esc(p.title)}</div><p class="bd" style="font-size:40px;margin-top:8px">${esc(p.subtitle)}</p></div>
<div data-mock style="width:100%;box-sizing:border-box;height:128px;border-radius:12px;border:1.5px solid var(--c-border);background:var(--c-cream);display:flex;align-items:center;justify-content:center;gap:24px">
<span class="eb sans" style="font-size:26px">IBAN</span><span style="display:inline-flex;gap:18px">${[0, 1, 2, 3, 4].map(() => `<span>${dots(4, 14, 6, "var(--c-subtle)")}</span>`).join("")}</span></div>
<div style="width:100%;position:relative">${btn}${ripple(ctx.landscape ? 400 : 440, 60, t, TAP, 180)}</div>
<div style="width:100%;box-sizing:border-box;height:112px;border-radius:var(--r-card);background:var(--c-blush-light);display:flex;align-items:center;justify-content:center;gap:20px;opacity:${n(th.p)};transform:translateY(${n(th.y)}px)">${icon("heart", 52)}<span class="hd italic" style="font-size:48px;font-weight:400">${esc(p.thankYou)}</span></div></div>`;

    const cardH = ctx.landscape ? sa.height : 1020;
    const cardY = ctx.landscape ? sa.y : sa.y + sa.height - cardH;
    const card = `<div class="card abs" style="left:${cardX}px;top:${cardY}px;width:${cardW}px;height:${cardH}px;box-shadow:var(--sh-soft-md);opacity:${n(cr.p)};transform:translateY(${n(cr.y)}px)">${body}</div>`;

    const hr = reveal(t, 0.2, 0.8, 20);
    const head = p.headline
      ? `<div class="abs" style="left:${sa.x}px;top:${ctx.landscape ? sa.y : sa.y + 12}px;width:${ctx.landscape ? sa.width - cardW - 96 : sa.width}px;${ctx.landscape ? `height:${sa.height}px;display:flex;align-items:center;` : ""}opacity:${n(hr.p)};transform:translateY(${n(hr.y)}px)"><h1 class="hd" style="font-size:${ctx.landscape ? 104 : 100}px;line-height:1.08">${richText(p.headline)}</h1></div>`
      : "";
    return compose(t, { bg: "hero" }, head + card);
  },
  css: "",
  cues() {
    return [{ t: TAP, type: "tap" }, { t: TAP + 0.1, type: "copy" }, { t: THANKS + 0.2, type: "chime" }] satisfies Cue[];
  },
  texts(p) {
    const out: OnScreenText[] = [
      { text: p.title, role: "label", origin: "prop" },
      { text: p.subtitle, role: "sub", origin: "prop" },
      { text: p.copyLabel, role: "label", origin: "prop" },
      { text: p.copiedLabel, role: "label", origin: "prop" },
      { text: p.thankYou, role: "caption", origin: "prop" },
      { text: "IBAN", role: "mock", origin: "mock" },
    ];
    if (p.headline) out.unshift({ text: p.headline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    return out;
  },
  preview: { props: { headline: "Lista nozze\nsenza commissioni." }, t: 3.8 },
  notes: ["L'IBAN è sempre un segnaposto grafico (puntini): non esiste modo di mostrare un IBAN reale.", "Claim ammesso: lista nozze / fondo regalo senza commissioni, bonifico diretto (PRODOTTO_FATTI)."],
});
