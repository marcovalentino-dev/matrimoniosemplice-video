import { z } from "zod";
import { HOLD, ceilHalf, ease, n, reveal, seg, textDuration } from "../_shared/anim.ts";
import { esc, richText, wordCount } from "../_shared/html.ts";
import { checkSvg, compose, eyebrowHtml, premiumBadge } from "../_shared/ui.ts";
import { defineScene, type Cue, type OnScreenText } from "../_shared/types.ts";

const Props = z.object({
  headline: z.string().max(60).optional().describe("Titolo sopra le card (Playfair)"),
  items: z.array(z.string().min(1).max(30)).min(3).max(5).default(["Scegliere la location", "Prenotare il catering", "Inviare il salva la data", "Scegliere la musica"]).describe("Voci della checklist (fittizie), spuntate in ordine"),
  budget: z
    .array(z.object({ label: z.string().max(16), pct: z.number().min(5).max(100) }))
    .min(2)
    .max(4)
    .default([{ label: "Location", pct: 80 }, { label: "Catering", pct: 55 }, { label: "Musica", pct: 30 }])
    .describe("Barre del budget: etichetta e riempimento in % (fittizi, senza importi)"),
  timeline: z
    .array(z.object({ time: z.string().max(6).optional(), label: z.string().max(14) }))
    .min(3)
    .max(5)
    .default([{ time: "16:00", label: "Cerimonia" }, { time: "17:30", label: "Aperitivo" }, { time: "20:00", label: "Cena" }, { time: "23:00", label: "Torta" }])
    .describe("Timeline del giorno (fittizia)"),
});
type P = z.output<typeof Props>;

const tickAt = (i: number) => 1.0 + i * 0.5;
const barAt = (j: number) => 1.6 + j * 0.3;
const dotAt = (k: number) => 2.6 + k * 0.35;
const endTime = (p: P) => Math.max(tickAt(p.items.length - 1) + 0.4, barAt(p.budget.length - 1) + 0.9, dotAt(p.timeline.length - 1) + 0.4);

