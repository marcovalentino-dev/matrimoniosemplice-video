import { z } from "zod";
import { HOLD, ceilHalf, ease, lerp, n, reveal, seg, textDuration } from "../_shared/anim.ts";
import { esc, richText, wordCount } from "../_shared/html.ts";
import { compose, initial, premiumBadge, rgba } from "../_shared/ui.ts";
import { defineScene, type Cue, type OnScreenText } from "../_shared/types.ts";
import { color } from "../../theme/tokens.ts";

const Props = z.object({
  headline: z.string().max(60).optional().describe("Titolo accanto alla piantina (Playfair)"),
  tables: z
    .array(z.object({ label: z.string().max(14), seats: z.number().int().min(4).max(8) }))
    .min(2)
    .max(6)
    .default([1, 2, 3, 4].map((i) => ({ label: `Tavolo ${i}`, seats: 6 })))
    .describe("Tavoli della sala (etichette fittizie) e numero di posti"),
  guests: z.array(z.string().min(1).max(12)).min(2).max(12).default(["Anna", "Luca", "Sara", "Paolo", "Elena", "Davide"]).describe("Nomi degli invitati da sistemare (fittizi)"),
}).refine((p) => p.guests.length <= p.tables.reduce((a, t) => a + t.seats, 0), { message: "Più invitati dei posti disponibili" });
type P = z.output<typeof Props>;

const START = 1.0;
const GAP = 0.55;
const TRAVEL = 0.6;
const pickAt = (g: number) => START + g * GAP;
const dropAt = (g: number) => pickAt(g) + TRAVEL;

