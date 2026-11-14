# engine — Video Studio

Da un prompt in italiano a un MP4 verificato per MatrimonioSemplice. Specifica completa e decisioni: [SPEC.md](SPEC.md).

**Stato: pipeline completa.** `npm run make -- "<prompt>"` va dal prompt al video consegnato in `out/<slug>/` (brief → storyboard → render → audio → QA → consegna); `npm run batch -- briefs/` lo ripete per una cartella di brief, con log e ripresa. I comandi dei singoli stadi (`direct`, `render`, `qa`) restano per lavorare a mano. Dettagli in "Make e batch" in fondo.

## Installazione da zero

Richiede **Node >= 22.18**, **ffmpeg e ffprobe** nel PATH (testato con ffmpeg 8, build "full"), **Google Chrome** e il **CLI `claude`** installato e autenticato (`claude` da terminale deve rispondere). Python 3 serve solo per rigenerare il prototipo storico `dal-caos-allrsvp/`.

```
git clone https://github.com/marcovalentino-dev/matrimoniosemplice-video.git
cd matrimoniosemplice-video/engine
npm install
npm run doctor        # elenca cosa manca; deve finire con "Ambiente pronto."
npm test              # circa 90 s: usa ffmpeg e Chrome veri, nessuna chiamata a Claude
npm run make -- "Video di 10 secondi sull'RSVP senza account" --format 9:16 --duration 10 --preview
```

Se Chrome non è nel percorso standard imposta `CHROME_PATH` (o `chromePath` in `engine.config.json`). Font (Playfair Display, Inter, licenza OFL) e logo sono già in `assets/`. I video finiti stanno in `out/<slug>/` (cartella non versionata, come `*.mp4`).

## Comandi (da `engine/`)

