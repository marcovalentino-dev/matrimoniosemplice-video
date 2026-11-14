import { z } from "zod";
import { HOLD, ceilHalf, clamp, ease, lerp, n, reveal, seg, textDuration } from "../_shared/anim.ts";
import { esc, richText, wordCount } from "../_shared/html.ts";
import { compose, eyebrowHtml, initial } from "../_shared/ui.ts";
import { defineScene, type Cue, type OnScreenText } from "../_shared/types.ts";

const Status = z.enum(["confermato", "in_attesa", "non_puo"]);
type Status = z.infer<typeof Status>;

const DEFAULT_GUESTS = [
  { name: "Luca Bianchi", status: "in_attesa", note: "In attesa di risposta", confirmedNote: "Menu carne · +1" },
  { name: "Sara Conti", status: "confermato", note: "Menu pesce · +1" },
  { name: "Paolo Greco", status: "in_attesa", note: "In attesa di risposta", confirmedNote: "Menu pesce" },
  { name: "Elena Marino", status: "non_puo", note: "Non può esserci" },
  { name: "Davide Ferri", status: "in_attesa", note: "In attesa di risposta", confirmedNote: "Menu vegetariano · allergia: noci" },
  { name: "Chiara Neri", status: "confermato", note: "Menu carne" },
  { name: "Marta Gallo", status: "in_attesa", note: "In attesa di risposta", confirmedNote: "Menu carne" },
  { name: "Anna Rossi", status: "in_attesa", note: "In attesa di risposta", confirmedNote: "Vegetariano · nessun accompagnatore" },
] as const;

const Props = z.object({
  eyebrow: z.string().max(40).optional().describe("Etichetta sopra la headline (es. nomi della coppia, fittizi)"),
  headline: z.string().max(60).optional().describe("Titolo sopra il contatore (Playfair)"),
  counterLabel: z.string().max(20).default("Conferme").describe("Etichetta del contatore"),
  guests: z
    .array(z.object({ name: z.string().max(24), status: Status, note: z.string().max(40), confirmedNote: z.string().max(40).optional() }))
    .min(4)
    .max(8)
    .default(DEFAULT_GUESTS.map((g) => ({ ...g })))
    .describe("Invitati (fittizi). `confirmedNote` = nota che compare quando un invitato in attesa conferma"),
  confirmCount: z.number().int().min(0).max(6).default(4).describe("Quanti invitati in attesa confermano durante la scena"),
});
type P = z.output<typeof Props>;

const FIRST = 1.4;
const STEP = 0.9;
const SORT_DELAY = 0.45;
const SORT_DUR = 0.65;
const ROW = 96;
const RANK: Record<Status, number> = { confermato: 0, in_attesa: 1, non_puo: 2 };
const BADGE: Record<Status, { label: string; bg: string; fg: string }> = {
  confermato: { label: "Confermato", bg: "var(--c-blush-light)", fg: "var(--c-ink)" },
  in_attesa: { label: "In attesa", bg: "var(--c-parchment)", fg: "var(--c-muted)" },
  non_puo: { label: "Non può", bg: "var(--c-gold-pale)", fg: "var(--c-muted)" },
};

/** Indici degli invitati che confermano, nell'ordine, e istante di ogni conferma. */
function flips(p: P): { idx: number; at: number }[] {
  const pend = p.guests.map((g, i) => ({ g, i })).filter((x) => x.g.status === "in_attesa");
  return pend.slice(0, p.confirmCount).map((x, k) => ({ idx: x.i, at: FIRST + k * STEP }));
}

/** Ordine delle righe dopo ogni conferma (ordinamento stabile per stato). */
function orders(p: P): number[][] {
  const st = p.guests.map((g) => g.status as Status);
  let cur = p.guests.map((_, i) => i);
  const all = [cur];
  for (const f of flips(p)) {
    st[f.idx] = "confermato";
    const prev = cur;
    cur = prev.slice().sort((a, b) => RANK[st[a]] - RANK[st[b]] || prev.indexOf(a) - prev.indexOf(b));
    all.push(cur);
  }
  return all;
}

