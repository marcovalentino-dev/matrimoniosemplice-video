import { z } from "zod";
import { breath, ceilHalf, ease, lerp, n, pulse, reveal, seg } from "../_shared/anim.ts";
import { esc, richText } from "../_shared/html.ts";
import { compose, logoHtml, safeBox } from "../_shared/ui.ts";
import { defineScene, type Cue, type OnScreenText } from "../_shared/types.ts";

const Props = z.object({
  tagline: z.string().max(50).optional().describe("Frase di chiusura in Playfair corsivo. `*parola*` = corsivo, `\\n` = a capo"),
  cta: z.string().min(1).max(40).default("Crea il tuo sito matrimonio").describe("Testo della pillola CTA (copy ufficiale, decisione 6)"),
  url: z.string().max(60).default("www.matrimoniosemplice.com").describe("URL sotto la pillola (ufficiale, decisione 6)"),
  wordmark: z.boolean().default(true).describe("Mostra il nome MatrimonioSemplice sotto il logo"),
  press: z.boolean().default(true).describe("Simula il tap sulla pillola (onda blush)"),
});
type P = z.output<typeof Props>;

const CTA_IN = 0.4;
const PRESS = 2.4;
/** La pillola entra entro 1,0 s e resta ferma almeno 3 s (BRAND_VIDEO §6). */
const MIN = 4;

export const EndCard = defineScene({
  name: "EndCard",
  summary: "Chiusura: logo, frase, un solo CTA a pillola (con tap simulato) e URL.",
  mockup: false,
  schema: Props,
  duration() {
    return { min: MIN, recommended: ceilHalf(5) };
  },
  render(p, t, ctx) {
    const land = ctx.landscape;
    const lg = reveal(t, 0, 0.6, 20);
    const logo = `<div style="width:${land ? 100 : 120}px;height:${land ? 100 : 120}px;border-radius:27px;box-shadow:var(--sh-blush);opacity:${n(lg.p)};transform:translateY(${n(lg.y)}px)">${logoHtml(land ? 100 : 120)}</div>`;
    const wm = p.wordmark
      ? (() => {
          const r = reveal(t, 0.1, 0.7, 20);
          return `<div class="hd" style="font-size:${land ? 52 : 62}px;margin-top:26px;letter-spacing:.01em;opacity:${n(r.p)};transform:translateY(${n(r.y)}px)">MatrimonioSemplice</div>`;
        })()
      : "";
    const dv = ease(seg(t, 0.2, 0.7));
    const divider = p.tagline ? `<div style="width:60px;height:2px;background:var(--c-champagne);margin:${land ? 34 : 44}px 0 ${land ? 30 : 44}px;opacity:${n(dv)};transform:scaleX(${n(dv)})"></div>` : `<div style="height:${land ? 40 : 60}px"></div>`;
    const tg = p.tagline
      ? (() => {
          const r = reveal(t, 0.2, 0.8, 20);
          return `<div class="hd italic" style="font-size:${land ? 120 : 150}px;font-weight:400;line-height:1.04;max-width:${land ? 1500 : ctx.safe.width}px;opacity:${n(r.p)};transform:translateY(${n(r.y)}px)">${richText(p.tagline)}</div>`;
        })()
      : "";
    const r = reveal(t, CTA_IN, 0.6, 20);
    const pr = p.press ? pulse(t, PRESS, 0.14, 0.3, 0.16) : 0;
    const rk = p.press ? seg(t, PRESS, PRESS + 0.9) : 0;
    const breathe = 1 + 0.03 * breath(t, CTA_IN + 0.7, 3.2);
    const fs = land ? 44 : 46;
    const cta = `<div style="position:relative;margin-top:${land ? 52 : 80}px;opacity:${n(r.p)};transform:translateY(${n(r.y)}px) scale(${n(breathe)})">
<div class="pillbtn" style="font-size:${fs}px;height:${land ? 124 : 150}px;padding:0 ${land ? 96 : 100}px;background:${pr > 0.5 ? "var(--c-rose)" : "var(--c-blush)"}">${esc(p.cta)}</div>
<div class="ripple" style="left:50%;top:50%;width:200px;height:200px;margin:-100px 0 0 -100px;opacity:${n(rk > 0 && rk < 1 ? 0.6 * (1 - ease(rk)) : 0)};transform:scale(${n(lerp(0.4, 4.2, ease(rk)))})"></div></div>`;
    const ur = reveal(t, 0.6, 0.6, 20);
    const url = `<div class="sans" style="margin-top:${land ? 36 : 48}px;font-size:40px;font-weight:600;letter-spacing:.06em;color:var(--c-champagne);opacity:${n(ur.p)};transform:translateY(${n(ur.y)}px)">${esc(p.url)}</div>`;
    return compose(t, { bg: "hero" }, safeBox(ctx, logo + wm + divider + tg + cta + url, "display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center"));
  },
  css: "",
  cues(p) {
    return p.press ? ([{ t: PRESS, type: "press" }] satisfies Cue[]) : [];
  },
  texts(p) {
    const out: OnScreenText[] = [
      ...(p.wordmark ? [{ text: "MatrimonioSemplice", role: "label", origin: "ui-label" } as OnScreenText] : []),
      { text: p.cta, role: "cta", origin: "prop" },
      { text: p.url, role: "label", origin: "prop" },
    ];
    if (p.tagline) out.splice(p.wordmark ? 1 : 0, 0, { text: p.tagline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    return out;
  },
  preview: { props: { tagline: "Dal caos\nall'*RSVP.*" }, t: 3.2 },
  notes: ["Un solo CTA per end card. Il testo del CTA deve coincidere con `brief.cta.label`.", "Il logo è assets/logo/icon.svg (solo icona): il nome è reso come testo Playfair."],
});