| Comando | Cosa fa oggi |
|---|---|
| `npm run doctor` | Controlla Node, ffmpeg, ffprobe, Chrome, Claude CLI (Python solo informativo) |
| `npm run preview` | Server locale su 127.0.0.1, stampa l'URL di `brand/preview.html` |
| `npm run theme-test` | Renderizza `out/_test/brand.png` (tutto il tema) e verifica colori, font, nero puro, safe area |
| `npm test` | vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run render -- <storyboard.json\|cartella> [--out dir] [--preview-only\|--final-only] [--no-audio] [--workers n] [--audio-dir dir]` | Anteprima 540×960 (15 fps) + finale 1080×1920 (30 fps), mix audio, `manifest.json` (M5, vedi sotto) |
| `npm run qa -- <video.mp4\|cartella> [--storyboard f] [--max-rounds 3] [--max-calls 8] [--no-fix] [--no-quarantine]` | QA dopo il render: ffprobe vs brief, contact sheet, revisione di Claude, `qa-report.json`, giri di correzione (vedi sotto) |
| `npm run make -- "<prompt>" [opzioni]` | **Comando principale**: dal prompt al video consegnato (vedi "Make e batch") |
| `npm run batch -- [briefs/] [opzioni]` | Tutti i `.md` di una cartella in coda, con log e ripresa dopo errore |

Configurazione: [engine.config.json](engine.config.json) (tetti di chiamate, giri QA, formati, audio).

## Struttura

`cli/` `director/` `schemas/` `theme/` `scenes/` `render/` `audio/` `qa/` `utils/` `test/` — vedi SPEC §4. `dal-caos-allrsvp/` è il prototipo storico, futuro test di regressione.

## Scene (M3)

13 scene riusabili in `scenes/` (schede in [scenes/CATALOGO.md](scenes/CATALOGO.md), versione macchina `CATALOGO.json`). Ogni scena è una funzione pura `render(props, t, ctx) → HTML`, con schema zod, durata minima/consigliata, cue audio e props d'esempio.

| Comando | Cosa fa |
|---|---|
| `npm run catalog` | Rigenera `CATALOGO.md` e `CATALOGO.json` dagli schemi (un test fallisce se sono vecchi) |
| `npm run scenes-test` | Un fotogramma per scena e formato in `out/_test/scenes/`, controlli (nero puro, font, safe area, determinismo) e contact sheet `out/_test/scenes-contact-sheet-{9x16,16x9}.png` |

## Render (M5)

`render/` trasforma `storyboard.json` in `preview.mp4`, `video.mp4` e `manifest.json` (nella cartella dello storyboard, o in `--out`). `.work/` contiene segmenti e `mix.wav` e si può cancellare.

- **Composizione**: `compose.ts` sovrappone gli shot con le transizioni dello storyboard (`dissolve`, `slide`, `fromCream`) e la camera (`pushIn`/`pullOut`); lo shot uscente resta sull'ultimo fotogramma, quindi i tempi non si sovrappongono.
- **Video**: `video.ts`, un Chrome per worker (3 di default, le pagine in secondo piano non producono fotogrammi), PNG in pipe a ffmpeg, blocchi da 1 s in cache (`.work/chunks-*/`, chiave = hash dell'HTML dei fotogrammi) concatenati senza ricodifica: dopo la modifica di uno shot si ri-renderizzano solo i blocchi toccati. H.264 `yuv420p` bt709, `+faststart`. Anteprima 15 fps CRF 28, finale 30 fps CRF 16.
- **Audio**: con `brief.audio: synth` (il default) `synth.ts` genera la musica in codice con ffmpeg e `audio.ts` la porta a -14 LUFS (`manifest.audio.mode: "synth"`). Con `library`, `audio.ts` legge `assets/audio/index.json` (`{ "tracks": [ { id, file, titolo, durata, bpm, tag[], licenza, fonte, attribuzione } ] }`). Una traccia è ammessa solo con licenza e fonte compilate (non `TODO`, `N/A`...) e file esistente; scelta per tag in comune con `storyboard.music.mood` (almeno uno), poi bpm e durata. Se nessuna traccia è ammessa, il video esce **senza audio** e il manifest riporta `audio.mode: "none"` con il motivo e un avviso. Mix: loop se serve, fade in/out da `storyboard.music`, `loudnorm` a due passate verso -14 LUFS / -1 dBTP, AAC 192k 48 kHz.
- **Verifica**: `ffprobe` su `video.mp4` (durata ±0,1 s, risoluzione, fps, codec, numero di fotogrammi, audio presente solo se atteso). Se fallisce, `status: "failed"` ed exit 42. Con segnaposto `[...]` nelle props l'output è `video-DRAFT.mp4`.
- Il render **non** esegue QA (`qa.verdict: "not-run"`) né controlla l'approvazione dello storyboard: quello è compito di `make`.

## QA (M7)

`qa/` giudica un video già renderizzato (cartella con `video.mp4`, `storyboard.json`, `brief.json`). `npm run qa -- out/<slug>`.

1. **ffprobe** (`check.ts`): durata ±0,1 s, risoluzione, fps, H.264/`yuv420p`, numero di fotogrammi e audio, tutti confrontati con `brief.json`. Un video muto con `audio: synth|library` è un avviso (senza tracce con licenza il motore esporta muto, SPEC §8.1); `audio: none` con una traccia presente è grave. Se ffprobe è grave si ferma subito, senza chiamare il modello.
2. **Fotogrammi** (`frames.ts`): un fotogramma al secondo, contact sheet da 16 miniature con il secondo scritto, un still a piena risoluzione per shot (max 8), scansione del nero puro `#000000` (2 fotogrammi al secondo, ≥ 0,2% del quadro) che il modello non deve indovinare.
3. **Revisione** (`review.ts`): una chiamata `claude -p` che apre le immagini con `Read` e risponde in JSON validato con la rubrica: `leggibilita`, `safeArea`, `brand`, `neroPuro`, `coerenza`, `nessunTaglio`, `ritmo`, `claim` (0-10), più voto e nota per shot e un elenco di problemi (`shot`, `major|minor`, `t`, `what`, `fix`). Riceve storyboard, safe area, `BRAND_VIDEO.md` e `PRODOTTO_FATTI.md`.
4. **`qa-report.json`**: verdetto (`pass|warn|fail|error`), voto 0-100 (media della rubrica), `probe`, problemi con `source` (`probe|pixel|review`), `shots[]` con voto e problemi, `rounds[]`, `regenerate`, chiamate e costo. Le prove (frame, sheet, still) stanno in `qa/round-N/`. `manifest.json` riceve `qa`.
5. **Giri di correzione** (max 3, `--max-rounds`): per gli shot con problemi *gravi* (anche quello del nero) il regista (`director/fix.ts`) riceve solo quegli shot e i loro problemi; restano id, start ed end, il lint dell'intero storyboard deve passare, poi si riscrive `storyboard.json` (copia in `qa/storyboard.before-qa.json`), si ri-renderizzano solo i blocchi cambiati e si rifà la QA. Se un testo cambia, il report segna `needsReapproval`.
6. **Se resta qualcosa di grave**: `E_QA_BLOCKER` (exit 60) con l'elenco dei problemi; `video.mp4` viene spostato in `.work/FAILED-QA.mp4` (disattivabile con `--no-quarantine`), il manifest diventa `failed`. Un voto sotto 4 su un criterio senza problema puntuale vale come grave globale; i problemi globali non si risolvono rigenerando uno shot. Il comando stampa `FINITO` solo con video, ffprobe e report verificati.

