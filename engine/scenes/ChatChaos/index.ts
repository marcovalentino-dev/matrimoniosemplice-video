import { z } from "zod";
import { HOLD, ceilHalf, ease, lerp, n, reveal, rng, seg, textDuration } from "../_shared/anim.ts";
import { esc, richText, wordCount } from "../_shared/html.ts";
import { compose } from "../_shared/ui.ts";
import { fontStack } from "../../theme/fonts.ts";
import { defineScene, type Cue, type OnScreenText } from "../_shared/types.ts";
import { color } from "../../theme/tokens.ts";

const DEFAULT_MESSAGES: { text: string; side: "l" | "r" }[] = [
  ["ci sono", "r"], ["forse", "l"], ["non so", "r"], ["porto un amico?", "l"], ["ci sono! o forse no", "r"],
  ["scusate che giorno era?", "l"], ["io sono vegetariana", "r"], ["+1?", "l"], ["domani vi dico", "r"],
  ["ma i bimbi?", "l"], ["ci sono", "r"], ["boh", "l"], ["forse ci sono", "r"],
].map(([text, side]) => ({ text, side: side as "l" | "r" }));

const Props = z.object({
  title: z.string().max(30).default("Gruppo Matrimonio").describe("Nome della chat (dato fittizio)"),
  messages: z
    .array(z.object({ text: z.string().min(1).max(40), side: z.enum(["l", "r"]) }))
    .min(3)
    .max(16)
    .default(DEFAULT_MESSAGES)
    .describe("Messaggi in ordine di arrivo (fittizi). `l` = sinistra, `r` = destra"),
  density: z.enum(["bassa", "media", "alta"]).default("alta").describe("Quanto si sovrappongono e quanto in fretta arrivano"),
  headline: z.string().max(60).optional().describe("Titolo sopra la chat (Playfair)"),
});
type P = z.output<typeof Props>;

const GAP = { bassa: 0.6, media: 0.42, alta: 0.3 } as const;
const START = 0.9;
const msgAt = (p: P, i: number) => START + i * GAP[p.density];

export const ChatChaos = defineScene({
  name: "ChatChaos",
  summary: "Chat di gruppo generica che si riempie di messaggi sovrapposti (il caos delle conferme).",
  mockup: true,
  schema: Props,
  duration(p) {
    const end = msgAt(p, p.messages.length - 1) + 0.55;
    const head = p.headline ? textDuration(wordCount(p.headline)) : 0;
    const min = ceilHalf(Math.max(3, head, end + 1));
    return { min, recommended: min + 1.5 };
  },
  render(p, t, ctx) {
    const sa = ctx.safe;
    const hasHead = !!p.headline;
    // Geometria: 9:16 titolo sopra e chat sotto; 16:9 titolo a sinistra e chat a destra.
    const cardW = ctx.landscape ? (hasHead ? 880 : 1000) : sa.width;
    const cardH = ctx.landscape ? sa.height : hasHead ? sa.height - 340 : Math.min(sa.height, 1200);
    const cardX = ctx.landscape ? (hasHead ? sa.x + sa.width - cardW : sa.x + (sa.width - cardW) / 2) : sa.x;
    const cardY = ctx.landscape ? sa.y : hasHead ? sa.y + 340 : sa.y + (sa.height - cardH) / 2;

    const head = hasHead
      ? (() => {
          const r = reveal(t, 0.3, 0.8, 20);
          const box = ctx.landscape
            ? `left:${sa.x}px;top:${sa.y}px;width:${sa.width - cardW - 96}px;height:${sa.height}px;display:flex;align-items:center`
            : `left:${sa.x}px;top:${sa.y + 12}px;width:${sa.width}px`;
          return `<div class="abs" style="${box};opacity:${n(r.p)};transform:translateY(${n(r.y)}px)"><h1 class="hd" style="font-size:${ctx.landscape ? 104 : 112}px;font-weight:500;line-height:1.08">${richText(p.headline!)}</h1></div>`;
        })()
      : "";

    // Posizioni: il passo si stringe col procedere dei messaggi (più messaggi, più sovrapposizione).
    const rand = rng(11);
    const N = p.messages.length;
    const bubH = 100;
    const usable = cardH - 110 - 48 - bubH;
    const minStep = { bassa: 78, media: 54, alta: 34 }[p.density];
    let steps = p.messages.map((_, i) => lerp(105, minStep, N > 1 ? i / (N - 1) : 0));
    const total = steps.slice(0, -1).reduce((a, b) => a + b, 0);
    if (total > usable) steps = steps.map((s) => s * (usable / total));
    let y = 24;
    const bubbles = p.messages
      .map((m, i) => {
        const top = 110 + y;
        y += steps[i];
        const dx = Math.round(rand() * 70);
        const rot = (rand() * 2.6 - 1.3) * (i % 2 ? 1 : -1);
        const r = reveal(t, msgAt(p, i), 0.55, 24);
        const side = m.side === "l" ? `left:${40 + dx}px;border-bottom-left-radius:12px;background:var(--c-parchment)` : `right:${40 + dx}px;border-bottom-right-radius:12px;background:var(--c-blush-light)`;
        return `<div class="cc-bub" data-mock style="top:${n(top)}px;${side};opacity:${n(r.p)};transform:translateY(${n(r.y)}px) rotate(${n(rot)}deg);z-index:${i}">${esc(m.text)}</div>`;
      })
      .join("");

    const avatars = ["A", "L", "S"]
      .map((c, i) => `<div class="abs serif" style="left:${36 + i * 44}px;top:27px;width:56px;height:56px;border-radius:50%;background:${[color.parchment, color.blushLight, color.goldPale][i]};border:2px solid var(--c-white);font-size:28px;line-height:52px;text-align:center">${c}</div>`)
      .join("");
    const chat = `<div class="card abs" data-mock style="left:${cardX}px;top:${cardY}px;width:${cardW}px;height:${cardH}px;box-shadow:var(--sh-soft-md);opacity:${n(ease(seg(t, 0.1, 0.7)))}">
<div class="abs" style="left:0;top:0;width:100%;height:110px;border-bottom:1px solid var(--c-border);background:var(--c-white);z-index:100">${avatars}<div class="abs sans" style="left:190px;top:30px;font-size:38px;font-weight:600">${esc(p.title)}</div></div>${bubbles}</div>`;
    return compose(t, { bg: "hero" }, head + chat);
  },
  css: `.cc-bub{position:absolute;font-family:${fontStack.body};font-size:44px;line-height:1.25;padding:22px 38px;border-radius:38px;color:var(--c-ink);white-space:nowrap}`,
  cues(p) {
    return p.messages.map((m, i): Cue => ({ t: msgAt(p, i), type: "ping" }));
  },
  texts(p) {
    const out: OnScreenText[] = [{ text: p.title, role: "mock", origin: "mock" }, ...p.messages.map((m): OnScreenText => ({ text: m.text, role: "mock", origin: "mock" }))];
    if (p.headline) out.unshift({ text: p.headline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    return out;
  },
  preview: { props: { headline: "Dal caos delle\nconferme…" }, t: 5.4 },
  notes: ["Messaggi e nomi sono fittizi: nello storyboard vanno con `source: mock`.", "Le bolle si sovrappongono di proposito ma con la stessa dolcezza del resto: niente flash, niente scossoni."],
});