export const TableSeating = defineScene({
  name: "TableSeating",
  summary: "Piantina della sala: gli invitati vengono trascinati dai tavoli ai posti. Etichetta Premium sempre visibile.",
  mockup: true,
  schema: Props,
  duration(p) {
    const head = p.headline ? textDuration(wordCount(p.headline)) : 0;
    const min = ceilHalf(Math.max(4, head, dropAt(p.guests.length - 1) + HOLD));
    return { min, recommended: min + 1.5 };
  },
  render(p, t, ctx) {
    const sa = ctx.safe;
    const hasHead = !!p.headline;
    const cardW = ctx.landscape ? (hasHead ? 1120 : 1400) : sa.width;
    const cardH = ctx.landscape ? sa.height : hasHead ? sa.height - 310 : sa.height;
    const cardX = ctx.landscape ? (hasHead ? sa.x + sa.width - cardW : sa.x + (sa.width - cardW) / 2) : sa.x;
    const cardY = ctx.landscape ? sa.y : sa.y + sa.height - cardH;

    const TOP = 112;
    const TRAY = 196;
    const planH = cardH - TOP - TRAY;
    const nT = p.tables.length;
    const cols = ctx.landscape ? Math.min(nT, 3) : 2;
    const rows = Math.ceil(nT / cols);
    const cellW = cardW / cols;
    const cellH = planH / rows;
    const R = Math.min(cellW, cellH) * 0.28;
    const r = R * 0.26;
    const ring = R + r * 1.6;

    const tableC = (i: number) => ({ x: (i % cols) * cellW + cellW / 2, y: TOP + Math.floor(i / cols) * cellH + cellH / 2 });
    const seatC = (ti: number, k: number) => {
      const c = tableC(ti);
      const a = ((-90 + (k * 360) / p.tables[ti].seats) * Math.PI) / 180;
      return { x: c.x + Math.cos(a) * ring, y: c.y + Math.sin(a) * ring };
    };
    // Dove va ogni invitato: giro sui tavoli, un posto alla volta.
    const dest = p.guests.map((_, g) => ({ ti: g % nT, k: Math.floor(g / nT) }));
    const seatTaken = new Map<string, number>(); // "ti:k" -> invitato che l'ha occupato
    p.guests.forEach((_, g) => {
      const d = dest[g];
      if (d.k < p.tables[d.ti].seats) seatTaken.set(`${d.ti}:${d.k}`, g);
    });

    let tablesHtml = "";
    p.tables.forEach((tb, ti) => {
      const c = tableC(ti);
      tablesHtml += `<div class="abs" data-mock style="left:${n(c.x - R)}px;top:${n(c.y - R)}px;width:${n(R * 2)}px;height:${n(R * 2)}px;border-radius:50%;background:var(--c-white);border:1px solid var(--c-border);box-shadow:var(--sh-soft);display:flex;align-items:center;justify-content:center"><span class="sans" style="font-size:30px;font-weight:600;color:var(--c-muted)">${esc(tb.label)}</span></div>`;
      for (let k = 0; k < tb.seats; k++) {
        const s = seatC(ti, k);
        const g = seatTaken.get(`${ti}:${k}`);
        const filled = g !== undefined && t >= dropAt(g);
        const land = g !== undefined ? seg(t, dropAt(g), dropAt(g) + 0.3) : 0;
        tablesHtml += `<div class="abs sans" data-mock style="left:${n(s.x - r)}px;top:${n(s.y - r)}px;width:${n(r * 2)}px;height:${n(r * 2)}px;border-radius:50%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:${n(r * 0.95)}px;font-weight:600;background:${filled ? "var(--c-blush)" : "var(--c-parchment)"};border:${filled ? "none" : "1.5px solid var(--c-border)"};transform:scale(${n(filled ? 1 + 0.12 * Math.sin(Math.PI * ease(land)) : 1)})">${filled ? initial(p.guests[g!]) : ""}</div>`;
      }
    });

    // Vassoio degli invitati in basso.
    const chipW = (name: string) => 64 + name.length * 19;
    const trayPos: { x: number; y: number; w: number }[] = [];
    {
      let x = 36;
      let y = TOP + planH + 62;
      for (const g of p.guests) {
        const w = chipW(g);
        if (x + w > cardW - 36) { x = 36; y += 62; }
        trayPos.push({ x: x + w / 2, y: y + 24, w });
        x += w + 14;
      }
    }
    let chips = "";
    p.guests.forEach((g, i) => {
      const d = dest[i];
      const prog = ease(seg(t, pickAt(i), dropAt(i)));
      const moving = t >= pickAt(i) && t < dropAt(i);
      if (t >= dropAt(i)) return;
      const s = seatC(d.ti, d.k);
      const x = lerp(trayPos[i].x, s.x, prog);
      const y = lerp(trayPos[i].y, s.y, prog);
      const lift = moving ? 1 + 0.06 * Math.sin(Math.PI * prog) : 1;
      chips += `<div class="abs sans" data-mock style="left:${n(x)}px;top:${n(y)}px;width:${trayPos[i].w}px;height:48px;margin:-24px 0 0 -${trayPos[i].w / 2}px;border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:500;background:${moving ? "var(--c-blush-light)" : "var(--c-parchment)"};border:1px solid var(--c-border);box-shadow:${moving ? `0 10px 28px ${rgba(color.ink, 0.14)}` : "none"};transform:scale(${n(lift)});z-index:${moving ? 20 : 2}">${esc(g)}</div>`;
      if (moving) {
        const k = Math.sin(Math.PI * seg(t, pickAt(i), dropAt(i)));
        chips += `<div class="abs" style="left:${n(x + 18)}px;top:${n(y + 14)}px;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:${rgba(color.ink, 0.14)};border:3px solid var(--c-white);box-shadow:var(--sh-soft-md);opacity:${n(Math.min(1, k * 3))};z-index:30"></div>`;
      }
    });

    const cr = reveal(t, 0.2, 0.8, 24);
    const card = `<div class="card abs" style="left:${cardX}px;top:${cardY}px;width:${cardW}px;height:${cardH}px;box-shadow:var(--sh-soft-md);opacity:${n(cr.p)};transform:translateY(${n(cr.y)}px)">
<div class="abs" style="left:0;top:${TOP}px;width:100%;height:${planH}px;background:var(--c-cream);border-top:1px solid var(--c-border);border-bottom:1px solid var(--c-border)"></div>
<div class="abs hd" style="left:36px;top:30px;font-size:48px">Piano tavoli</div>
<div class="abs" style="right:36px;top:30px">${premiumBadge(36)}</div>
${tablesHtml}
<div class="abs sans eb" data-mock style="left:36px;top:${TOP + planH + 14}px;font-size:24px">Invitati da sistemare</div>
${chips}</div>`;

    const hr = reveal(t, 0.2, 0.8, 20);
    const head = hasHead
      ? `<div class="abs" style="left:${sa.x}px;top:${ctx.landscape ? sa.y : sa.y + 12}px;width:${ctx.landscape ? sa.width - cardW - 96 : sa.width}px;${ctx.landscape ? `height:${sa.height}px;display:flex;align-items:center;` : ""}opacity:${n(hr.p)};transform:translateY(${n(hr.y)}px)"><h1 class="hd" style="font-size:${ctx.landscape ? 96 : 100}px;line-height:1.08">${richText(p.headline!)}</h1></div>`
      : "";
    return compose(t, { bg: "hero" }, head + card);
  },
  css: "",
  cues(p) {
    return p.guests.map((_, g): Cue => ({ t: dropAt(g), type: "drop" }));
  },
  texts(p) {
    const out: OnScreenText[] = [
      { text: "Piano tavoli", role: "label", origin: "ui-label" },
      { text: "Premium", role: "label", origin: "ui-label" },
      ...p.tables.map((tb): OnScreenText => ({ text: tb.label, role: "mock", origin: "mock" })),
      ...p.guests.map((g): OnScreenText => ({ text: g, role: "mock", origin: "mock" })),
    ];
    if (p.headline) out.unshift({ text: p.headline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    return out;
  },
  preview: { props: { headline: "Il piano tavoli,\ncon drag and drop." }, t: 3.6 },
  notes: ["Il piano tavoli è Premium: l'etichetta Premium è sempre mostrata, non si può togliere (decisione 13).", "Nomi e tavoli sono fittizi (`source: mock`). Massimo 12 invitati e 6 tavoli."],
});
