# engine/SPEC.md — Video Studio per MatrimonioSemplice

Stato: **BOZZA per approvazione**. Nessun codice del motore è stato scritto. Le parti marcate **[Proposta]** sono scelte mie, non vengono dai file di `brand/` o da `GUIDA_VIDEO.md`, e vanno approvate. Le parti marcate **[Da misurare]** sono stime che non posso verificare senza eseguire il motore.

Fonti lette: `CLAUDE.md`, `brand/*` (BRAND_VIDEO, PRODOTTO_FATTI, tokens.json, GUIDA_VIDEO Fasi 6-7), `_refs/mg-styles-15` (README, `harness/render.mjs`, `rubric.md`), `_refs/ClaudeAnimationBase` (README), `_refs/opus-video-prompts` (README), e il prototipo già presente `engine/dal-caos-allrsvp/` (renderizzato con Lemo-Opuscar).

---

## 1. Obiettivi

**Obiettivo.** `npm run make -- "video di 20 secondi sull'RSVP senza account" --format 9:16` produce `out/<slug>/video.mp4` **verificato**, coerente col brand, con claim solo da `PRODOTTO_FATTI.md`.

**Requisiti (derivati da CLAUDE.md e brand/):**

| # | Requisito | Origine |
|---|---|---|
| R1 | Testi a schermo e video in italiano | CLAUDE.md |
| R2 | Nessuna funzione, prezzo, numero o recensione non presente in `brand/PRODOTTO_FATTI.md` | CLAUDE.md, PRODOTTO_FATTI |
| R3 | Mai `#000000` (usare `#1E1E1E`); max 2 font (Playfair Display + Inter); max 3 colori per inquadratura | CLAUDE.md, BRAND_VIDEO |
| R4 | Solo musica/font/immagini con licenza registrata | CLAUDE.md |
| R5 | Storyboard con timecode **approvato dall'utente** prima di scrivere/lanciare il render | CLAUDE.md, flusso di lavoro |
| R6 | Prima dell'export: anteprima, contact sheet, auto-revisione | CLAUDE.md |
| R7 | Un video è "finito" solo se l'MP4 esiste e `ffprobe` conferma durata, risoluzione, fps | CLAUDE.md |
| R8 | Niente MP4, `.env`, `node_modules`, `_refs/` nel git | CLAUDE.md |

**Non-obiettivi (v1):** video con persone reali o generati da modelli video; cartoon con personaggi (ClaudeAnimationBase, p5.js + p5.brush: percorso separato, vedi §6.3); voce narrante/TTS; pubblicazione sui social; editing di MP4 esistenti; durate oltre 60 s.

**Principio guida: vocabolario chiuso.** Il "regista" (LLM) **non scrive codice di scena**: sceglie scene da una libreria tipizzata e ne compila le props. Questo rende il risultato deterministico, validabile con schema e controllabile sul brand. Se il prompt richiede qualcosa che la libreria non copre, il motore **non improvvisa**: produce un *gap report* (§9) e si ferma. Nuove scene si aggiungono con lavoro umano/assistito, non a runtime.

---

## 2. Stato di partenza (cosa esiste già)

- `engine/dal-caos-allrsvp/`: prototipo funzionante (30 s, 9:16). Pagina HTML con timeline, `events.json` (cue audio), `mix.py` (musica ed effetti sintetizzati in codice), `build.sh`. Dipende da **`C:\Users\Marco\lemo-opuscar`** con percorso fisso, una libreria fuori dal repo.
- `briefs/dal-caos-allrsvp.md`: storyboard approvato (6 shot) e istruzioni di build.
- `.gitignore` già esclude `engine/*/fonts/`, `out/`, `events.json`, `stills/`.
- Font OFL in `assets/fonts/`, logo in `assets/logo/icon.svg`. **`assets/audio/` è vuota**: nessuna traccia con licenza.
- Ambiente: Node v26, Python 3.14, ffmpeg/ffprobe 8.0.1 nel PATH, Chrome in `C:\Program Files\Google\Chrome`, 12 core, **nessuna GPU NVIDIA**, Windows 10.
- `engine/`, `briefs/` e `assets/logo/` sono oggi **non tracciati** in git.

Il prototipo è il caso di prova: la libreria di scene (§7) è disegnata per riprodurlo, e un video equivalente deve uscire dal motore come **test di regressione** (golden storyboard).

---

## 3. Architettura a stadi

```
prompt ─► [1 Brief] ─► [2 Regista] ─► GATE A: approvazione storyboard ─► [3 Scene] ─► [4 Render] ─► [5 Audio]
              │             │                (umano)                          │            │            │
          brief.json   storyboard.json                                   timeline    video.silent.mp4  mix.wav
                                                                                          └──────┬──────┘
                                                                                          [mux] video.mp4
                                                                                                 │
                                           ┌──────── fail grave (max 3 giri) ◄───────── [6 QA]
                                           ▼                                                   │ ok
                                  rigenera solo gli shot indicati                       [7 Consegna] ─► out/<slug>/
```

Ogni stadio: **input → output su file**, idempotente, con hash degli input. Lo stadio successivo legge solo il file dello stadio precedente (mai stato in memoria), così `--from <stadio>` riprende da un errore e `batch` può ripartire.

