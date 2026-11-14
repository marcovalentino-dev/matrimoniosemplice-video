import { catalogData } from "../scenes/catalog.ts";
import type { Fact } from "./facts.ts";
import type { LintIssue } from "./lint.ts";
import { OFFICIAL_URL, PRICE_FILE } from "./lint.ts";

export interface DirectorConfig {
  durationSec: { min: number; max: number };
  formats: Record<string, { w: number; h: number; fps: number }>;
}

export const SYSTEM_PROMPT = `Sei il regista dei video promozionali di MatrimonioSemplice, SaaS per coppie italiane.
Trasformi una richiesta libera in un brief e in uno storyboard con timecode, usando SOLO le scene del catalogo che ti viene dato.
Non scrivi codice. Non hai bisogno di leggere file: tutto ciò che serve è nel messaggio.
Rispondi con UN SOLO oggetto JSON, senza testo prima o dopo e senza recinti di codice. Tutti i testi a schermo sono in italiano.`;

/** Il catalogo in forma compatta per il modello: stessa fonte di CATALOGO.json, senza gli schemi JSON. */
export function compactCatalog(): unknown[] {
  return catalogData().map((d) => ({
    scena: d.name,
    cosaMostra: d.summary,
    mockup: d.mockup,
    durata: { minima: d.duration.min, consigliata: d.duration.recommended, comeScala: d.durationRule },
    props: d.props.map((p) => `${p.name}${p.required ? " (obbligatoria)" : ""}: ${p.type}${p.def ? `, default ${p.def}` : ""}. ${p.desc}`),
    esempioProps: d.preview.props,
    note: d.notes,
  }));
}

export const OUTPUT_SPEC = `FORMATO DELLA RISPOSTA (solo JSON):
{
  "brief": {
    "slug": "a-z0-9 e trattini, max 48, es. rsvp-senza-account-20s",
    "goal": "obiettivo del video in una frase",
    "format": "9:16" | "16:9",
    "durationSec": numero (secondi, quello richiesto),
    "audience": "...",
    "message": "il messaggio unico del video",
    "claims": ["id di fatti di PRODOTTO_FATTI usati nel video"],
    "cta": { "label": "Crea il tuo sito matrimonio", "url": "${OFFICIAL_URL}", "approved": true },
    "tone": "...",
    "loop": false,
    "audio": "none" | "synth" | "library",
    "needsFromUser": [ { "field": "...", "reason": "..." } ],
    "assumptions": ["scelte che hai fatto dove la richiesta non era precisa"]
  },
  "storyboard": {
    "theme": { "palette": "rosa-romantico" | "avorio-classico" | "verde-salvia" | "blu-sera" | "terra-bruciata" },
    "shots": [
      {
        "id": "s1",
        "start": 0, "end": 4,
        "scene": "nome esatto di una scena del catalogo",
        "props": { ...props della scena, come nello schema del catalogo... },
        "onScreenText": [ { "text": "testo letto a schermo", "role": "eyebrow|headline|sub|caption|cta|label|price|mock", "source": { "kind": "claim", "id": "<id fatto>" } } ],
        "transitionIn": { "type": "dissolve" | "slide" | "fromCream", "dur": 0.6 },
        "camera": { "move": "none" | "pushIn" | "pullOut", "amount": 0.04 },
        "audio": { "music": "intro", "cues": [] },
        "notes": "nota di regia/camera per questo shot"
      }
    ],
    "music": { "mood": "caldo-minimale", "bpm": 96, "fadeIn": 1, "fadeOut": 2 }
  }
}

"source" di ogni testo a schermo: {"kind":"claim","id":...} (claim di PRODOTTO_FATTI), {"kind":"ui-label","id":...} (etichetta d'interfaccia di una funzione di PRODOTTO_FATTI), {"kind":"mock"} (dato fittizio dentro un mockup, solo in scene con mockup: true), {"kind":"cta"} (testo uguale a brief.cta.label o a brief.cta.url), {"kind":"price","ref":"${PRICE_FILE}"} (solo in PriceCard).

Se la richiesta NON è realizzabile con le scene del catalogo e i fatti di PRODOTTO_FATTI (es. persone, grafici di dati, confronti con concorrenti, testimonianze, funzioni assenti dai file), non improvvisare: rispondi solo
{ "gap": { "reason": "perché", "missing": ["cosa manca"] } }`;

