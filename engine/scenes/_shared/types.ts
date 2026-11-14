import type { z } from "zod";
import type { FormatId, SafeArea } from "../../theme/safe-area.ts";

/**
 * Contesto di una scena: formato, safe area e durata dello shot.
 * Le scene sono funzioni pure di (props, t, ctx): niente stato, niente Date.now, niente Math.random.
 */
export interface SceneCtx {
  format: FormatId;
  w: number;
  h: number;
  landscape: boolean;
  safe: SafeArea;
  /** Durata dello shot in secondi (le scene adattano scorrimenti e pause alla durata reale). */
  dur: number;
}

/** Cue audio dichiarati dalla scena (stessa timeline dell'immagine, SPEC §3 stadio 5). */
export type CueType = "ping" | "key" | "tap" | "chime" | "tick" | "sort" | "press" | "drop" | "copy";
export interface Cue {
  t: number;
  type: CueType;
}

/**
 * Origine di un testo leggibile, per il lint dello storyboard (SPEC §5.2):
 * - prop: testo passato dal regista nelle props -> serve una `source` (claim, cta...) nello storyboard;
 * - mock: dato fittizio dentro un mockup (nomi, date, conteggi) -> `source: mock`;
 * - ui-label: etichetta d'interfaccia fissa della scena (funzione presente in PRODOTTO_FATTI);
 * - price: prezzo letto da file (o segnaposto `[PREZZO]` se il file manca).
 */
export type TextOrigin = "prop" | "mock" | "ui-label" | "price";
export interface OnScreenText {
  text: string;
  role: "eyebrow" | "headline" | "sub" | "caption" | "cta" | "label" | "price" | "mock";
  origin: TextOrigin;
}

export interface DurationInfo {
  min: number;
  recommended: number;
}

export interface SceneDef<S extends z.ZodType = z.ZodType> {
  name: string;
  /** Una riga: cosa mostra. */
  summary: string;
  /** Vero se contiene un'interfaccia ricreata (dati fittizi, `mockup: true` nello storyboard). */
  mockup: boolean;
  schema: S;
  /** Durata minima/consigliata per queste props (min: testo leggibile, animazioni completate). */
  duration(props: z.output<S>): DurationInfo;
  /** HTML interno del frame (elementi posizionati in assoluto, sfondo compreso). Puro su `t`. */
  render(props: z.output<S>, t: number, ctx: SceneCtx): string;
  /** CSS aggiuntivo della scena (classi con prefisso proprio). */
  css: string;
  cues?(props: z.output<S>, ctx: SceneCtx): Cue[];
  /** Tutto il testo leggibile, per lint e QA. */
  texts(props: z.output<S>): OnScreenText[];
  /** Risoluzione asincrona di dati esterni (es. prezzi da file) prima del render. */
  resolve?(props: z.output<S>): Promise<z.output<S>>;
  /** Props d'esempio e istante del fotogramma di prova. */
  preview: { props: z.input<S>; t: number };
  /** Note per il regista (regole d'uso che non stanno nello schema). */
  notes?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyScene = SceneDef<any>;

export function defineScene<S extends z.ZodType>(def: SceneDef<S>): SceneDef<S> {
  return def;
}