| # | Stadio | Fa | Input | Output | LLM? |
|---|---|---|---|---|---|
| 1 | **Brief** | Trasforma il prompt libero in obiettivo, formato, durata, messaggio, CTA. Segnala ambiguità e dati mancanti (URL, prezzi, nomi) | prompt, `PRODOTTO_FATTI.md`, default di `engine.config.json` | `brief.json` | sì (1 chiamata, unita al regista se il prompt è chiaro) |
| 2 | **Regista** | Scrive lo storyboard con timecode usando **solo** scene del catalogo; ogni testo a schermo ha una `source` (claim o `mock`) | `brief.json`, `CATALOGO.json`, `PRODOTTO_FATTI.md` | `storyboard.json` | sì (1-3 chiamate con retry su schema) |
| — | **Lint storyboard** | Controlli deterministici: schema, somma durate, durate minime testo, claim non in PRODOTTO_FATTI, prezzi non letti da file, funzioni Premium marcate dove richiesto | `storyboard.json` | `storyboard.lint.json` | no |
| — | **GATE A** | L'utente vede la tabella timecode e approva. Salva `approval.json` con hash dello storyboard. Senza approvazione non si renderizza (R5) | — | `approval.json` | umano |
| 3 | **Scene** | Risolve ogni shot in una istanza di scena (componente + props) e costruisce la timeline unica `renderAt(t)` | `storyboard.json`, tema | `.work/timeline.json` | no |
| 4 | **Render** | Anteprima (540 px di larghezza, 15 fps) e finale (1080 px, 30 fps): Chrome headless, frame, FFmpeg | timeline | `.work/preview.mp4`, `.work/video.silent.mp4`, stills | no |
| 5 | **Audio** | Cue dalle scene, musica ed effetti, loudness, `mix.wav`; mux H.264+AAC | `events.json`, `assets/audio/index.json` | `mix.wav`, `video.mp4` | no |
| 6 | **QA** | (a) ffprobe, (b) lint DOM, (c) lint pixel, (d) revisione visiva LLM con rubrica; contact sheet | `video.mp4`, `storyboard.json`, stills | `qa-report.json`, `contact-sheet.jpg` | sì (solo (d)) |
| 7 | **Consegna** | Rinomina, scrive `manifest.json` (comandi, versioni, licenze, costi, tempi) | tutto | `out/<slug>/` | no |

**Anteprima prima del finale.** Lo storyboard approvato viene reso in bassa risoluzione e controllato (6a-6c sul preview) **prima** di spendere il render a piena risoluzione. Se il preview fallisce un controllo grave, non si renderizza il finale.

**Orchestrazione.** Un solo processo Node (`engine/cli`) che invoca gli stadi in ordine. Nessun framework di workflow. Ogni chiamata LLM passa da un unico modulo `llm.ts` che conta token/costo e applica i limiti (§11).

---

## 4. Struttura cartelle

```
engine/
  SPEC.md                    # questo file
  README.md                  # comandi, installazione da zero
  package.json, tsconfig.json, engine.config.json
  cli/                       # make, preview, render, qa, batch, doctor
  director/                  # brief.ts, storyboard.ts, prompts/*.md, llm.ts (claude -p)
  schemas/                   # zod: brief, storyboard, qa-report, manifest, catalog
  theme/                     # tokens.ts (da brand/tokens.json), fonts.css, safe-area.ts, orbi, texture
  scenes/                    # una cartella per scena: <Nome>/index.ts, schema.ts, preview.json
    CATALOGO.md              # scheda umana (generata)
    CATALOGO.json            # scheda macchina per il regista (generata dagli schema)
    _shared/                 # primitive: Text, Pill, Card, Phone, Cursor, Ripple, easing
  render/                    # harness: server statico, pagina host, capture, encode, mux
  audio/                     # sintesi (Python), mix.ts, loudness, lettura indice
  qa/                        # probe.ts, domlint.ts, pixellint.ts, sheet.ts, review.ts, rubric.md
  utils/                     # hash, slug, log, errori, processi, lock
  test/                      # vitest + golden/ (storyboard del prototipo)
  dal-caos-allrsvp/          # prototipo storico (resta finché il golden test non lo sostituisce)

assets/{fonts,logo,audio}/   # già esistenti; audio/index.json da creare
briefs/                      # prompt/brief per batch (.md)
out/<slug>/                  # consegna (non versionata)
out/<slug>/.work/            # intermedi (segmenti, preview, stills): cancellabili
```

`engine/` non deve dipendere a runtime da `_refs/` (non versionato) né da `C:\Users\Marco\lemo-opuscar`. Ciò che serve da quelle repo (MIT) viene **copiato e adattato** in `engine/render` e `engine/audio`, con attribuzione in `engine/CREDITS.md`.

---

## 5. Schemi JSON

Validati con zod; gli schemi sono la fonte e da lì si genera `CATALOGO.json`. Qui la forma, non il codice.

### 5.1 `brief.json`

```jsonc
{
  "version": 1,
  "slug": "rsvp-senza-account-20s",          // a-z0-9-, max 48
  "prompt": "video di 20 secondi sull'RSVP senza account",   // testo originale
  "goal": "spiegare che gli invitati confermano senza creare un account",
  "format": "9:16",                           // "9:16" | "16:9"
  "size": { "w": 1080, "h": 1920 },
  "fps": 30,
  "durationSec": 20,                          // 5..60
  "audience": "coppie italiane che organizzano il matrimonio",
  "message": "I tuoi invitati confermano in un tap, senza account",
  "claims": ["rsvp_senza_account"],           // id da PRODOTTO_FATTI (vedi 5.4)
  "cta": { "label": "Crea il tuo sito matrimonio", "url": "www.matrimoniosemplice.com", "approved": true },
  "tone": "caldo, elegante",
  "loop": false,                              // true: ultimo frame == primo (hero)
  "audio": "synth",                           // "none" | "synth" | "library"
  "needsFromUser": [                          // dati mancanti: il motore NON li inventa
    { "field": "cta.url", "reason": "URL non presente in brand/" }
  ],
  "assumptions": ["Nomi fittizi: Giulia e Marco"]
}
```

`needsFromUser` non vuoto → il motore usa il segnaposto dichiarato (`[URL]`, `[PREZZO]`), lo scrive nel manifest e lo segnala; il risultato esce come bozza, mai come finale (§9, `E_PLACEHOLDER`).

### 5.2 `storyboard.json`

```jsonc
{
  "version": 1,
  "briefHash": "sha256:…",
  "format": "9:16", "size": {"w":1080,"h":1920}, "fps": 30, "durationSec": 20,
  "theme": { "background": "coverHero", "palette": "rosa-romantico", "texture": "grain" },
  "shots": [
    {
      "id": "s1",
      "start": 0.0, "end": 4.0,                  // secondi; end(n) == start(n+1); ultimo end == durationSec
      "scene": "HookText",                       // nome nel catalogo
      "props": { "eyebrow": "RSVP", "headline": "Niente app. Niente account." },
      "onScreenText": [                          // tutto ciò che è leggibile, per lint e QA
        { "text": "Niente app. Niente account.", "role": "headline",
          "source": { "kind": "claim", "id": "rsvp_senza_account" } }
      ],
      "transitionIn": { "type": "dissolve", "dur": 0.6 },     // dissolve | slide | fromCream (BRAND_VIDEO §5)
      "camera": { "move": "pushIn", "amount": 0.04 },         // zoom totale ≤ 8%
      "audio": { "music": "intro", "cues": ["whoosh@3.6"] },
      "notes": "Gancio. Respiro lento, nessun movimento brusco."
    }
  ],
  "music": { "mood": "caldo-minimale", "bpm": 96, "fadeIn": 1.0, "fadeOut": 2.0 }
}
```