function endTime(p: P) {
  const f = flips(p);
  return f.length ? f[f.length - 1].at + SORT_DELAY + SORT_DUR : 1.5;
}

export const GuestDashboard = defineScene({
  name: "GuestDashboard",
  summary: "Dashboard invitati: il contatore delle conferme sale e le righe si ordinano per stato. Dati fittizi.",
  mockup: true,
  schema: Props,
  duration(p) {
    const head = p.headline ? textDuration(wordCount(p.headline)) : 0;
    const min = ceilHalf(Math.max(4, head, endTime(p) + HOLD));
    return { min, recommended: min + 1.5 };
  },
  render(p, t, ctx) {
    const sa = ctx.safe;
    const total = p.guests.length;
    const fl = flips(p);
    const ord = orders(p);
    const baseConfirmed = p.guests.filter((g) => g.status === "confermato").length;
    const count = baseConfirmed + fl.filter((f) => t >= f.at).length;

    // Fase di riordino corrente.
    let ph = 0;
    let pe = 0;
    fl.forEach((f, k) => {
      const a = f.at + SORT_DELAY;
      if (t >= a) {
        ph = k + 1;
        pe = ease(seg(t, a, a + SORT_DUR));
      }
    });
    const lastFlip = fl.filter((f) => t >= f.at).pop();
    const pop = lastFlip ? 1 - seg(t, lastFlip.at, lastFlip.at + 0.5) : 0;

    // Geometria
    const listW = ctx.landscape ? 960 : sa.width;
    const listH = Math.min(ctx.landscape ? sa.height : sa.height - 452, 52 + total * ROW);
    const listX = ctx.landscape ? sa.x + sa.width - listW : sa.x;
    const listY = ctx.landscape ? sa.y + (sa.height - listH) / 2 : sa.y + 452;
    const leftW = ctx.landscape ? sa.width - listW - 96 : sa.width;
    const leftX = sa.x;

    const hd = reveal(t, 0.2, 0.8, 20);
    const header = `<div class="abs" style="left:${leftX}px;top:${ctx.landscape ? sa.y + 130 : sa.y + 8}px;width:${leftW}px;opacity:${n(hd.p)};transform:translateY(${n(hd.y)}px)">
${p.eyebrow ? eyebrowHtml(p.eyebrow, 36, "margin-bottom:14px") : ""}${p.headline ? `<h1 class="hd" style="font-size:${ctx.landscape ? 84 : 64}px;line-height:1.1">${richText(p.headline)}</h1>` : ""}</div>`;

    const cardR = reveal(t, 0.5, 0.8, 20);
    const cx = ctx.landscape ? leftX : sa.x;
    const cy = ctx.landscape ? sa.y + 130 + (p.headline ? 420 : 160) : sa.y + 220;
    const cw = ctx.landscape ? leftW : sa.width;
    const barW = ctx.landscape ? 250 : 368;
    const counter = `<div class="card abs" data-mock style="left:${cx}px;top:${cy}px;width:${cw}px;height:210px;opacity:${n(cardR.p)};transform:translateY(${n(cardR.y)}px)">
<div class="abs" style="left:44px;top:34px">${eyebrowHtml(p.counterLabel, 30)}</div>
<div class="abs hd" style="left:44px;top:70px;font-size:104px;line-height:1;transform-origin:left center;transform:scale(${n(1 + 0.05 * Math.sin(Math.PI * clamp(1 - pop)))})">${count}</div>
<div class="abs sans" style="left:${count >= 10 ? 190 : 140}px;top:116px;font-size:36px;color:var(--c-muted)">di ${total} invitati</div>
<div class="abs" style="right:44px;top:98px;width:${barW}px;height:16px;border-radius:8px;background:var(--c-parchment)"></div>
<div class="abs" style="right:${44 + barW - (barW * count) / total}px;top:98px;width:${n((barW * count) / total)}px;height:16px;border-radius:8px;background:var(--c-blush)"></div></div>`;

    const rows = p.guests
      .map((g, i) => {
        const from = ord[Math.max(0, ph - 1)].indexOf(i);
        const to = ord[ph].indexOf(i);
        const pos = ph === 0 ? from : lerp(from, to, pe);
        const moving = ph > 0 && pe > 0 && pe < 1 && to < from;
        const fi = fl.findIndex((f) => f.idx === i);
        const confirmed = fi >= 0 && t >= fl[fi].at;
        const status: Status = confirmed ? "confermato" : (g.status as Status);
        const note = confirmed && g.confirmedNote ? g.confirmedNote : g.note;
        const hl = confirmed ? 1 - seg(t, fl[fi].at + 0.2, fl[fi].at + 1.4) : 0;
        const B = BADGE[status];
        return `<div class="abs" style="left:36px;top:${n(26 + pos * ROW)}px;width:${listW - 72}px;height:${ROW}px;box-sizing:border-box;border-radius:16px;z-index:${moving ? 5 : 1};box-shadow:${moving ? "0 8px 30px rgba(30,30,30,.10)" : "none"};background:rgb(255,${Math.round(255 - 15 * hl)},${Math.round(255 - 14 * hl)})">
<div class="abs serif" style="left:18px;top:20px;width:56px;height:56px;border-radius:50%;background:var(--c-blush-light);border:1.5px solid var(--c-border);font-size:30px;line-height:53px;text-align:center">${initial(g.name)}</div>
<div class="abs sans" style="left:94px;top:14px;font-size:34px;font-weight:600;white-space:nowrap">${esc(g.name)}</div>
<div class="abs sans" style="left:94px;top:56px;font-size:24px;color:var(--c-muted);white-space:nowrap">${esc(note)}</div>
<div class="abs sans" style="right:20px;top:26px;height:44px;line-height:44px;padding:0 20px;border-radius:8px;font-size:26px;font-weight:600;background:${B.bg};color:${B.fg}">${B.label}</div></div>`;
      })
      .join("");
    const lr = reveal(t, 0.7, 0.8, 20);
    const list = `<div class="card abs" data-mock style="left:${listX}px;top:${listY}px;width:${listW}px;height:${listH}px;opacity:${n(lr.p)};transform:translateY(${n(lr.y)}px)">${rows}</div>`;
    return compose(t, { bg: "hero" }, header + counter + list);
  },
  css: "",
  cues(p) {
    return flips(p).flatMap((f): Cue[] => [{ t: f.at, type: "tick" }, { t: f.at + SORT_DELAY, type: "sort" }]);
  },
  texts(p) {
    const out: OnScreenText[] = [
      { text: p.counterLabel, role: "label", origin: "ui-label" },
      { text: `di ${p.guests.length} invitati`, role: "mock", origin: "mock" },
      ...p.guests.flatMap((g): OnScreenText[] => [
        { text: g.name, role: "mock", origin: "mock" },
        { text: g.note, role: "mock", origin: "mock" },
        ...(g.confirmedNote ? [{ text: g.confirmedNote, role: "mock", origin: "mock" } as OnScreenText] : []),
      ]),
      ...Object.values(BADGE).map((b): OnScreenText => ({ text: b.label, role: "label", origin: "ui-label" })),
    ];
    if (p.eyebrow) out.unshift({ text: p.eyebrow, role: "eyebrow", origin: "prop" });
    if (p.headline) out.unshift({ text: p.headline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    return out;
  },
  preview: { props: { eyebrow: "Giulia & Marco", headline: "Le conferme si ordinano\nda sole." }, t: 5.6 },
  notes: ["Invitati, note e conteggi sono fittizi (`source: mock`).", "Il contatore parte dai confermati di `guests` e sale di uno a ogni conferma; massimo 8 invitati."],
});
