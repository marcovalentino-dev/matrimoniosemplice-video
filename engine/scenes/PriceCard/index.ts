import { z } from "zod";
import { HOLD, ceilHalf, n, reveal, textDuration } from "../_shared/anim.ts";
import { esc, richText, wordCount } from "../_shared/html.ts";
import { compose, eyebrowHtml, safeBox } from "../_shared/ui.ts";
import { PricesSchema, loadPrices } from "../_shared/prices.ts";
import { defineScene, type OnScreenText } from "../_shared/types.ts";

const KINDS = ["mensile", "unaTantum"] as const;
const DEFAULT_LABEL = { mensile: "Mensile", unaTantum: "Una tantum" } as const;
const DEFAULT_UNIT = { mensile: "al mese", unaTantum: "pagamento unico" } as const;
const PLACEHOLDER = "[PREZZO]";

const Props = z.object({
  eyebrow: z.string().max(30).optional().describe("Etichetta sopra la headline"),
  headline: z.string().max(60).optional().describe("Titolo sopra le card (Playfair)"),
  plans: z
    .array(z.object({ kind: z.enum(KINDS), label: z.string().max(20).optional(), unit: z.string().max(30).optional() }))
    .min(1)
    .max(2)
    .default([{ kind: "mensile" }, { kind: "unaTantum" }])
    .describe("Card da mostrare. Etichetta e unità hanno un default; il prezzo viene sempre da file"),
  priceRef: z.string().default("brand/prezzi.json").describe("File da cui sono letti i prezzi (content/commercial.ts se esiste, altrimenti brand/prezzi.json)"),
  prices: PricesSchema.optional().describe("Compilato da `resolve` (non scriverlo a mano). Se manca il render mostra [PREZZO]"),
});
type P = z.output<typeof Props>;

function fmt(x: number): string {
  return x.toLocaleString("it-IT", { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 });
}

const priceOf = (p: P, kind: (typeof KINDS)[number]) => (p.prices ? fmt(p.prices[kind]) : PLACEHOLDER);
const cardAt = (i: number) => 0.4 + i * 0.4;

export const PriceCard = defineScene({
  name: "PriceCard",
  summary: "Card dei prezzi (mensile e/o una tantum) letti da file. Senza elenco di funzioni: i file non dicono cosa includa ciascun piano.",
  mockup: false,
  schema: Props,
  duration(p) {
    const head = p.headline ? textDuration(wordCount(p.headline)) : 0;
    const min = ceilHalf(Math.max(4, head, cardAt(p.plans.length - 1) + 0.7 + HOLD));
    return { min, recommended: min + 2 };
  },
  async resolve(p) {
    const r = await loadPrices();
    return { ...p, prices: r.prices ?? undefined };
  },
  render(p, t, ctx) {
    const sa = ctx.safe;
    const cards = p.plans
      .map((pl, i) => {
        const r = reveal(t, cardAt(i), 0.8, 24);
        const price = priceOf(p, pl.kind);
        const placeholder = price === PLACEHOLDER;
        const body = placeholder
          ? `<span class="hd" style="font-size:120px;font-weight:700;line-height:1">${PLACEHOLDER}</span>`
          : `<span class="hd" style="font-size:${ctx.landscape ? 200 : 188}px;font-weight:700;line-height:1">${esc(price)}</span><span class="hd" style="font-size:${ctx.landscape ? 100 : 96}px;font-weight:600;margin-left:12px">€</span>`;
        return `<div class="card" style="flex:1;box-shadow:var(--sh-soft-md);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:20px;opacity:${n(r.p)};transform:translateY(${n(r.y)}px)">
${eyebrowHtml(pl.label ?? DEFAULT_LABEL[pl.kind], 40)}<div style="display:flex;align-items:baseline;justify-content:center">${body}</div><p class="bd" style="font-size:44px">${esc(pl.unit ?? DEFAULT_UNIT[pl.kind])}</p></div>`;
      })
      .join("");
    const hr = reveal(t, 0.1, 0.8, 20);
    const head =
      p.headline || p.eyebrow
        ? `<div style="text-align:center;margin-bottom:48px;opacity:${n(hr.p)};transform:translateY(${n(hr.y)}px)">${p.eyebrow ? eyebrowHtml(p.eyebrow, 36, "margin-bottom:16px") : ""}${p.headline ? `<h1 class="hd" style="font-size:${ctx.landscape ? 84 : 88}px;line-height:1.08">${richText(p.headline)}</h1>` : ""}</div>`
        : "";
    const grid = `<div style="display:flex;flex-direction:${ctx.landscape ? "row" : "column"};gap:32px;${ctx.landscape ? "height:560px" : `height:${p.plans.length * 420 + 32}px`};width:100%;max-width:${ctx.landscape ? 1500 : sa.width}px">${cards}</div>`;
    return compose(t, { bg: "hero" }, safeBox(ctx, head + grid, "display:flex;flex-direction:column;justify-content:center;align-items:center"));
  },
  css: "",
  texts(p) {
    const out: OnScreenText[] = p.plans.flatMap((pl): OnScreenText[] => [
      { text: pl.label ?? DEFAULT_LABEL[pl.kind], role: "label", origin: pl.label ? "prop" : "ui-label" },
      { text: `${priceOf(p, pl.kind)} €`, role: "price", origin: "price" },
      { text: pl.unit ?? DEFAULT_UNIT[pl.kind], role: "sub", origin: pl.unit ? "prop" : "ui-label" },
    ]);
    if (p.eyebrow) out.unshift({ text: p.eyebrow, role: "eyebrow", origin: "prop" });
    if (p.headline) out.unshift({ text: p.headline.replace(/\*/g, ""), role: "headline", origin: "prop" });
    return out;
  },
  preview: { props: { eyebrow: "Prezzi", plans: [{ kind: "mensile" }, { kind: "unaTantum" }] }, t: 2.8 },
  notes: [
    "I prezzi non sono mai nelle props scritte dal regista: `resolve` li legge da content/commercial.ts (se esiste) o da brand/prezzi.json (EUR 12 al mese, EUR 79 una tantum, confermati il 2026-11-13).",
    "Senza file leggibile la scena mostra [PREZZO] e il lint dello storyboard segnala E_PRICE_UNVERIFIED (solo bozza).",
    "Non dire cosa include ciascun piano e non scrivere \"Premium\" accanto ai prezzi: nei file non è detto.",
  ],
});