`onScreenText[].source.kind`:
- `claim`: `id` deve esistere in `PRODOTTO_FATTI` (§5.4);
- `mock`: dato fittizio dentro un mockup (nomi, date, conteggi); ammesso solo in scene con `mockup: true`, mai come promessa;
- `ui-label`: etichetta d'interfaccia, ammessa solo se la funzione è in PRODOTTO_FATTI;
- `cta`: deve coincidere con `brief.cta.label`; se `approved:false` genera avviso;
- `price`: ammesso solo se `props.priceRef` punta a un file effettivamente letto (`content/commercial.ts`), altrimenti `E_PRICE_UNVERIFIED`.

### 5.3 `qa-report.json`

```jsonc
{
  "version": 1, "round": 1, "verdict": "pass|fail|warn",
  "probe": { "durationSec": 20.03, "w": 1080, "h": 1920, "fps": 30, "vcodec": "h264", "acodec": "aac",
             "expected": { "durationSec": 20, "toleranceSec": 0.1 }, "ok": true },
  "lint": [ { "id": "TEXT_SIZE", "severity": "blocker", "shot": "s3", "t": 7.2,
              "detail": "font 32px < 36px minimo 9:16", "evidence": "stills/s3_7.2.png" } ],
  "review": { "model": "…", "scores": { "brand": 8, "readability": 7, "rhythm": 7, "claims": 9, "coherence": 8 },
              "issues": [ { "shot": "s2", "severity": "major", "what": "…", "fix": "…" } ] },
  "regenerate": ["s2"],
  "cost": { "usd": 0.00, "inputTokens": 0, "outputTokens": 0 }
}
```

### 5.4 `PRODOTTO_FATTI` come dato

`PRODOTTO_FATTI.md` è prosa; per il lint serve una forma leggibile da macchina. **[Proposta]** `brand/fatti.json` (id, testo ammesso, piano, fonte) generato dalla tabella del `.md`, che resta l'unica fonte; un test fallisce se divergono. Il regista legge il `.md`, il lint usa il `.json`.

### 5.5 `manifest.json`

Vedi §10.

---

## 6. Renderer: Remotion vs harness HTML+Chrome+FFmpeg

### 6.1 Cosa sono

- **Remotion**: framework React/TS. La composizione è funzione del frame (`useCurrentFrame`), anteprima nello Studio, `remotion render` con Chrome headless + FFmpeg.
- **Harness di mg-styles-15** (`harness/render.mjs`, MIT): una pagina HTML espone `window.renderAt(t)`; Node (puppeteer-core) la serve, cattura ogni frame in Chrome headless e lo manda in pipe a FFmpeg. Supporta worker paralleli, motion blur a sotto-campioni, stills, mux audio. Lo stesso contratto è usato dal prototipo.

**Fatto rilevante:** entrambi renderizzano con **Chrome headless frame per frame**. Il costo per frame è dello stesso ordine; la velocità non è un criterio di scelta.

### 6.2 Confronto

| Criterio | Remotion | Harness HTML+Chrome+FFmpeg |
|---|---|---|
| **Licenza** | Non MIT: licenza propria, gratuita solo sotto certe condizioni, a pagamento oltre. **Da verificare sul sito ufficiale** prima di un uso commerciale (lo dice anche la guida). Per un SaaS è un'incognita legale/di costo | MIT (mg-styles-15, Lemo-Opuscar). Nessun costo né vincolo |
| **Dipendenze** | Remotion + React + bundler + CLI; aggiornamenti frequenti | `puppeteer-core` + Chrome già installato + FFmpeg già nel PATH. Poche centinaia di righe nostre |
| **Allineamento con lo stack** | React/TS come il sito Next.js, ma i mockup del video non sono i componenti del sito (dati fittizi, animazioni a tempo): riuso reale basso | TS + DOM/SVG/CSS, stessi token CSS di `brand/preview.html`. Nessun React richiesto |
| **Determinismo** | Buono (frame-driven) | Buono **se** ogni animazione è funzione di `t` (niente `setTimeout`, `Date.now`, `Math.random` non seedato). L'harness mette in pausa e posiziona anche `document.getAnimations()`. Regola da imporre e testare |
| **Sincronia audio** | Manuale | Le scene dichiarano i cue (`events.json`) dalla stessa timeline: già dimostrato dal prototipo (ping, key, tap, whoosh, chime). Un'unica fonte di tempo per immagine e suono |
| **Anteprima interattiva** | Remotion Studio, ottimo | Da costruire: `preview.html` con scrubber su `renderAt(t)` (mg-styles-15 ne ha una da cui partire). Utile agli umani, non indispensabile al motore |
| **LLM nel loop** | Più superficie: hook, props, bundler, errori di build | Superficie minima: il regista non scrive codice; il render è una funzione pura su JSON |
| **Windows** | Supportato | `render.mjs` originale è pensato per macOS/Linux (percorso Chrome di default macOS, lock in `/tmp`, flag GPU Linux): va portato. Il `video.mjs` di Lemo-Opuscar, usato dal prototipo, ha già gestione Windows. **Lavoro reale ma contenuto** |
| **Qualità/finish** | Identica (stesso Chrome) | Identica; motion blur a sotto-campioni già presente |
| **Manutenzione** | Dipende dalla roadmap esterna | Codice nostro e piccolo; Chrome e ffmpeg sono standard |
| **Ecosistema** | Template, player embeddabile, rendering cloud | Nulla di tutto ciò; per ora non serve |
| **Prova sul campo** | Nessuna in questo repo | **Già prodotto un MP4 da 30 s** (`out/dal-caos-allrsvp.mp4`) |

