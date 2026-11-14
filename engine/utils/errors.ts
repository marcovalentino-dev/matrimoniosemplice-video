// Codici di errore del motore (SPEC §9). Messaggi in italiano.
export const ERRORS = {
  E_USAGE: { exit: 2, msg: "Uso non valido." },
  E_ENV: { exit: 10, msg: "Ambiente incompleto: esegui `npm run doctor`." },
  E_LLM_UNAVAILABLE: { exit: 20, msg: "Claude non disponibile (CLI assente, non autenticato o limite raggiunto)." },
  E_SCHEMA: { exit: 21, msg: "Il regista ha prodotto un JSON non valido." },
  E_GAP: { exit: 22, msg: "La richiesta esce dal catalogo scene o da PRODOTTO_FATTI: vedi gap-report.md." },
  E_CLAIM: { exit: 23, msg: "Testo con claim non presente in PRODOTTO_FATTI." },
  E_PRICE_UNVERIFIED: { exit: 24, msg: "Prezzo non verificato: manca brand/prezzi.json o non coincide." },
  E_PLACEHOLDER: { exit: 25, msg: "Restano segnaposto: il video esce solo come bozza." },
  E_NOT_APPROVED: { exit: 30, msg: "Storyboard non approvato." },
  E_RENDER_PAGE: { exit: 40, msg: "Errore nella pagina di render." },
  E_RENDER_TIMEOUT: { exit: 41, msg: "Render oltre il tempo massimo." },
  E_ENCODE: { exit: 42, msg: "ffmpeg ha fallito." },
  E_AUDIO: { exit: 50, msg: "Errore nella generazione dell'audio." },
  E_QA_BLOCKER: { exit: 60, msg: "Problemi gravi dopo l'ultimo giro di QA." },
  E_BUDGET: { exit: 70, msg: "Tetto di chiamate o di tempo superato." },
  E_NOT_IMPLEMENTED: { exit: 99, msg: "Stadio non ancora implementato." },
} as const;

/** Cosa fare, per codice: lo stampa la CLI sotto il messaggio. */
export const HINTS: Partial<Record<keyof typeof ERRORS, string>> = {
  E_ENV: "Esegui `npm run doctor` e installa ciò che manca.",
  E_LLM_UNAVAILABLE: "Controlla che `claude` sia installato e autenticato (`claude` da terminale) e di non aver raggiunto il limite del piano; poi rilancia con `--resume out/<slug>` per riprendere da dove si era fermato.",
  E_SCHEMA: "Controlla il prompt o i file nella cartella; i dettagli sono nel messaggio.",
  E_GAP: "Leggi gap-report.md: serve una nuova scena o un fatto verificato in brand/PRODOTTO_FATTI.md.",
  E_CLAIM: "Il testo contiene un claim non presente in brand/PRODOTTO_FATTI.md: riformula il prompt.",
  E_PRICE_UNVERIFIED: "Controlla brand/prezzi.json.",
  E_NOT_APPROVED: "Rileggi il piano e approva con `npm run make -- --resume out/<slug> --approve`.",
  E_RENDER_PAGE: "Guarda i log del render in out/<slug>/.work/.",
  E_ENCODE: "Guarda out/<slug>/.work/ffmpeg.log e rilancia con `--resume out/<slug>`.",
  E_QA_BLOCKER: "Leggi out/<slug>/qa-report.json; correggi il prompt o lo storyboard e rilancia con `--resume out/<slug>`.",
  E_BUDGET: "Alza il tetto (--max-cost, --max-calls) e rilancia con `--resume out/<slug>`: il lavoro già fatto non si ripete.",
};

export type ErrorCode = keyof typeof ERRORS;

export class EngineError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, detail?: string) {
    super(detail ? `${ERRORS[code].msg} ${detail}` : ERRORS[code].msg);
    this.code = code;
  }
  get exitCode(): number {
    return ERRORS[this.code].exit;
  }
}
