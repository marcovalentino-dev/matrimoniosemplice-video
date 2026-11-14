import { z } from "zod";
import { HOLD, ceilHalf, ease, n, pulse, seg, textDuration } from "../_shared/anim.ts";
import { esc, wordCount } from "../_shared/html.ts";
import { checkSvg, compose, icon, phoneLayout, phoneShell, phoneText, pill, ripple } from "../_shared/ui.ts";
import { siteHero, siteSection } from "../_shared/site.ts";
import { defineScene, type Cue, type OnScreenText } from "../_shared/types.ts";

const FIELD = ["menu", "accompagnatore", "allergie"] as const;
const FIELD_LABEL = { menu: "Menu", accompagnatore: "Accompagnatore", allergie: "Allergie" } as const;

const Props = z.object({
  names: z.tuple([z.string().max(16), z.string().max(16)]).default(["Giulia", "Marco"]).describe("Nomi della coppia (fittizi)"),
  date: z.string().max(24).default("12 settembre").describe("Data (fittizia)"),
  place: z.string().max(40).default("Villa dei Cipressi · Toscana").describe("Luogo (fittizio)"),
  guestName: z.string().max(24).default("Anna Rossi").describe("Nome dell'invitato che conferma (fittizio)"),
  fields: z.array(z.enum(FIELD)).max(2).default(["menu", "accompagnatore"]).describe("Campi del modulo oltre a nome e presenza (massimo 2)"),
  menuChoice: z.string().max(20).default("Vegetariano").describe("Scelta di menu mostrata (fittizia)"),
  eyebrow: z.string().max(40).optional().describe("Etichetta sopra la headline"),
  headline: z.string().max(60).optional().describe("Didascalia accanto al telefono (Playfair)"),
  shimmer: z.string().optional().describe("Sottostringa della headline con shimmer. Al massimo una per video"),
});
type P = z.output<typeof Props>;

/** Istanti dei tre tap: "Conferma la presenza", "Ci sarò", "Invia conferma". */
const TAP = [1.5, 3.0, 4.3] as const;
const CHIME = TAP[2] + 0.6;

const fieldValue = (p: P, f: (typeof FIELD)[number]) => (f === "menu" ? p.menuChoice : f === "accompagnatore" ? "Nessuno" : "Nessuna");
const firstName = (s: string) => s.trim().split(/\s+/)[0] ?? s;

const field = (y: number, label: string, value: string) =>
  `<div class="card abs" style="left:28px;top:${y}px;width:462px;height:110px;border-radius:12px;padding:18px 26px"><div class="eb" style="font-size:18px">${esc(label)}</div><div class="sans" style="font-size:32px;font-weight:500;margin-top:8px">${esc(value)}</div></div>`;