### 6.3 Raccomandazione: **harness HTML + Chrome + FFmpeg** (implementazione nostra in `engine/render`)

Motivi, in ordine di peso:
1. **Rischio licenza zero.** Le condizioni commerciali di Remotion dipendono dalla dimensione dell'azienda e vanno verificate; MatrimonioSemplice è un SaaS commerciale. Non costruirei il motore su una dipendenza con un'incognita legale.
2. **Già dimostrato qui.** Il prototipo con lo stesso contratto `renderAt(t)` esiste ed è stato approvato. Con Remotion si riparte da zero e si rimette in gioco il look già approvato.
3. **Superficie minima per un motore autonomo.** Un contratto di una funzione e due file JSON. Meno cose che si rompono senza un umano presente.
4. **Un'unica timeline per immagine e audio.** I cue nascono dalle scene, quindi l'audio non può uscire di sincronia.
5. **Brand come CSS.** I token diventano variabili CSS e `@font-face` locali, come in `brand/preview.html`; i controlli "max 2 font, niente `#000000`" si fanno sul DOM calcolato.

Cosa **si perde** e come si mitiga:
- *Studio interattivo*: si costruisce una `preview.html` con scrubber **[Da misurare]**.
- *Porting Windows*: parte dello scaffold (M1), partendo dal `video.mjs` di Lemo che gira già qui, senza il percorso fisso `C:\Users\Marco\lemo-opuscar`.
- *Nessun riuso dei componenti del sito*: non è un vero vantaggio, vedi tabella.

**Quando cambierei idea:** se servisse rendering cloud scalato o un player embeddato nell'app **e** la licenza Remotion risultasse compatibile. Il contratto `storyboard.json → scene` è indipendente dal renderer: la migrazione toccherebbe solo `engine/render` e le scene.

**Non per v1: ClaudeAnimationBase** (p5.js + p5.brush). Ottimo per cartoon dipinti a mano con un personaggio, ma lento senza GPU (il suo README dice che i fill ad acquerello costano secondi per frame), con uno stile "dipinto" lontano dal design system pulito, e la sua guida vieta il testo. Resta come percorso separato manuale per il Prompt 6 (mini cartoon).

**Da `opus-video-prompts`** prendo solo la lezione di metodo (storyboard prima del codice, contact sheet, autoverifica), che coincide già con CLAUDE.md. Non ho trovato nulla da usare come dipendenza. Dalla `rubric.md` di mg-styles-15 riprendo la struttura di revisione indipendente e i controlli (durata esatta, loudness, frame neri, sync) adattati al nostro brand (§8.2).

---

## 7. Libreria di scene

Ogni scena: una cartella con `schema.ts` (props zod), `index.ts` (`mount(root, props, ctx)`, `update(t)` pura sul tempo locale, `cues(props)`), `preview.json` (props di esempio) e una scheda nel catalogo. **Nessuno stato fuori da `t`.** Tempo locale `t ∈ [0, dur]`.

Durate minime/consigliate sono **[Proposta]** da tarare sul prototipo.

| Scena | Cosa mostra | Props principali | Durata min / consigliata | Origine nel prototipo |
|---|---|---|---|---|
| `HookText` | Gancio: eyebrow + headline Playfair | `eyebrow?, headline, sub?` | 2.5 / 3 s | didascalie shot 1-2 |
| `TitleCard` | Titolo + sottotitolo su hero | `title, subtitle?` | 2.5 / 4 s | — |
| `ChatChaos` | Chat generica che si riempie di messaggi sovrapposti | `messages[], density` | 3 / 5 s | shot 1 |
| `SpreadsheetChaos` | Foglio disordinato che scorre | `columns[], rows[]` (mock) | 3 / 5 s | shot 2 |
| `PhoneMockupSite` | Telefono con sito matrimonio (cover, storia, programma) | `names, date, place` (mock), `sections[]` | 4 / 5 s | shot 3 |
| `RsvpFlow` | Modulo RSVP: tap su presenza, accompagnatori, menu, conferma | `steps[], labels[]` | 6 / 8 s | shot 4 |
| `GuestDashboard` | Contatore che sale, invitati che si ordinano per stato | `guests[]` (mock), `counters` | 4 / 6 s | shot 5 |
| `GiftFundCard` | Sezione fondo regalo, copia IBAN in un tap (segnaposto grafico) | `title, copyLabel, thankYou` | 4 / 6 s | — (Prompt 3) |
| `TableSeating` | Piantina sala, tavoli trascinati | `tables[], guests[]` (mock) | 5 / 7 s | — (Prompt 4) |
| `PlanningChecklist` | Checklist che si spunta, budget a barre, timeline del giorno | `items[], budget (mock), timeline[]` | 5 / 7 s | — (Prompt 4) |
| `PriceCard` | Piano gratuito / Premium con prezzi **letti da `brand/prezzi.json`** (12 €/mese, 79 € una tantum) | `priceRef, plans[]` | 4 / 6 s | — (Prompt 5) |
| `KineticList` | Elenco animato con icona semplice per voce | `items[{icon,text}]` | 4 s per voce | — (Prompt 7) |
| `HeroLoop` | Sito che si compone a blocchi, orbi, petali rari; loop perfetto | `blocks[], names (mock)` | 12 / 15 s | — (Prompt 1) |
| `EndCard` | Logo (`assets/logo/icon.svg`) + frase + pillola CTA + URL | `tagline, cta, url` | 3 / 5 s | shot 6 |

**Transizioni** non sono scene: le applica il compositore tra shot (dissolvenza, scorrimento morbido, da/verso cream; BRAND_VIDEO §5).

**Regole comuni a tutte le scene (verificate dal lint, §8.2):** testo ≥ 36 px (9:16) / 28 px (16:9); dentro la safe area; durata testo ≥ 1.2 s + 0.30 s/parola, minimo 2 s; entrate ≤ 24 px in 0.6-0.9 s; niente rimbalzo/elastico/shake; zoom totale ≤ 8%; una sola texture per inquadratura; blush mai sfondo di testo piccolo; un solo CTA per end card; dati dei mockup fittizi e dichiarati `mock`.

**Estensibilità.** Aggiungere una scena = nuova cartella + schema + preview + test del fotogramma. Il catalogo si rigenera e il regista la vede subito, senza toccare il regista.