export const PlanningChecklist = defineScene({
  name: "PlanningChecklist",
  summary: "Planning: checklist che si spunta, budget a barre e timeline del giorno. Etichetta Premium sempre visibile.",
  mockup: true,
  schema: Props,
  duration(p) {
    const head = p.headline ? textDuration(wordCount(p.headline)) : 0;
    const min = ceilHalf(Math.max(4, head, endTime(p) + HOLD));
    return { min, recommended: min + 1.5 };
  },
  render(p, t, ctx) {
    const sa = ctx.safe;
    const land = ctx.landscape;
    const hasHead = !!p.headline;
    const headH = hasHead ? (land ? 230 : 280) : 0;

    const cardStyle = (start: number) => {
      const r = reveal(t, start, 0.7, 20);
      return `opacity:${n(r.p)};transform:translateY(${n(r.y)}px)`;
    };

    // Checklist
    const items = p.items
      .map((it, i) => {
        const k = ease(seg(t, tickAt(i), tickAt(i) + 0.35));
        return `<div style="display:flex;align-items:center;gap:22px;height:68px">
<div style="position:relative;flex:none;width:42px;height:42px;border-radius:10px;border:2px solid var(--c-border);box-sizing:border-box"><div style="position:absolute;inset:-2px;border-radius:10px;background:var(--c-blush);opacity:${n(k)}"></div><div style="position:absolute;left:-4px;top:-4px">${checkSvg(50, k, undefined, 11)}</div></div>
<span class="sans" style="font-size:34px;font-weight:500;color:${k > 0.5 ? "var(--c-muted)" : "var(--c-ink)"};text-decoration:${k > 0.5 ? "line-through" : "none"};white-space:nowrap">${esc(it)}</span></div>`;
      })
      .join("");
    const checklist = `<div class="card" data-mock style="padding:34px 36px 20px;flex:${land ? 1 : "none"};${cardStyle(0.3)}">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">${eyebrowHtml("Checklist", 30)}${premiumBadge(36)}</div>${items}</div>`;

    // Budget
    const bars = p.budget
      .map((b, j) => {
        const w = (b.pct * ease(seg(t, barAt(j), barAt(j) + 0.9))).toFixed(2);
        return `<div style="height:76px"><div class="sans" style="font-size:30px;font-weight:500;margin-bottom:12px">${esc(b.label)}</div>
<div style="height:18px;border-radius:9px;background:var(--c-parchment)"><div style="height:18px;border-radius:9px;background:var(--c-blush);width:${w}%"></div></div></div>`;
      })
      .join("");
    const budget = `<div class="card" data-mock style="padding:34px 36px 20px;flex:${land ? 1 : "none"};${cardStyle(0.5)}">${eyebrowHtml("Budget", 30, "margin-bottom:18px")}${bars}</div>`;

    // Timeline: orizzontale in 9:16, verticale in 16:9
    const m = p.timeline.length;
    let tl: string;
    if (!land) {
      tl = `<div style="position:relative;height:150px;margin-top:6px">
<div class="abs" style="left:14px;right:14px;top:13px;height:3px;background:var(--c-border)"></div>
${p.timeline
  .map((e, k) => {
    const on = ease(seg(t, dotAt(k), dotAt(k) + 0.4));
    const cx = m === 1 ? 50 : 14 + (k / (m - 1)) * 72;
    return `<div class="abs" style="left:${cx.toFixed(2)}%;top:0;width:0"><div style="position:absolute;left:-14px;top:0;width:28px;height:28px;border-radius:50%;box-sizing:border-box;border:2px solid var(--c-border);background:var(--c-white)"><div style="position:absolute;inset:-2px;border-radius:50%;background:var(--c-blush);opacity:${n(on)}"></div></div>
<div class="sans" style="position:absolute;top:44px;left:-90px;width:180px;text-align:center"><div style="font-size:28px;font-weight:600;color:var(--c-champagne)">${esc(e.time ?? "")}</div><div style="font-size:30px;font-weight:500">${esc(e.label)}</div></div></div>`;
  })
  .join("")}</div>`;
    } else {
      tl = `<div style="position:relative;margin-left:6px">
<div class="abs" style="left:13px;top:14px;bottom:14px;width:3px;background:var(--c-border)"></div>
${p.timeline
  .map((e, k) => {
    const on = ease(seg(t, dotAt(k), dotAt(k) + 0.4));
    return `<div style="position:relative;display:flex;align-items:center;gap:22px;height:72px"><div style="position:relative;flex:none;width:28px;height:28px;border-radius:50%;box-sizing:border-box;border:2px solid var(--c-border);background:var(--c-white)"><div style="position:absolute;inset:-2px;border-radius:50%;background:var(--c-blush);opacity:${n(on)}"></div></div><span class="sans" style="font-size:28px;font-weight:600;color:var(--c-champagne);width:84px">${esc(e.time ?? "")}</span><span class="sans" style="font-size:32px;font-weight:500">${esc(e.label)}</span></div>`;
  })
  .join("")}</div>`;
    }
    const timeline = `<div class="card" data-mock style="padding:34px 36px 28px;flex:${land ? 1 : "none"};${cardStyle(0.7)}">${eyebrowHtml("Timeline del giorno", 30, "margin-bottom:22px")}${tl}</div>`;

    const hr = reveal(t, 0.2, 0.8, 20);
    const head = hasHead
      ? `<div class="abs" style="left:${sa.x}px;top:${sa.y + (land ? 0 : 12)}px;width:${sa.width}px;height:${headH - 30}px;display:flex;align-items:${land ? "center" : "flex-start"};opacity:${n(hr.p)};transform:translateY(${n(hr.y)}px)"><h1 class="hd" style="font-size:${land ? 84 : 84}px;line-height:1.08">${richText(p.headline!)}</h1></div>`
      : "";
    const grid = `<div class="abs" style="left:${sa.x}px;top:${sa.y + headH}px;width:${sa.width}px;height:${sa.height - headH}px;display:flex;flex-direction:${land ? "row" : "column"};gap:${land ? 32 : 24}px;${land ? "" : "justify-content:flex-start"}">${checklist}${budget}${timeline}</div>`;
    return compose(t, { bg: "hero" }, head + grid);
  },
  css: "",
  cues(p) {
    return p.items.map((_, i): Cue => ({ t: tickAt(i), type: "tick" }));
  },
  texts(p) {
    const out: OnScreenText[] = [
      ...["Checklist", "Budget", "Timeline del giorno", "Premium"].map((text): OnScreenText => ({ text, role: "label", origin: "ui-label" })),
      ...p.items.map((text): OnScreenText => ({ text, role: "mock", origin: "mock" })),
      ...p.budget.map((b): OnScreenText => ({ text: b.label, role: "mock", origin: "mock" })),
      ...p.timeline.flatMap((e): OnScreenText[] => [...(e.time ? [{ text: e.time, role: "mock", origin: "mock" } as OnScreenText] : []), { text: e.label, role: "mock", origin: "mock" }]),
    ];
    if (p.headline) out.unshift({ text: p.headline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    return out;
  },
  preview: { props: { headline: "Tutto il planning\nin un unico posto." }, t: 5.2 },
  notes: ["Planning (checklist, budget, fornitori, timeline) è Premium: l'etichetta Premium è sempre mostrata.", "Voci, percentuali e orari sono fittizi (`source: mock`); il budget non mostra importi."],
});
