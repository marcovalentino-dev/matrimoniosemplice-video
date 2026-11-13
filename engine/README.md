# engine — Video Studio

Da un prompt in italiano a un MP4 verificato per MatrimonioSemplice. Specifica completa e decisioni: [SPEC.md](SPEC.md).

**Stato: M1 (scaffold).** Funzionano `doctor`, `preview` (serve `brand/preview.html`), `typecheck` e `test`. `make`, `render`, `qa`, `batch` rispondono `E_NOT_IMPLEMENTED` (exit 99) fino ai passi successivi (SPEC §15).

## Installazione da zero

Richiede Node >= 22.18, ffmpeg e ffprobe nel PATH, Google Chrome, Python 3 e il CLI `claude` autenticato.

```
cd engine
npm install
npm run doctor
```

## Comandi (da `engine/`)

| Comando | Cosa fa oggi |
|---|---|
| `npm run doctor` | Controlla Node, ffmpeg, ffprobe, Chrome, Python, Claude CLI |
| `npm run preview` | Server locale su 127.0.0.1, stampa l'URL di `brand/preview.html` |
| `npm test` | vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run make / render / qa / batch` | non ancora implementati |

Configurazione: [engine.config.json](engine.config.json) (tetti di chiamate, giri QA, formati, audio).

## Struttura

`cli/` `director/` `schemas/` `theme/` `scenes/` `render/` `audio/` `qa/` `utils/` `test/` — vedi SPEC §4. `dal-caos-allrsvp/` è il prototipo storico, futuro test di regressione.