**Fuori catalogo in v1 (gap noti):** persone, cartoon, grafici di dati o statistiche, confronti con concorrenti (nessun dato in PRODOTTO_FATTI), testimonianze.

---

## 8. Audio e QA

### 8.1 Audio

Tre modalità in `brief.audio`:
- `none`: nessuna traccia (es. loop hero, Prompt 1). Il manifest dichiara `audio: "none"`.
- `synth` (**default, [Proposta]**): musica ed effetti **sintetizzati in codice** (Python: numpy/scipy/soundfile) dai cue delle scene, come `mix.py`. Nessun campione di terzi, quindi nessun problema di licenza; sostituibile con `library` quando ci saranno tracce registrate.
- `library`: sceglie da `assets/audio/index.json` (`id, file, titolo, durata, bpm, tag, licenza, fonte, attribuzione`). **Oggi non esiste** e `assets/audio/` è vuota. Se l'indice manca o non ha tracce con licenza compilata, il motore non sceglie nulla in silenzio: esporta senza audio (o `synth` se consentito) e lo scrive nel manifest (come da M5).

Mix: fade in/out da `storyboard.music`, normalizzazione. **[Proposta]** target **-14 LUFS integrato ±1, true peak ≤ -1 dBTP** (valori della rubrica di mg-styles-15, adatti ai social; da confermare), misurati con `ffmpeg loudnorm` e scritti nel manifest. Mux finale H.264 (`yuv420p`, `+faststart`, bt709) + AAC 48 kHz, come nel prototipo.

### 8.2 QA: quattro livelli, i primi tre **deterministici**

| Livello | Cosa | Come | Gravità |
|---|---|---|---|
| 6a **ffprobe** | durata (±0.1 s), risoluzione, fps, codec, audio presente/atteso, `pix_fmt`, nessun frame nero iniziale non voluto | `ffprobe -show_streams -show_format -of json` | blocker (R7) |
| 6b **Lint DOM** | A tempi campionati (ogni 0.5 s e ai bordi degli shot): bounding box di ogni testo dentro la safe area; `font-size` minimo; `font-family` usate ≤ 2; testi nel DOM ⊆ `onScreenText` (nessun testo non dichiarato); contrasto testo/sfondo | `getBoundingClientRect`, `getComputedStyle` nella pagina | blocker/major |
| 6c **Lint pixel** | Nessun pixel `#000000` nei frame; nessun flash bianco (salti di luminanza); tratti statici troppo lunghi | decodifica frame con ffmpeg, analisi su array | blocker/warn |
| 6d **Revisione LLM** | Contact sheet (1 frame/s, più frame ai cambi shot) + 5-8 stills a piena risoluzione; rubrica: leggibilità, coerenza brand, claim vs PRODOTTO_FATTI, ritmo, elementi tagliati, coerenza tra shot, "generico/da template" | `claude -p` con immagini, output JSON validato | major/minor |

Misurare "testo dentro la safe area" nel DOM è più affidabile e più economico che chiederlo a un modello visivo; l'LLM giudica solo ciò che non si misura (gusto, ritmo, coerenza).

**Giri di correzione (max 3, configurabile).** `qa-report.regenerate` elenca gli shot con problemi gravi. Per giro: (1) il regista riceve **solo** gli shot indicati e i problemi e può modificare props/durate/testi di quegli shot (non il catalogo né gli altri shot); (2) si rilancia il lint storyboard; (3) si ri-renderizzano **solo** quegli shot e si riassembla; (4) QA completo. Se la modifica cambia testo, durata o claim serve nuova approvazione (manuale, o `auto` se pulita: §16); una correzione solo grafica no.

### 8.3 Renderer: dettagli

- Pagina host `render/host.html`: carica tema (CSS), font locali, compone gli shot con transizioni; espone `window.__ready`, `window.renderAt(t)`, `window.cuesAt()`.
- Server statico su `127.0.0.1` con porta effimera; Chrome via `puppeteer-core` (`CHROME_PATH`, default `C:\Program Files\Google\Chrome\Application\chrome.exe`), headless, `--no-sandbox` solo su Linux.
- Frame inviati in pipe a ffmpeg (nessun PNG su disco); N worker (default 3, come il prototipo) su segmenti, poi concatenazione senza perdita.
- Render **per shot** con segmenti nominati per hash (`.work/segments/<shotHash>.mp4`): ri-renderizzare solo gli shot cambiati rende rapido il giro di QA.
- Codifica: preview H.264 a 540x960 / 960x540, 15 fps; finale 1080x1920 / 1920x1080, 30 fps, `yuv420p`, bt709.

---

## 9. Gestione errori

Principi: **fallire presto, fallire forte, in italiano, senza output parziale spacciato per finito.** Ogni errore ha codice, messaggio, causa probabile, azione; viene scritto in `out/<slug>/error.json` e il processo esce con codice ≠ 0.