Tetto di chiamate al modello 8 per QA (`maxCalls`): revisione 1 per valutazione, correzione 1-2 per giro; oltre: `E_BUDGET` e report con verdetto `error`. Test: `test/qa.test.ts` (modello e render finti, ffmpeg vero).


## Make e batch

Tutto da `engine/`. I percorsi `briefs/` e `out/` si cercano prima nella cartella corrente, poi nella radice del repository.

```
npm run make -- "<prompt>" [--format 9:16|16:9] [--duration 20] [--preview] [--max-cost <usd>] [--max-rounds 3] [--max-calls 8]
npm run make -- --resume out/<slug> [--approve]
npm run batch -- briefs/ [--format ..] [--duration ..] [--preview] [--force] [--max-cost <usd>] [--max-rounds n] [--max-calls n]
```

| Opzione | Effetto |
|---|---|
| `--format` | `9:16` o `16:9`; il brief deve rispettarlo (se manca decide il regista) |
| `--duration` | secondi, 5-60; il brief deve rispettarla (se manca decide il regista) |
| `--preview` | si ferma dopo brief e storyboard: scrive `brief.json` e `storyboard.json`, stampa il piano (tabella con timecode, testi, cose da fornire, ipotesi, avvisi) e **non renderizza nulla** |
| `--approve` | approvazione manuale: dopo aver letto il piano, `make --resume out/<slug> --approve` prosegue da lì senza richiamare il regista |
| `--max-cost` | tetto in dollari sul costo **stimato** (vedi sotto); `E_BUDGET` prima della chiamata che lo supererebbe |
| `--max-rounds` | giri di correzione della QA (default 3, vedi `engine.config.json`) |
| `--max-calls` | chiamate a Claude per video (default 8): regista + QA + correzioni |
| `--resume <cartella>` | riprende da ciò che manca (vedi "Ripresa") |
| `--workers n` | Chrome in parallelo nel render (default 3) |

**Flusso e approvazione.** `brief → storyboard → [--preview: stop] → approvazione → render → audio → QA → consegna`. Senza `--preview` il motore approva da solo (`approval.json`, `by: "auto"`) **solo** se il lint dello storyboard non ha né errori né avvisi, il brief non chiede dati all'utente (`needsFromUser`) e non restano segnaposto `[...]`: è la deroga di CLAUDE.md (2026-11-13). Altrimenti si ferma con `E_NOT_APPROVED`, stampa il piano e il comando `--resume ... --approve`. Se la QA corregge un testo a schermo, l'approvazione automatica si rinnova solo a lint pulito; un'approvazione manuale invece si rifà (`E_NOT_APPROVED`, il video resta in `.work/`). `autoApprove: false` in `engine.config.json` toglie l'approvazione automatica: serve sempre `--approve`.

**Consegna** in `out/<slug>/`:

| File | Contenuto |
|---|---|
| `video.mp4` | solo dopo QA superata e un ultimo `ffprobe` contro lo storyboard (durata ±0,1 s, risoluzione, fps, H.264/yuv420p, numero di fotogrammi, audio). Con segnaposto: `video-DRAFT.mp4` e il comando stampa `BOZZA`, non `FINITO` |
| `storyboard.json`, `brief.json`, `approval.json` | cosa è stato girato e chi lo ha approvato (hash incluso) |
| `qa-report.json` | verdetto, voto, problemi, giri; le prove (fotogrammi, contact sheet, still) in `qa/round-N/` |
| `manifest.json` | durata, comandi (il `make` e gli `ffmpeg` del render), versioni (motore, Node, ffmpeg, Chrome, CLI `claude`), tracce audio e licenze (musica e font), segnaposto, avvisi, `claimsUsed`, `approval`, `qa`, `timing` (secondi per stadio, somma di tutte le corse) e `cost` |
| `run.log` | una riga JSON per evento (stadio, esito, secondi, chiamate e costo) |
| `error.json` | solo se l'ultima corsa è fallita: codice, stadio, messaggio, cosa fare |
| `preview.mp4`, `.work/` | anteprima 540×960 e lavori intermedi (cancellabili) |