export const RULES = `REGOLE (verificate da un controllo automatico: se le violi la risposta viene respinta):
1. Usa solo scene del catalogo, con props conformi allo schema (lunghezze massime comprese).
2. Parla solo di funzioni e promesse presenti in PRODOTTO_FATTI; i claim li citi per id. Niente numeri di utenti, percentuali, recensioni, premi, app mobile.
3. Nessun prezzo scritto da te. Per mostrare i prezzi usa la scena PriceCard con priceRef "${PRICE_FILE}" (la scena li legge dal file) e nessuna cifra o € nelle sue props. Fuori da PriceCard non scrivere importi.
4. I timecode sono in secondi, contigui: il primo shot parte da 0, end(n) = start(n+1), l'ultimo end = durationSec. La somma delle durate è esattamente la durata richiesta. Il primo shot non ha "transitionIn" (non ha effetto e il lint lo segnala, impedendo l'approvazione automatica).
5. Ogni shot dura almeno il minimo della sua scena con le props scelte (vedi "comeScala"). Meglio durate un po' sopra il minimo.
6. Ogni testo che compare nelle props (titoli, headline, sub, caption, cta, voci...) va elencato in onScreenText con la sua source. I testi fissi dei mockup non vanno elencati.
7. Pianificazione e piano tavoli sono Premium: la scena mostra già l'etichetta, non dire che sono gratuiti. Il sito, l'RSVP senza account e la lista nozze/fondo regalo sono nel piano gratuito (come da tabella).
8. "Senza commissioni" vale solo per fondo regalo/lista nozze con bonifico diretto.
9. Chiudi con EndCard (cta = brief.cta.label, url = ${OFFICIAL_URL}). Una sola idea per video, ritmo calmo, shimmer al massimo una volta. Nomi e dati nei mockup sono fittizi.
10. Se mancano dati che non puoi inventare, metti il campo in needsFromUser e non inventarlo. Un URL diverso da ${OFFICIAL_URL} va segnalato come needsFromUser con field "cta.url".
11. Formato: 9:16 se la richiesta non dice altro (social verticali); 16:9 solo se richiesto (schermo largo, sito, YouTube, desktop). Durata: quella richiesta; se non c'è, 20 s. Limiti ${"{MIN}"}-${"{MAX}"} s.
12. Se brief.audio = "none" ometti "music".`;

export interface PromptInput {
  prompt: string;
  factsMd: string;
  facts: Fact[];
  config: DirectorConfig;
  expect?: { durationSec?: number; format?: string };
  /** Tentativo precedente non valido. */
  retry?: { previous: string; issues: (LintIssue | string)[] };
}

export function buildPrompt(i: PromptInput): string {
  const rules = RULES.replace("{MIN}", String(i.config.durationSec.min)).replace("{MAX}", String(i.config.durationSec.max));
  const formats = Object.entries(i.config.formats).map(([k, v]) => `${k} = ${v.w}x${v.h} a ${v.fps} fps`).join("; ");
  const factIds = i.facts.map((f) => `- ${f.id} — ${f.text}${f.kind === "funzione" ? ` [${f.plan}]` : ""}`).join("\n");
  const expect = [
    i.expect?.durationSec !== undefined ? `durata ESATTA: ${i.expect.durationSec} s` : "",
    i.expect?.format ? `formato: ${i.expect.format}` : "",
  ].filter(Boolean);

  const parts = [
    `# RICHIESTA\n${i.prompt}${expect.length ? `\n\nVincoli già fissati: ${expect.join("; ")}.` : ""}`,
    `# FORMATI\n${formats}`,
    `# ID DEI FATTI CITABILI (brief.claims e source.id)\n${factIds}`,
    `# PRODOTTO_FATTI.md (unica fonte di funzioni e claim)\n${i.factsMd}`,
    `# CATALOGO SCENE (unico vocabolario)\n${JSON.stringify(compactCatalog(), null, 1)}`,
    rules,
    OUTPUT_SPEC,
  ];
  if (i.retry) {
    const list = i.retry.issues.map((x) => `- ${typeof x === "string" ? x : x.msg}`).join("\n");
    parts.push(`# CORREZIONE\nLa tua risposta precedente è stata respinta:\n${list}\n\nRisposta precedente:\n${i.retry.previous}\n\nRiscrivi l'intero JSON correggendo questi problemi e senza introdurne altri.`);
  }
  return parts.join("\n\n");
}