| Codice | Quando | Reazione automatica | Exit |
|---|---|---|---|
| `E_ENV` | ffmpeg/ffprobe/Chrome/Node/Python mancanti o versione sbagliata | `npm run doctor` elenca cosa manca; nessuna chiamata LLM | 10 |
| `E_LLM_UNAVAILABLE` | `claude` non trovato, non autenticato o rate limit | 2 retry con backoff; poi stop con indicazioni | 20 |
| `E_SCHEMA` | JSON del regista non valido | Rifà la chiamata **fino a 2 volte** passando gli errori zod; poi stop | 21 |
| `E_GAP` | Il prompt richiede una scena o funzione fuori catalogo o fuori PRODOTTO_FATTI | **Non improvvisa.** Scrive `gap-report.md` (cosa manca, scena più vicina, proposta) e si ferma | 22 |
| `E_CLAIM` | Testo con claim non in fatti, o numero/prezzo/recensione inventati | Ritorna al regista con l'elenco (conta come retry di `E_SCHEMA`); poi stop | 23 |
| `E_PRICE_UNVERIFIED` | Prezzo richiesto ma `brand/prezzi.json` manca, o un prezzo a schermo non coincide | Segnaposto `[PREZZO]` + avviso; solo bozza | 24 |
| `E_PLACEHOLDER` | Restano segnaposto (`[URL]`, `[PREZZO]`) o CTA `approved:false` | Esporta come `video-DRAFT.mp4`, mai come finale | 25 |
| `E_NOT_APPROVED` | Render richiesto senza `approval.json` coerente con l'hash dello storyboard | Stop, mostra la tabella e come approvare | 30 |
| `E_RENDER_PAGE` | Errore JS nella pagina, font non caricato, `__ready` mai true | Salva screenshot e log console; 1 retry del solo segmento; poi stop | 40 |
| `E_RENDER_TIMEOUT` | Un segmento supera il limite (§11) | Termina i processi figli, pulisce lock/segmenti, stop | 41 |
| `E_ENCODE` | ffmpeg fallisce | Log stderr in `.work/ffmpeg.log`; stop | 42 |
| `E_AUDIO` | Sintesi/mix fallisce, o loudness fuori tolleranza dopo 1 correzione | Con `audio: required` stop; altrimenti esporta muto **e** segnala nel manifest | 50 |
| `E_QA_BLOCKER` | Problema grave dopo l'ultimo giro | Il video resta in `.work/` come `FAILED-QA`, **non** in `out/<slug>/video.mp4`; `qa-report.json` spiega | 60 |
| `E_BUDGET` | Superato `--max-cost` o `--max-wall` | Stop immediato, salva stato; `--from` riprende | 70 |