Se il regista fallisce prima di avere uno slug (`E_GAP`, `E_SCHEMA`...), rapporto e `gap-report.md` finiscono in `out/_errori/<data>/`. Un video non verificato non resta mai in `video.mp4`: se la corsa si interrompe dopo il render (budget, Claude non disponibile, QA bloccante) viene spostato in `.work/` e il manifest diventa `failed`.

**Costo stimato.** Il motore chiama `claude -p` sul piano dell'utente, senza chiave API: `cost.usd` somma il `total_cost_usd` che il CLI dichiara. È una **stima** (col forfait non è un addebito) e vale 0 se il CLI non lo espone. `--max-cost` confronta la stima con il tetto *prima* di ogni chiamata, quindi l'ultima chiamata può sforare. Il tetto che conta davvero col forfait è `--max-calls`.

**Ripresa.** Ogni stadio guarda cosa c'è già in `out/<slug>/` e salta ciò che è coerente: brief e storyboard esistono → niente regista; `approval.json` con l'hash dello storyboard → niente nuova approvazione; `manifest.json` con lo stesso `storyboardHash` e il video presente → niente render (altrimenti si ri-renderizzano solo i blocchi da 1 s cambiati); QA già `pass`/`warn` → niente QA. Un video messo da parte per un'interruzione viene ripristinato. Costi e tempi delle corse si sommano.

**Rilanciare `make` con lo stesso prompt** rifà tutto da capo: se `out/<slug>` esiste, i file della corsa precedente (manifest, QA, video...) vengono sostituiti; la cache dei blocchi in `.work/` resta.

### Batch

`npm run batch -- briefs/` prende ogni `.md` della cartella (in ordine alfabetico; `README.md` e i file che iniziano con `_` o `.` sono ignorati) e lo tratta come prompt. In testa, facoltativi e tra due righe `---`: `formato: 9:16|16:9` e `durata: 20`; i flag della riga di comando hanno la precedenza.

- **Uno alla volta**, nessun parallelismo (il render usa già 3 Chrome).
- **Stato** in `out/_batch/state.json` (hash del testo e delle opzioni, esito, cartella, tentativi, costo) e **log** in `out/_batch/batch.log`; ogni video ha comunque il suo `run.log`.
- **Ripresa**: rilanciando lo stesso comando i brief già consegnati (stesso testo e stesse opzioni) sono saltati; quelli falliti o interrotti riprendono dalla loro cartella, senza rifare ciò che è già fatto. `--force` rifà tutto.
- **Un brief che fallisce non ferma gli altri.** Si ferma tutto solo con `E_ENV` o `E_LLM_UNAVAILABLE` (continuare sarebbe inutile): i brief rimasti restano in coda.
- Exit 0 se tutti consegnati (o piani pronti con `--preview`), 1 se almeno uno è fallito o il batch è stato interrotto. `--max-cost`, `--max-rounds` e `--max-calls` valgono **per ogni video**.
- Ogni `.md` della cartella è un prompt, quindi anche i documenti descrittivi (come `briefs/dal-caos-allrsvp.md`, uno storyboard scritto a mano) verrebbero mandati al regista. Nei `briefs/` metti solo prompt, oppure prefissa con `_` i file da escludere.

### Errori

Messaggi in italiano con codice e "Cosa fare" (SPEC §9). Nuovo: `E_USAGE` (exit 2) per le opzioni sbagliate: formato diverso da 9:16/16:9, durata fuori 5-60 s, numeri non validi, prompt mancante, `--resume` insieme al prompt. Gli errori imprevisti stampano un messaggio breve (`ENGINE_DEBUG=1` per lo stack).

Test: `test/make.test.ts` (regista e Claude finti; render e QA finti, con video e ffprobe veri).

## Aggiungere una scena

Una scena è una funzione pura `render(props, t, ctx) → HTML`: stesso `t`, stesso HTML (niente `Date.now`, `Math.random`, stato). Il regista può usare solo le scene del catalogo.

