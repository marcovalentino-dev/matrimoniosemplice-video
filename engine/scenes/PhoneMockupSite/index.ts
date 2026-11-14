import { z } from "zod";
import { HOLD, ceilHalf, ease, lerp, n, seg, textDuration } from "../_shared/anim.ts";
import { wordCount } from "../_shared/html.ts";
import { compose, phoneLayout, phoneShell, phoneText } from "../_shared/ui.ts";
import { SECTION_KINDS, siteHero, siteSection } from "../_shared/site.ts";
import { defineScene, type OnScreenText } from "../_shared/types.ts";

const Props = z.object({
  names: z.tuple([z.string().max(16), z.string().max(16)]).default(["Giulia", "Marco"]).describe("Nomi della coppia (fittizi)"),
  date: z.string().max(24).default("12 settembre").describe("Data (fittizia)"),
  place: z.string().max(40).default("Villa dei Cipressi · Toscana").describe("Luogo (fittizio)"),
  sections: z.array(z.enum(SECTION_KINDS)).min(1).max(4).default(["storia", "programma", "rsvp"]).describe("Sezioni del sito mostrate scorrendo, in ordine"),
  eyebrow: z.string().max(40).optional().describe("Etichetta sopra la headline"),
  headline: z.string().max(60).optional().describe("Didascalia accanto al telefono (Playfair)"),
  shimmer: z.string().optional().describe("Sottostringa della headline con shimmer. Al massimo una per video"),
});
type P = z.output<typeof Props>;

const SCROLL_START = 1.2;
const SPEED = 240; // px dello schermo al secondo: lento, leggibile
const TAIL = 1.2;
const HERO_H = 560;

function layoutSections(p: P, pressed = 0) {
  let y = HERO_H;
  const parts = p.sections.map((k) => {
    const s = siteSection(k, y, pressed);
    y += s.h + 28;
    return s.html;
  });
  return { html: parts.join(""), contentH: y };
}

function scrollDist(p: P) {
  return Math.max(0, layoutSections(p).contentH + 12 - 968);
}

export const PhoneMockupSite = defineScene({
  name: "PhoneMockupSite",
  summary: "Telefono con il sito matrimonio (testata, storia, programma...) che scorre lentamente. Dati fittizi.",
  mockup: true,
  schema: Props,
  duration(p) {
    const words = p.headline ? wordCount(p.headline) : 0;
    const min = ceilHalf(Math.max(4, textDuration(words), SCROLL_START + scrollDist(p) / SPEED + TAIL));
    return { min, recommended: min + 1 };
  },
  render(p, t, ctx) {
    const L = phoneLayout(ctx, !!(p.headline || p.eyebrow));
    const { html } = layoutSections(p);
    const dist = scrollDist(p);
    const scroll = lerp(0, dist, ease(seg(t, SCROLL_START, Math.max(SCROLL_START + 0.5, ctx.dur - TAIL))));
    const screen = `<div class="abs" style="left:0;top:0;width:518px;height:968px;overflow:hidden"><div class="abs" style="left:0;top:0;width:518px;height:${HERO_H + 2000}px;transform:translateY(${n(-scroll)}px)">${siteHero(p.names, p.date, p.place)}${html}</div></div>`;
    return compose(t, { bg: "cream", texture: "petals" }, phoneText(L, ctx, t, p) + phoneShell(L, t, screen));
  },
  css: "",
  texts(p) {
    const out: OnScreenText[] = [
      { text: `${p.names[0]} & ${p.names[1]}`, role: "mock", origin: "mock" },
      { text: p.date, role: "mock", origin: "mock" },
      { text: p.place, role: "mock", origin: "mock" },
    ];
    if (p.eyebrow) out.unshift({ text: p.eyebrow, role: "eyebrow", origin: "prop" });
    if (p.headline) out.unshift({ text: p.headline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    const labels: Record<string, string[]> = {
      storia: ["La nostra storia"], programma: ["Programma", "Cerimonia", "Aperitivo", "Cena"], galleria: ["Gallery"],
      fondoRegalo: ["Fondo regalo", "Lista nozze senza commissioni", "Scopri"], countdown: ["Mancano"], viaggio: ["Viaggio di nozze"],
      rsvp: ["Ci sarai?", "Conferma la tua presenza.", "Conferma la presenza"],
    };
    for (const s of p.sections) for (const l of labels[s]) out.push({ text: l, role: "label", origin: "ui-label" });
    return out;
  },
  preview: { props: { headline: "Il tuo sito matrimonio,\npronto in pochi minuti.", sections: ["storia", "programma", "rsvp"] }, t: 3.4 },
  notes: ["Nomi, data e luogo sono fittizi (`source: mock`).", "Sezioni disponibili: " + SECTION_KINDS.join(", ") + ". Il fondo regalo dice solo \"lista nozze senza commissioni\"."],
});