**Robustezza:**
- *Idempotenza e ripresa*: ogni stadio scrive un marker `.done` con l'hash degli input; `--from render` o `batch` dopo un crash riparte da lì.
- *Lock*: un solo render per `out/<slug>`, con pid e scadenza; pulizia dei lock orfani.
- *Processi*: nessun Chrome/ffmpeg orfano (kill dell'albero su Ctrl-C/timeout).
- *Niente successo silenzioso*: `video.mp4` compare in `out/<slug>/` **solo** dopo che 6a-6d sono passati; prima vive in `.work/`.
- *Dichiarazione di fine*: il comando stampa "FINITO" soltanto con MP4 esistente e blocco `ffprobe` nel report (R7).
- *Log*: `out/<slug>/run.log` strutturato (stadio, durata, esito).

---

## 10. Formato dei file di output

```
out/<slug>/
  video.mp4              # solo se QA passato. H.264 yuv420p + AAC 48 kHz, faststart, bt709
  poster.jpg             # frame di copertina scelto dal regista (shot id + t)
  contact-sheet.jpg      # 1 frame/s etichettato con timecode e shot
  storyboard.json        # quello approvato (+ approval.json)
  brief.json
  qa-report.json
  manifest.json
  run.log
  gap-report.md          # solo se E_GAP
  .work/                 # cancellabile: segments/, stills/, preview.mp4, mix.wav, ffmpeg.log
```

Bozze con segnaposto: `video-DRAFT.mp4`.

### `manifest.json`

```jsonc
{
  "version": 1,
  "slug": "rsvp-senza-account-20s",
  "status": "final|draft|failed",
  "createdAt": "2026-11-13T22:00:00Z",
  "prompt": "…",
  "briefHash": "sha256:…", "storyboardHash": "sha256:…", "approvedAt": "…",
  "output": { "file": "video.mp4", "bytes": 0, "sha256": "…",
              "probe": { "durationSec": 20.0, "w": 1080, "h": 1920, "fps": 30, "vcodec": "h264", "acodec": "aac" } },
  "audio": { "mode": "synth", "loudnessLUFS": -14.0, "truePeakDb": -1.2, "tracks": [] },
  "licenses": {
    "fonts": [ { "name": "Playfair Display", "license": "OFL-1.1", "file": "assets/fonts/playfair-display/OFL.txt" },
               { "name": "Inter", "license": "OFL-1.1", "file": "assets/fonts/inter/OFL.txt" } ],
    "music": "sintetizzata in codice, nessun campione di terzi",
    "images": [ { "file": "assets/logo/icon.svg", "owner": "MatrimonioSemplice" } ]
  },
  "claimsUsed": ["rsvp_senza_account"],
  "placeholders": [],
  "qa": { "rounds": 1, "verdict": "pass", "reportFile": "qa-report.json" },
  "timing": { "totalSec": 0, "stages": { "brief": 0, "director": 0, "render": 0, "audio": 0, "qa": 0 } },
  "cost": { "usd": 0, "llmCalls": 0, "inputTokens": 0, "outputTokens": 0 },
  "versions": { "engine": "0.1.0", "node": "26.12.1", "ffmpeg": "8.0.1", "chrome": "…", "claudeCli": "…", "model": "…" },
  "commands": ["…"]
}
```

---

## 11. Limiti di costo e di tempo

Tutti in `engine.config.json`, sovrascrivibili da CLI. I valori sono **[Proposta]** da tarare dopo i primi tre video.

| Limite | Default | Effetto |
|---|---|---|
| `--max-calls` (chiamate `claude -p`) | **8** per video | `E_BUDGET` prima della chiamata che supererebbe il tetto. Il piano è a forfait: il tetto è in chiamate, non in dollari. Caso peggiore previsto: 3 (brief+regista) + 3 giri × 1 revisione = 6, più 2 di margine |
| `--max-cost` (USD) | non usato (nessuna API a consumo) | resta in config solo se un giorno si passa ad API con chiave |
| Ripartizione chiamate | brief+regista ≤ 3; revisione QA ≤ 1 per giro; correzione regista ≤ 1 per giro (conta nel tetto di 8) | contatore in `llm.ts` |
| `--max-rounds` (giri QA) | 3 | oltre: `E_QA_BLOCKER` |
| Retry schema regista | 2 | poi `E_SCHEMA` |
| Durata video | 5-60 s | oltre: rifiuto con messaggio |
| Tempo render per segmento | 10 min | `E_RENDER_TIMEOUT` |
| `--max-wall` (tempo totale) | 45 min | `E_BUDGET` |
| Immagini per revisione LLM | contact sheet + ≤ 8 stills | limita i token visivi |
| Batch | 1 video alla volta | evita di saturare CPU/RAM; il render usa già 3 worker |

**Stima tempi [Da misurare]:** il render è CPU-bound (nessuna GPU). Il prototipo (30 s a 1080x1920 e 30 fps = 900 frame) è già stato renderizzato su questa macchina, ma non ho un tempo misurato: `npm run doctor` cronometrerà un render di riferimento. Ri-renderizzare solo gli shot modificati nei giri QA riduce il costo ripetuto.

**Stima costi LLM [Da misurare]:** brief+regista = 1-3 chiamate con input (catalogo + fatti + prompt) di qualche migliaio di token e output di circa 1-2 mila token; revisione QA = 1 chiamata con circa 10 immagini per giro. Non do un numero in dollari: dipende da modello e piano. `llm.ts` registra token e costo, se esposto dal CLI (da verificare nella versione installata), e li scrive nel manifest. Con un piano a forfait, `max-cost` diventa un tetto in **chiamate/token**.

**Sicurezza dell'autonomia.** Le chiamate `claude -p` usano strumenti in sola lettura (nessun `Bash`, nessuna scrittura), `--output-format json`, mai `--dangerously-skip-permissions`. Il motore scrive i file, non il modello.

---

## 12. Comandi

```
npm run make    -- "<prompt>" [--format 9:16|16:9] [--duration 20] [--audio none|synth|library]
                              [--preview] [--approve|--auto-approve] [--max-calls 8] [--max-rounds 3] [--from stadio]
npm run preview -- <slug>        # storyboard + preview.mp4 + contact sheet, senza render finale
npm run render  -- <slug>        # render finale + audio (richiede approvazione)
npm run qa      -- <file.mp4> [--storyboard path]   # QA su MP4 esistente
npm run batch   -- briefs/       # tutti i .md in coda, con ripresa
npm run doctor                   # verifica ambiente e benchmark
npm test                         # vitest + golden
```

**Comportamento di default conforme a CLAUDE.md:** `make` senza `--approve` **si ferma allo storyboard** (GATE A), stampa la tabella timecode e le richieste `needsFromUser`. L'utente approva con `npm run render -- <slug> --approve`. `--approve` è l'autorizzazione manuale; `--auto-approve` (o `autoApprove: true` in config) approva da solo, con le salvaguardie di §16. La skill `make-video` usa `--auto-approve` solo se l'utente lo chiede nella richiesta.

---

## 13. Test

- **Unit (vitest):** schemi; lint storyboard (casi: claim falso, prezzo non verificato, testo troppo breve, somma durate sbagliata); calcolo durata testo; loudness; slug.
- **Scene:** per ogni scena, render di un fotogramma a 3-4 istanti da `preview.json`, confronto con baseline (soglia PSNR/SSIM) e lint DOM. Test di determinismo: stesso `t` renderizzato due volte = stessi pixel.
- **Golden:** storyboard del prototipo → MP4 → `ffprobe` corretto (30.0 s, 1080x1920, 30 fps) e QA 6a-6c pass. Confronto con `out/dal-caos-allrsvp.mp4` solo visivo, non pixel-esatto.
- **Regista (con LLM):** 3 prompt (RSVP 20 s 9:16, tavoli 20 s 16:9, prezzo 10 s 9:16, come in M9); non in esecuzione ordinaria perché costano; output in `out/_test/`.
- **Negativi:** prompt con testimonianze, statistiche, concorrenti, prezzo senza file → deve uscire `E_GAP`/`E_CLAIM`/`E_PRICE_UNVERIFIED`, non un video.

---

## 14. Rischi

| # | Rischio | Prob. | Impatto | Mitigazione |
|---|---|---|---|---|
| 1 | **Claim inventati** (funzioni, numeri, prezzi) | alta senza controlli | alto (legale/reputazione) | `source` obbligatoria per ogni testo; lint contro `fatti.json`; testo nel DOM non dichiarato = blocker; la QA LLM controlla i claim come secondo livello |
| 2 | **Il regista aggira il catalogo** | media | medio | Schema chiuso; `E_GAP` invece di improvvisazione |
| 3 | **Look generico "da template"** | media | medio | Rubrica QA include "generico"; scene curate dal prototipo; revisione umana finale obbligatoria (CLAUDE.md: si guarda sempre il video intero) |
| 4 | **Non determinismo** (animazioni non legate a `t`, font non caricati) | media | alto | Regole di scena; test di seek ripetuto; `document.fonts.ready`; niente `Date.now` o `Math.random` non seedato |
| 5 | **Licenza Remotion** (se scelto) | — | alto | Evitata scegliendo l'harness; se si cambiasse idea, verificare prima |
| 6 | **Porting Windows dell'harness** | media | medio | Partire dal `video.mjs` di Lemo, che gira già qui; `doctor` |
| 7 | **Render lento senza GPU** | alta | medio | Anteprima a bassa risoluzione, cache per shot, limite 60 s, `max-wall` |
| 8 | **Audio senza licenza** | media | alto | Default `synth` in codice; `library` solo con indice compilato; manifest elenca tutto |
| 9 | **Costo LLM fuori controllo** (retry a cascata) | media | medio | Contatore unico, stima pre-chiamata, tetto a retry e giri, `max-cost` |
| 10 | **Dipendenza dal CLI `claude -p`** (flag, formato JSON, versione) | media | medio | Un solo modulo `llm.ts`; versione registrata; test di fumo in `doctor`; Agent SDK dietro la stessa interfaccia |
| 11 | **Prompt injection** (prompt o brief importati con istruzioni nascoste) | bassa | medio | Il modello ha solo strumenti in sola lettura; output validato da schema; il motore non esegue mai codice proposto dal modello |
| 12 | **Dati personali nei mockup** | bassa | alto | Nomi/date/luoghi/IBAN solo fittizi e marcati `mock`; IBAN solo segnaposto grafico; nessuno screenshot reale |
| 13 | **Auto-approve** manda in render uno storyboard che nessuno ha letto | media | medio | Solo con lint pulito e nessun segnaposto; `approvedBy: "auto"` nel manifest; resta la regola di guardare il video intero prima di pubblicare |
| 14 | **Dati di brand incompleti** (URL, CTA ufficiali, prezzi, musica, safe area non ufficiali) | certa | medio | `needsFromUser`, segnaposto, bozze etichettate `DRAFT` |
| 15 | **Prototipo e motore divergono** (due codici per lo stesso video) | media | basso | Il golden test fissa l'equivalenza; poi `dal-caos-allrsvp/` si archivia |
| 16 | **Un aggiornamento di Chrome cambia il rendering** | bassa | basso | Versione Chrome nel manifest; baseline con soglia, non pixel-esatta |
| 17 | **Disco** (il prototipo ha prodotto circa 22 MB + 10 MB per 30 s, più mix e preview) | media | basso | Pipe diretta a ffmpeg, pulizia di `.work/`, `.gitignore` già copre `out/` e `*.mp4` |

---

## 15. Piano di realizzazione (corrisponde a M1-M9 di GUIDA_VIDEO)

1. **M1** scaffold: TS, zod, vitest, cartelle, `doctor`; porting dell'harness in `engine/render`.
2. **M2** `theme/` da `tokens.json` + immagine `out/_test/brand.png`.
3. **M3** scene (prima quelle del prototipo, poi le altre) + catalogo.
4. **M4** brief+regista+lint, con `E_GAP`/`E_CLAIM`.
5. **M5** render+audio+mux.
6. **M6** QA 6a-6d con giri.
7. **M7** `make`/`batch`/manifest. **M8** skill `make-video` e `qa-video`. **M9** test, documentazione, commit.

I prompt M1-M9 restano validi, con due deviazioni dichiarate rispetto alla guida: renderer = harness (non Remotion) e QA con livelli deterministici prima della revisione LLM.

---

## 16. Decisioni prese (2026-11-13) e domande ancora aperte

### Decisioni dell'utente

| # | Decisione | Effetto sulla spec |
|---|---|---|
| 1 | **Auto-approve previsto**, oltre all'approvazione manuale | §12: flag `--auto-approve` e `engine.config.json: autoApprove`, con salvaguardie (sotto) |
| 2 | Renderer: **harness HTML+Chrome+FFmpeg**, niente Remotion | §6.3 confermato |
| 3 | Si copiano/adattano in `engine/` le parti MIT di Lemo-Opuscar | §4 |
| 4 | Claude chiamato con **`claude -p` sul piano dell'utente** (nessuna chiave API, nessun `.env`) | §11: i tetti sono in **chiamate**, non in dollari |
| 5 | Tetti scelti da me per la migliore resa | §11 aggiornato |
| 6 | URL `www.matrimoniosemplice.com` e CTA "Crea il tuo sito matrimonio" **ufficiali** | `cta.approved: true` di default |
| 7 | Prezzi: **12 (mensile) e 79 (una tantum)** | §7 `PriceCard`, vedi nota sotto |
| 8 | Audio sintetizzato in codice come default; target -14 LUFS / -1 dBTP | §8.1 confermato |

### Auto-approve: come funziona

L'approvazione resta un file (`approval.json`), ma può essere scritta in due modi: `by: "user"` (comando manuale `render --approve`) oppure `by: "auto"` (flag/config). Salvaguardie **[Proposta]**:
- `auto` approva solo se il lint dello storyboard non ha **né blocker né warning** e non restano segnaposto (`needsFromUser` vuoto).
- Con `E_GAP`, `E_CLAIM`, `E_PRICE_UNVERIFIED` o segnaposto non c'è auto-approve: il motore si ferma anche in modalità auto.
- Nei giri di correzione QA, in modalità auto le modifiche a testo/claim passano di nuovo dal lint e, se pulito, si riapprovano `auto`; altrimenti stop.
- `approval.json` e `manifest.json` registrano `approvedBy: "auto"|"user"` e l'hash dello storyboard, così si vede sempre cosa è stato approvato da una persona.
- Default di `engine.config.json`: `autoApprove: true` dal 2026-11-14, come richiesto per `make`: senza `--preview` il flusso prosegue da solo, con le salvaguardie sopra. `--preview` si ferma sempre al piano e `--approve` è l'approvazione manuale; non esiste un flag `--auto-approve`. `batch` approva da solo con le stesse salvaguardie.
- **Nota su CLAUDE.md:** la regola "storyboard con approvazione esplicita dell'utente prima di scrivere codice" resta vera per la modalità manuale e per **sviluppo del motore**. L'auto-approve è una tua deroga esplicita per i video generati. Suggerisco di aggiungere una riga a CLAUDE.md che lo dica (non l'ho modificato).