1. Crea `scenes/<Nome>/index.ts` (parti da `HookText/` per un testo, da `RsvpFlow/` per un mockup) ed esporta `defineScene({...})` con: `name`, `summary` (una riga), `mockup`, `schema` zod (ogni prop con `.describe(...)` e lunghezze massime: il regista le legge), `duration(props)` → `{ min, recommended }` (min = testo leggibile + animazioni complete + pausa), `render`, `css` (classi con prefisso proprio), `texts(props)` (tutto il testo leggibile, con `origin`: `prop`, `mock`, `ui-label`, `price`), `preview: { props, t }` (props d'esempio) e, se serve, `cues` e `notes`.
2. Registrala in `scenes/index.ts` (import e voce in `SCENES`).
3. Usa gli helper di `scenes/_shared/` (`anim.ts`, `ui.ts`, `html.ts`) e solo token del tema (`var(--c-...)`): mai `#000000` (usa `#1E1E1E`), al massimo 2 font, testo dentro `safeBox(ctx, ...)`. Nessun dato reale nei mockup: nomi, date e luoghi fittizi.
4. `npm run catalog` rigenera `CATALOGO.md` e `CATALOGO.json` (un test fallisce se sono vecchi), poi `npm run scenes-test <Nome>` produce un fotogramma per formato in `out/_test/scenes/` con i controlli (nero puro, font, safe area, determinismo) e il contact sheet.
5. `npm test`. Il regista la usa da solo alla prossima corsa: il catalogo entra nel suo prompt.

Nuove funzioni di prodotto da raccontare vanno prima in `brand/PRODOTTO_FATTI.md`: il lint blocca i testi senza un fatto di riferimento.

## Aggiungere musica con licenza

Di default `make` sintetizza la musica in codice (`render/synth.ts`, sinusoidi con ffmpeg: nessun campione di terzi, licenza non necessaria; `manifest.licenses.music` lo dichiara). Per usare brani veri, imposta `audio: library` nel brief (o scegli un brief che lo chieda) e compila `assets/audio/index.json`:

```json
{ "tracks": [
  { "id": "caldo-01", "file": "caldo-01.wav", "titolo": "Titolo", "durata": 62.4, "bpm": 96,
    "tag": ["caldo", "minimale"], "licenza": "CC0 1.0", "fonte": "https://…pagina del brano e della licenza…",
    "attribuzione": "Autore, se la licenza la richiede" }
] }
```

1. Scarica il file in `assets/audio/` solo se la licenza permette l'uso commerciale in video promozionali; salva accanto (o nella `fonte`) la prova della licenza.
2. Una traccia è **ammessa solo con `licenza` e `fonte` compilate** (non `TODO`, `N/A`...) e file esistente; le altre finiscono in `manifest.audio.rejected` con il motivo.
3. La scelta avviene per tag in comune con `storyboard.music.mood` (almeno uno), poi bpm e durata. Se nessuna è ammessa il video esce **senza audio** e il manifest lo dice (`audio.mode: "none"`, con il motivo).
4. Il mix è automatico: loop se serve, fade, `loudnorm` a -14 LUFS / -1 dBTP, AAC 48 kHz. Licenze e attribuzioni usate finiscono in `manifest.audio.tracks`. Se la licenza richiede attribuzione va riportata nella descrizione di dove il video viene pubblicato.

## Problemi noti

- **Il revisore della QA è un modello, non un metro.** Segnala spesso come "minori" misure a occhio (margini a "circa 55 px" invece di 64) e a volte falsi positivi (il logo ufficiale `assets/logo/icon.svg` nell'`EndCard` letto come "marchio inventato"). I problemi *gravi* restano bloccanti; i minori compaiono nel `qa-report.json` e il verdetto è `warn`. Va sempre guardato il video intero prima di pubblicare (CLAUDE.md).
- **Difetti di scena ancora aperti**, visti nei tre video di prova: l'onda del tap simulato in `EndCard` schiarisce le lettere del pulsante; in `TableSeating` il cursore copre il chip che trascina e gli ultimi secondi restano statici; in `RsvpFlow` la schermata di ringraziamento resta ferma circa 4 s e il testo interno dei mockup è piccolo; titoli lunghi di `EndCard` vanno su 3-4 righe.
- **Musica sintetica semplice**: un solo tappeto (accordi Cmaj7-Am7-Fmaj7-G6) con tempo preso da `music.bpm`; `mood` non cambia il timbro. Gli effetti sonori (`cues` delle scene) non sono ancora mixati.
- **Lint severo**: anche un solo avviso (es. `transitionIn` sul primo shot) toglie l'approvazione automatica e serve `--approve`.
- **`--max-cost`** usa il costo dichiarato dal CLI `claude`: con il forfait è una stima, e può sforare di una chiamata.
- **Tempi**: render CPU-only, circa 2-4 minuti per 10-20 s a 1080p con 3 worker, più la QA (una o più chiamate a Claude, 20-60 s l'una). Una corsa completa da 20 s è costata circa 0,3-0,8 $ stimati.
- **Windows**: i file possono risultare bloccati da antivirus o indicizzatore (`EBUSY`): il registro `run.log` lo tollera, il resto no; rilancia con `--resume`.
- Solo 9:16 e 16:9, 5-60 s.