export const RsvpFlow = defineScene({
  name: "RsvpFlow",
  summary: "Telefono: l'invitato apre il sito, tocca la presenza, compila il modulo e conferma. Nessun account.",
  mockup: true,
  schema: Props,
  duration(p) {
    const words = p.headline ? wordCount(p.headline) : 0;
    const min = ceilHalf(Math.max(textDuration(words), CHIME + 0.7 + HOLD));
    return { min, recommended: min + 1.5 };
  },
  render(p, t, ctx) {
    const L = phoneLayout(ctx, !!(p.headline || p.eyebrow));
    const aOut = ease(seg(t, TAP[0] + 0.35, TAP[0] + 0.85));
    const bIn = ease(seg(t, TAP[0] + 0.7, TAP[0] + 1.2));
    const bOut = ease(seg(t, TAP[2] + 0.4, TAP[2] + 0.85));
    const cIn = ease(seg(t, TAP[2] + 0.75, TAP[2] + 1.25));
    const D = 24;

    // A: home del sito con la card RSVP
    const press0 = pulse(t, TAP[0]);
    const sA = `<div class="abs" style="left:0;top:0;width:518px;height:968px;opacity:${n(1 - aOut)};transform:translateX(${n(-aOut * D)}px)">${siteHero(p.names, p.date, p.place)}${siteSection("rsvp", 610, press0).html}</div>`;

    // B: modulo
    const sel = seg(t, TAP[1] + 0.05, TAP[1] + 0.45);
    const on = sel > 0.5;
    const press2 = pulse(t, TAP[2]);
    const fy = (i: number) => 588 + i * 128;
    const btnY = 588 + p.fields.length * 128 + 10;
    const choice = (x: number, label: string, selected: boolean) =>
      `<div class="abs sans" style="left:${x}px;top:476px;width:222px;height:84px;box-sizing:border-box;border-radius:9999px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:28px;font-weight:600;letter-spacing:.04em;background:${selected ? "var(--c-blush-light)" : "var(--c-white)"};border:${selected ? "2px solid var(--c-blush)" : "1.5px solid var(--c-border)"}">${selected ? icon("check", 28, undefined, 2.4) : ""}${label}</div>`;
    const sB = `<div class="abs" style="left:0;top:0;width:518px;height:968px;opacity:${n(bIn * (1 - bOut))};transform:translateX(${n((1 - bIn) * D - bOut * D)}px)">
<div class="abs eb sans" style="left:0;top:206px;width:518px;text-align:center;font-size:22px">RSVP</div>
<div class="abs hd" style="left:0;top:238px;width:518px;text-align:center;font-size:66px">Ci sarai?</div>
${field(340, "Nome", p.guestName)}${choice(28, "Ci sarò", on)}${choice(268, "Non potrò", false)}
${p.fields.map((f, i) => field(fy(i), FIELD_LABEL[f], fieldValue(p, f))).join("")}
<div class="abs" style="left:28px;top:${btnY}px;transform:scale(${n(1 - 0.02 * press2)})">${pill("Invia conferma", { fs: 28, w: 462, h: 96, pressed: press2 })}</div></div>`;

    // C: conferma
    const sC = `<div class="abs" style="left:0;top:0;width:518px;height:968px;opacity:${n(cIn)};transform:translateX(${n((1 - cIn) * D)}px)">
<div class="abs" style="left:184px;top:290px;width:150px;height:150px;border-radius:50%;background:var(--c-blush);box-shadow:var(--sh-blush)">${checkSvg(150, seg(t, TAP[2] + 0.8, TAP[2] + 1.5))}</div>
<div class="abs hd" style="left:0;top:480px;width:518px;text-align:center;font-size:62px">Grazie, ${esc(firstName(p.guestName))}!</div>
<div class="abs sans" style="left:0;top:576px;width:518px;text-align:center;font-size:28px;color:var(--c-muted);line-height:1.45">Ti aspettiamo<br>il ${esc(p.date)}.</div>
<div class="abs eb sans" style="left:0;top:706px;width:518px;text-align:center;font-size:20px">${esc(p.names[0])} &amp; ${esc(p.names[1])}</div></div>`;

    const ripples =
      ripple(259, 836, t, TAP[0]) + ripple(139, 518, t, TAP[1]) + ripple(259, btnY + 48, t, TAP[2]);
    const screen = `<div class="abs" style="left:0;top:0;width:518px;height:968px;overflow:hidden">${sA}${sB}${sC}${ripples}</div>`;
    return compose(t, { bg: "cream" }, phoneText(L, ctx, t, p) + phoneShell(L, t, screen));
  },
  css: "",
  cues(p) {
    return [...TAP.map((t): Cue => ({ t, type: "tap" })), { t: CHIME, type: "chime" }];
  },
  texts(p) {
    const out: OnScreenText[] = [
      { text: `${p.names[0]} & ${p.names[1]}`, role: "mock", origin: "mock" },
      { text: p.date, role: "mock", origin: "mock" },
      { text: p.place, role: "mock", origin: "mock" },
      { text: p.guestName, role: "mock", origin: "mock" },
      { text: `Grazie, ${firstName(p.guestName)}!`, role: "mock", origin: "mock" },
      ...["Ci sarai?", "Conferma la tua presenza.", "Conferma la presenza", "Ci sarò", "Non potrò", "Nome", "Invia conferma", ...p.fields.map((f) => FIELD_LABEL[f])].map(
        (text): OnScreenText => ({ text, role: "label", origin: "ui-label" }),
      ),
    ];
    if (p.eyebrow) out.unshift({ text: p.eyebrow, role: "eyebrow", origin: "prop" });
    if (p.headline) out.unshift({ text: p.headline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    return out;
  },
  preview: { props: { headline: "Pochi tap,\nnessun account." }, t: 3.6 },
  notes: ["Tre tap con onda blush: presenza, \"Ci sarò\", \"Invia conferma\". Nessun campo password o login, per costruzione.", "Nome dell'invitato e dati sono fittizi (`source: mock`)."],
});