### Prezzi (nota)

`PRODOTTO_FATTI.md` dice di non mostrare prezzi finché non riletti da `content/commercial.ts`, file che non è nel repo. Ora hai confermato 12 e 79. **[Proposta]**: creare `brand/prezzi.json` con `{ "mensile": 12, "unaTantum": 79, "valuta": "EUR", "fonte": "confermato dall'utente il 2026-11-13" }`; `PriceCard` legge solo da lì (`priceRef`), e `E_PRICE_UNVERIFIED` scatta se il file manca o un prezzo a schermo non coincide. Da aggiornare a mano se il sito cambia i prezzi. Il significato "12 = al mese, 79 = pagamento unico" viene da `02_TIPO_DI_PROGETTO.md`; non so cosa includa ciascuno (limiti, funzioni): il video non lo dirà.

### Decisioni 9-17 (2026-11-13: "default ok")

Confermati tutti i default proposti: 9) safe area 9:16 = 64/220/340 px, 16:9 = 96/54/54 px; 10) blocker = dimensione testo, safe area, `#000000`, max 2 font, il resto warning; 11) solo 9:16 e 16:9, 5-60 s; 12) scene di §7, mini cartoon fuori dal motore; 13) etichetta "Premium" sempre su planning/tavoli; 14) fondo regalo = "lista nozze senza commissioni, bonifico diretto", IBAN segnaposto grafico; 15) `dal-caos-allrsvp` = golden test poi archivio, e commit di `engine/`, `briefs/`, `assets/logo/`; 16) messaggi/log/README in italiano, codice in inglese; 17) giudice QA = chiamata `claude -p` separata dal regista.

Ancora da fare a mano (non eseguito): riga su auto-approve in CLAUDE.md; aggiornare in `PRODOTTO_FATTI.md` la riga prezzi; creare `brand/prezzi.json`.

**Nessuna domanda aperta. Spec approvata, si procede con M1.**
