// Codici di errore del motore (SPEC §9). Messaggi in italiano.
export const ERRORS = {
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
