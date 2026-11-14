# matrimoniosemplice-video

Video promozionali e di prodotto per MatrimonioSemplice, in italiano: dal prompt a un MP4 verificato (storyboard, render, musica, QA). Le regole di lavoro sono in `CLAUDE.md`.

## Struttura

- `brand/` — design system, token e documenti di riferimento del brand (fonte unica dei contenuti: `PRODOTTO_FATTI.md`, `prezzi.json`)
- `briefs/` — brief e storyboard dei singoli video (con `npm run batch` ogni `.md` è un prompt)
- `engine/` — il motore: regista, scene, render, audio, QA (documentazione completa in [engine/README.md](engine/README.md), specifica in [engine/SPEC.md](engine/SPEC.md))
- `out/` — export (non versionato)
- `assets/audio/`, `assets/fonts/`, `assets/logo/` — musica, font e loghi con licenza chiara
- `_refs/` — riferimenti esterni (non versionato)
- `.claude/skills/` — skill del progetto

## Installazione da zero

Servono Node >= 22.18, ffmpeg e ffprobe nel PATH, Google Chrome e il CLI `claude` autenticato.

```
git clone https://github.com/marcovalentino-dev/matrimoniosemplice-video.git
cd matrimoniosemplice-video/engine
npm install
npm run doctor
```

## Comandi (da `engine/`)

| Comando | Cosa fa |
|---|---|
| `npm run make -- "<prompt>" [--format 9:16\|16:9] [--duration 20] [--preview] [--max-cost usd] [--max-rounds 3]` | Dal prompt al video in `out/<slug>/` (`video.mp4`, `storyboard.json`, `qa-report.json`, `manifest.json`). `--preview` si ferma al piano |
| `npm run make -- --resume out/<slug> [--approve]` | Riprende da ciò che manca / approva a mano |
| `npm run batch -- briefs/` | Tutti i `.md` in coda, con log e ripresa |
| `npm run doctor` | Controlla l'ambiente |
| `npm test` / `npm run typecheck` | Test e controllo dei tipi |

Come aggiungere una scena, come aggiungere musica con licenza e i problemi noti: vedi [engine/README.md](engine/README.md).

## Git

Non si committano MP4, `.env`, `node_modules`, `_refs/` (già in `.gitignore`).
