import { SCENES, type AnyScene } from "../scenes/index.ts";
import type { Brief } from "../schemas/brief.ts";
import type { Storyboard } from "../schemas/storyboard.ts";
import type { ErrorCode } from "../utils/errors.ts";
import type { Fact } from "./facts.ts";

export const OFFICIAL_URL = "www.matrimoniosemplice.com";
export const PRICE_FILE = "brand/prezzi.json";
/** Tolleranza sui timecode (s). */
const EPS = 0.005;

export interface LintIssue {
  code: ErrorCode;
  msg: string;
  shot?: string;
}
export interface LintResult {
  errors: LintIssue[];
  warnings: string[];
}

/** Tutte le stringhe di un valore JSON, con il percorso (`headline`, `items[0].text`). */
export function stringsOf(v: unknown, path = ""): { path: string; value: string }[] {
  if (typeof v === "string") return [{ path, value: v }];
  if (Array.isArray(v)) return v.flatMap((x, i) => stringsOf(x, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => stringsOf(x, path ? `${path}.${k}` : k));
  return [];
}

/** Per confrontare un testo di props con uno a schermo: via markup, a capo e maiuscole. */
export const norm = (s: string) => s.replace(/\*/g, "").replace(/\\n|\n/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

const MONEY = /€|\beuro\b|\beur\b|\d\s*(?:€|euro\b)/i;
const INVENTED: [RegExp, string][] = [
  [/\d\s*%/, "percentuale"],
  [/\d[\d.,]*\s*(?:coppie|utenti|matrimoni|invitati|recensioni|clienti)\b/i, "numero di utenti/coppie/matrimoni"],
  [/\b(?:recensioni|testimonianz[ae]|stelle|premiat[oa]|premio|migliaia|milioni|il migliore|numero uno|n\.\s?1)\b/i, "recensione, premio o superlativo non verificabile"],
  [/\b(?:app mobile|app ios|app android|scarica l['’]app)\b/i, "app mobile (assente nei file)"],
];

export interface LintInput {
  brief: Brief;
  storyboard: Storyboard;
  facts: Fact[];
  /** Vincoli dell'utente (flag o prompt): se presenti il brief deve rispettarli. */
  expect?: { durationSec?: number; format?: Brief["format"] };
  scenes?: AnyScene[];
}

export function lintStoryboard({ brief, storyboard, facts, expect, scenes = SCENES }: LintInput): LintResult {
  const errors: LintIssue[] = [];
  const warnings: string[] = [];
  const err = (code: ErrorCode, msg: string, shot?: string) => errors.push({ code, msg, shot });
  const factIds = new Set(facts.map((f) => f.id));
  const byName = new Map(scenes.map((s) => [s.name, s]));

  // --- brief ---
  if (expect?.durationSec !== undefined && Math.abs(brief.durationSec - expect.durationSec) > EPS)
    err("E_SCHEMA", `brief.durationSec = ${brief.durationSec} ma la durata richiesta è ${expect.durationSec} s.`);
  if (expect?.format && brief.format !== expect.format) err("E_SCHEMA", `brief.format = ${brief.format} ma il formato richiesto è ${expect.format}.`);
  for (const id of brief.claims) if (!factIds.has(id)) err("E_CLAIM", `brief.claims: "${id}" non è un id di PRODOTTO_FATTI.`);
  const urlMissing = brief.needsFromUser.some((n) => n.field === "cta.url");
  if (brief.cta.url !== OFFICIAL_URL && !urlMissing)
    err("E_CLAIM", `cta.url deve essere "${OFFICIAL_URL}" (URL ufficiale) oppure segnalato in needsFromUser con field "cta.url".`);
  if (!brief.cta.approved) warnings.push("CTA non approvata (cta.approved = false).");
  if (brief.needsFromUser.length) warnings.push(`Dati mancanti da chiedere all'utente: ${brief.needsFromUser.map((n) => n.field).join(", ")}.`);
  if (brief.audio === "none" && storyboard.music) err("E_SCHEMA", `brief.audio = "none" ma lo storyboard ha "music": ometti "music".`);
  if (brief.audio !== "none" && !storyboard.music) warnings.push(`brief.audio = "${brief.audio}" ma manca "music" nello storyboard.`);

  // --- timecode: contigui, da 0 a durationSec ---
  const shots = storyboard.shots;
  const ids = new Set<string>();
  let cursor = 0;
  shots.forEach((s, i) => {
    if (ids.has(s.id)) err("E_SCHEMA", `id shot duplicato: ${s.id}.`, s.id);
    ids.add(s.id);
    if (Math.abs(s.start - cursor) > EPS) err("E_SCHEMA", `${s.id}: start = ${s.start} ma lo shot precedente finisce a ${cursor} (i timecode devono essere contigui, il primo parte da 0).`, s.id);
    if (s.end <= s.start) err("E_SCHEMA", `${s.id}: end (${s.end}) deve essere maggiore di start (${s.start}).`, s.id);
    cursor = s.end;
    if (i === 0 && s.transitionIn) warnings.push(`${s.id}: transitionIn sul primo shot non ha effetto.`);
  });
  const total = shots.reduce((a, s) => a + (s.end - s.start), 0);
  if (Math.abs(cursor - storyboard.durationSec) > EPS || Math.abs(total - storyboard.durationSec) > EPS)
    err("E_SCHEMA", `la somma delle durate degli shot è ${Math.round(total * 1000) / 1000} s, l'ultimo end è ${cursor} s: devono essere uguali a durationSec = ${storyboard.durationSec} s.`);

  // --- shot per shot ---
  for (const s of shots) {
    const scene = byName.get(s.scene);
    if (!scene) {
      err("E_GAP", `${s.id}: la scena "${s.scene}" non è nel catalogo (${[...byName.keys()].join(", ")}).`, s.id);
      continue;
    }
    if ("prices" in s.props) err("E_PRICE_UNVERIFIED", `${s.id}: non scrivere la prop "prices": i prezzi li risolve il motore da ${PRICE_FILE}.`, s.id);
    const parsed = scene.schema.safeParse(s.props);
    if (!parsed.success) {
      const why = parsed.error.issues.map((x: { path: PropertyKey[]; message: string }) => `${x.path.join(".") || "(props)"}: ${x.message}`).join("; ");
      err("E_SCHEMA", `${s.id} (${s.scene}): props non valide: ${why}`, s.id);
      continue;
    }
    const props = parsed.data;

    const dur = Math.round((s.end - s.start) * 1000) / 1000;
    const min = scene.duration(props).min;
    if (dur + EPS < min) err("E_SCHEMA", `${s.id} (${s.scene}): dura ${dur} s ma con queste props il minimo è ${min} s (regola: ${scene.name}).`, s.id);

    // prezzi: solo PriceCard, solo da file
    const strs = stringsOf(s.props).filter((x) => x.path !== "priceRef");
    if (s.scene === "PriceCard") {
      if (props.priceRef !== PRICE_FILE) err("E_PRICE_UNVERIFIED", `${s.id}: PriceCard.priceRef deve essere "${PRICE_FILE}".`, s.id);
      for (const x of strs) if (/\d|€/.test(x.value)) err("E_PRICE_UNVERIFIED", `${s.id}: PriceCard.${x.path} contiene cifre o €: i prezzi non si scrivono, li legge la scena da file.`, s.id);
    } else {
      for (const x of strs) if (MONEY.test(x.value)) err("E_PRICE_UNVERIFIED", `${s.id}: "${x.value}" contiene un importo; i prezzi si mostrano solo con PriceCard (letti da ${PRICE_FILE}).`, s.id);
    }

    // testi a schermo: sorgenti ammesse
    for (const t of s.onScreenText) {
      const src = t.source;
      if (src.kind === "claim" && !factIds.has(src.id)) err("E_CLAIM", `${s.id}: "${t.text}" cita il claim "${src.id}", che non è in PRODOTTO_FATTI.`, s.id);
      if (src.kind === "ui-label" && !factIds.has(src.id)) err("E_CLAIM", `${s.id}: etichetta "${t.text}" riferita a "${src.id}", funzione non presente in PRODOTTO_FATTI.`, s.id);
      if (src.kind === "mock" && !scene.mockup) err("E_CLAIM", `${s.id}: source "mock" ammessa solo in scene con mockup (${s.scene} non lo è).`, s.id);
      if (src.kind === "cta" && ![brief.cta.label, brief.cta.url].some((c) => norm(c) === norm(t.text)))
        err("E_CLAIM", `${s.id}: il testo CTA "${t.text}" deve coincidere con brief.cta.label "${brief.cta.label}" o con brief.cta.url "${brief.cta.url}".`, s.id);
      if (src.kind === "price" && (s.scene !== "PriceCard" || src.ref !== PRICE_FILE)) err("E_PRICE_UNVERIFIED", `${s.id}: source "price" solo in PriceCard con ref "${PRICE_FILE}".`, s.id);
      if (src.kind !== "mock" && src.kind !== "price") {
        for (const [re, what] of INVENTED) if (re.test(t.text)) err("E_CLAIM", `${s.id}: "${t.text}" contiene ${what}: non è in PRODOTTO_FATTI.`, s.id);
      }
    }

    // copertura: ogni testo che il regista ha scritto nelle props deve essere dichiarato con una source
    const declared = s.onScreenText.map((t) => norm(t.text));
    for (const t of scene.texts(props)) {
      if (t.origin !== "prop") continue;
      const n = norm(t.text);
      if (!n) continue;
      if (!declared.some((d) => d === n || d.includes(n) || n.includes(d)))
        err("E_CLAIM", `${s.id} (${s.scene}): il testo "${t.text}" (${t.role}) è a schermo ma manca da onScreenText: aggiungilo con la sua source.`, s.id);
    }
  }

  if (shots.length && shots[shots.length - 1]!.scene !== "EndCard") warnings.push("L'ultimo shot non è EndCard: manca la chiusura con CTA.");
  return { errors, warnings };
}

/** Il codice d'errore da riportare quando i tentativi sono finiti: il più specifico tra quelli presenti. */
export function worstCode(issues: LintIssue[]): ErrorCode {
  for (const c of ["E_GAP", "E_PRICE_UNVERIFIED", "E_CLAIM"] as ErrorCode[]) if (issues.some((i) => i.code === c)) return c;
  return "E_SCHEMA";
}
