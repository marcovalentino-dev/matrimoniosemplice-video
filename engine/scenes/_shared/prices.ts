import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { ROOT } from "../../theme/tokens.ts";

/** Prezzi mostrabili nei video. Mai inventati: vengono solo da file (PRODOTTO_FATTI, sezione Prezzi). */
export const PricesSchema = z.object({
  valuta: z.literal("EUR"),
  mensile: z.number().positive(),
  unaTantum: z.number().positive(),
  /** Da dove sono stati letti, per il manifest. */
  source: z.string(),
});
export type Prices = z.infer<typeof PricesSchema>;

export interface PricesResult {
  prices: Prices | null;
  /** Avvisi (file con forma non riconosciuta, file mancante...). Non vuoto + prices null = E_PRICE_UNVERIFIED. */
  warnings: string[];
}

/**
 * Legge i prezzi. Ordine:
 * 1. `content/commercial.ts` (radice del repo) se esiste ed espone `mensile` e `unaTantum` (numeri);
 *    oggi il file NON è nel repository;
 * 2. `brand/prezzi.json` (confermato dall'utente il 2026-11-13).
 * Se nessuno dei due è leggibile: `prices: null` e la scena mostra il segnaposto `[PREZZO]`.
 */
export async function loadPrices(root = ROOT): Promise<PricesResult> {
  const warnings: string[] = [];

  const commercial = path.join(root, "content", "commercial.ts");
  if (existsSync(commercial)) {
    try {
      const mod = (await import(pathToFileURL(commercial).href)) as Record<string, unknown>;
      const cand = [mod.commercial, mod.default, mod].find((c) => c && typeof c === "object") as Record<string, unknown> | undefined;
      const parsed = PricesSchema.safeParse({ valuta: "EUR", mensile: cand?.mensile, unaTantum: cand?.unaTantum, source: "content/commercial.ts" });
      if (parsed.success) return { prices: parsed.data, warnings };
      warnings.push("content/commercial.ts esiste ma non espone `mensile` e `unaTantum` come numeri: uso brand/prezzi.json.");
    } catch (e) {
      warnings.push(`content/commercial.ts non leggibile (${(e as Error).message}): uso brand/prezzi.json.`);
    }
  }

  const file = path.join(root, "brand", "prezzi.json");
  if (!existsSync(file)) {
    warnings.push("Mancano content/commercial.ts e brand/prezzi.json: i prezzi non sono verificabili.");
    return { prices: null, warnings };
  }
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const parsed = PricesSchema.safeParse({ ...raw, source: "brand/prezzi.json" });
  if (!parsed.success) {
    warnings.push(`brand/prezzi.json non valido: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}.`);
    return { prices: null, warnings };
  }
  return { prices: parsed.data, warnings };
}
