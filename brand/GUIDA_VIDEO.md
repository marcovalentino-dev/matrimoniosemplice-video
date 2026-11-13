# Guida completa: video per MatrimonioSemplice con Claude Code

Nov 12, 2026 · @Marco

## Come usare questa guida

Hai Claude Code aperto nella chat CLI di VS Code. Ogni riquadro di codice qui sotto è **un messaggio da incollare in chat**, nell'ordine. Claude esegue i comandi, ti mostra il risultato e si ferma dove serve il tuo sì. Non scrivi comandi a mano.

Cosa fai tu, e solo questo:

1. Apri in VS Code una cartella nuova e vuota e avvia `claude` (passo iniziale qui sotto).
2. Approvi i permessi quando Claude chiede di eseguire un comando.
3. Fai il login a GitHub quando richiesto, scrivendo in chat `! gh auth login` (il `!` esegue il comando nel terminale della sessione).
4. Copi i 3 file del brand nella cartella `brand/` (trascinandoli nell'Esplora file di VS Code).
5. Approvi gli storyboard prima che Claude scriva codice.

Tre abitudini che evitano problemi:

- Usa `/clear` quando cambi fase: la memoria utile sta in `CLAUDE.md` e nei file del progetto, non nella chat.
- Per i prompt di progettazione (fase 7, M0) attiva la modalità piano con `Maiusc+Tab`: Claude propone senza modificare file.
- Dopo ogni fase incolla il prompt **“Salva su Git”** (fase 2).

### Quale repository per quale video

| Obiettivo | Repository | Uso |
| --- | --- | --- |
| Spot emozionale 15–45 s | Lemo-Opuscar | Plugin con 59 stili e storyboard guidato |
| Promo prodotto 10 s, ad | MG Styles 15 | 15 esempi con prompt e harness di render |
| Cartoon con coppia o mascotte | ClaudeAnimationBase | Starter p5.js con 31 emozioni |
| Testo a tempo di musica | pdoom-video, PDoomVideo | Solo da studiare, serve audio con licenza |
| Idee e prompt | Awesome Opus 5.5, Awesome Claude 5.5, Opus Video Prompts | Solo raccolte, non producono video |

Claude Code non è un modello text-to-video: scrive ed esegue il codice che renderizza i frame, poi FFmpeg li unisce in MP4. Link e conteggi vengono dal tuo documento (verificato al 25 ottobre 2026): Claude li ricontrolla leggendo i README quando serve. Il codice è gratis, Claude e il rendering no.

### Passo iniziale (manuale, 1 minuto)

In VS Code: *File → Apri cartella…*, crea `matrimoniosemplice-video` in una posizione neutra (per esempio `Documenti/progetti/`), **fuori** da qualsiasi altro progetto e non copiata da una cartella esistente. Apri il terminale integrato, scrivi `claude` e invio.

## Fase 0 — Controllo e installazione dei tool

Incolla:

```text
Siamo in una cartella nuova per il progetto "matrimoniosemplice-video".
Non creare ancora file. Rileva il mio sistema operativo e verifica
presenza e versione di: git, node (serve 22.12 o superiore), python3
(3.11 o superiore), ffmpeg, ffprobe, gh (GitHub CLI), Google Chrome.
Mostrami una tabella: strumento | versione trovata | stato.
Per ciò che manca o è troppo vecchio, proponimi il comando di
installazione col gestore pacchetti giusto (brew su macOS, winget su
Windows, apt su Linux) e aspetta il mio sì prima di eseguirlo.
Se un passaggio richiede amministratore, riavvio del terminale o un
download manuale, dimmelo e fermati. Non toccare nulla fuori da questa cartella.
```

Se Claude ti dice di riavviare il terminale dopo un'installazione: scrivi `/exit`, riapri il terminale, lancia `claude --continue` e incolla: *“Ripeti la verifica dei tool”*. Vai avanti solo quando la tabella è tutta verde.

## Fase 1 — Struttura della cartella e regole permanenti

Prompt 1.1 — crea la struttura:

```text
Crea in questa cartella la struttura del progetto video:
  brand/  briefs/  engine/  out/  assets/audio/  assets/fonts/
  assets/logo/  _refs/  .claude/skills/
e i file: README.md, .gitignore, CLAUDE.md.

.gitignore deve escludere: node_modules/, out/, _refs/, .env, .env.*,
*.mp4, *.mov, .DS_Store, .cache/, __pycache__/, .venv/.

CLAUDE.md deve contenere queste regole, scritte in modo chiaro:
- Scopo: video promozionali e di prodotto per MatrimonioSemplice, SaaS
  verticale per coppie italiane (sito matrimonio, RSVP senza account per
  gli invitati, fondo regalo senza commissioni, planning, tavoli).
- Lingua di video e testi a schermo: italiano.
- Leggi sempre brand/03_DESIGN_SYSTEM.md e brand/tokens.json prima di
  creare scene.
- Non inventare funzionalità, prezzi, numeri o recensioni. Fonti: i file in brand/.
- Mai testimonianze inventate presentate come vere.
- Mai nero puro #000000, usa #1E1E1E. Massimo 2 font per composizione.
- Solo musica, font e immagini con licenza chiara.
- Prima di scrivere codice: storyboard con timecode e mia approvazione.
- Prima dell'export: anteprima, contact sheet, auto-revisione.
- Non dichiarare un video finito se l'MP4 non esiste e ffprobe non
  conferma durata, risoluzione e fps.
- Non committare MP4, .env, node_modules, _refs/.

README.md: titolo, scopo e struttura delle cartelle in poche righe.
Alla fine mostrami l'albero delle cartelle e dimmi di copiare in brand/
i file 01_STRUTTURA_PROGETTO.md, 02_TIPO_DI_PROGETTO.md,
03_DESIGN_SYSTEM.md e la guida originale come GUIDA_VIDEO.md. Aspetta.
```

Ora trascina i 4 file in `brand/` dall'Esplora file di VS Code. Poi incolla il prompt 1.2:

```text
Ho copiato i file. Verifica che in brand/ ci siano i 4 file, leggili per
intero e riassumimi in 10 righe: cos'è il prodotto, a chi si rivolge,
le funzionalità dichiarate, palette e font del brand. Segnala ogni
incoerenza che trovi tra i file (per esempio prezzi o feature).
```

## Fase 2 — Nuova repo Git, staccata da quella precedente

Obiettivo: la cartella punta **solo** a una repo nuova, senza collegamenti né cronologia dell'altro progetto. I prompt vanno in ordine e quello che cancella chiede conferma.

Prompt 2.1 — diagnosi, solo lettura:

```text
Diagnosi Git. SOLO LETTURA: non modificare nulla.
Esegui: git rev-parse --show-toplevel, git remote -v, git log --oneline -5,
git branch -a, git config --show-origin user.email, gh auth status.
Dimmi chiaramente:
(a) se questa cartella è dentro una repo di una cartella superiore;
(b) se ha già un .git proprio e a quale remote punta;
(c) quale account GitHub è attivo in gh.
Poi proponi il piano per ottenere una repo nuova e pulita, senza eseguirlo.
```

Cosa fare in base alla risposta:

| Risposta di Claude | Azione |
| --- | --- |
| Nessuna repo | Vai al prompt 2.3 |
| Questa cartella ha un `.git` collegato al vecchio progetto | Prompt 2.2 |
| La cartella è dentro una repo superiore | Sposta la cartella fuori da quella repo con Esplora file, riapri VS Code su quella nuova, poi riparti dalla fase 0 |
| Account `gh` sbagliato | Scrivi in chat `! gh auth switch` oppure `! gh auth login` |

Prompt 2.2 — stacca la vecchia repo (Strada A, consigliata: cronologia azzerata):

```text
Procedi a staccare la repo ereditata. Prima mostrami esattamente cosa
cancelleresti (il percorso del .git e il remote che contiene) e aspetta
il mio "sì, cancella". Cancella solo il .git di QUESTA cartella, mai
quello di una cartella superiore. Poi: git init -b main, e chiedimi
nome ed email da usare per i commit: impostali solo per questa repo,
senza --global. Verifica che git remote -v sia vuoto.
```

Variante B, solo se vuoi tenere la cronologia vecchia:

```text
Non cancellare .git. Rimuovi solo il remote origin ereditato con
git remote remove origin, poi mostrami git remote -v e git log --oneline -5.
```

Se il Git ti propone l'account GitHub sbagliato su Windows, apri *Gestione credenziali → Credenziali Windows* e rimuovi le voci `git:https://github.com`.

Prompt 2.3 — login GitHub (una tantum):

```text
! gh auth login
```

Segui le domande sul terminale: GitHub.com, HTTPS, login via browser. Poi in chat: *“Controlla gh auth status e dimmi l'account attivo”*.

Prompt 2.4 — crea la repo su GitHub e collega:

```text
Fai il primo commit con README.md, .gitignore, CLAUDE.md e brand/
(messaggio: "chore: struttura iniziale progetto video"). Poi chiedimi
conferma di nome (proposta: matrimoniosemplice-video), visibilità
(proposta: privata) e account. Dopo il mio sì crea la repo con
gh repo create ... --source=. --remote=origin --push. Verifica che
git remote -v mostri solo il nuovo URL, che git status sia pulito e
stampami l'URL della repo.
```

Apri l'URL nel browser: deve contenere solo i file di questo progetto. Tienila privata.

Prompt “Salva su Git” — da usare a fine di ogni fase:

```text
Mostra git status. Controlla che non ci siano .env, MP4, node_modules,
_refs. Se tutto è a posto crea un commit con un messaggio breve e chiaro
in italiano e fai push. Dimmi l'hash del commit.
```

## Fase 3 — Plugin, repository di riferimento e dipendenze

Prompt 3.1 — plugin Lemo-Opuscar:

```text
Installa il plugin lemo-opuscar. Esegui:
claude plugin marketplace add lemomo-ai/lemo-opuscar
claude plugin install lemo-opuscar@lemolab
Se un comando non funziona, leggi il README di github.com/lemomo-ai/lemo-opuscar
e usa quelli aggiornati. Poi dimmi se devo riavviare la sessione e come
controllare che il plugin sia attivo.
```

Se serve riavviare: `/exit`, poi `claude --continue`, poi `/plugin` per vedere che sia attivo.

Prompt 3.2 — clona i repository di riferimento:

```text
In _refs/ clona questi repository (solo per studio, restano fuori da Git):
- Vincentwei1021/mg-styles-15
- JohnHeibel/ClaudeAnimationBase
- joeseesun/opus-video-prompts
- yihui-dev/awesome-opus5-5-videos
Per ciascuno leggi README e LICENSE e riassumimi in 3 righe: cosa fa,
requisiti (versioni di Node, Python, Blender, Chrome), licenza del codice
e avvertenze su musica, font o immagini di esempio. Non installare ancora
nulla.
```

Prompt 3.3 — dipendenze del repo che userai:

```text
Installa le dipendenze di _refs/mg-styles-15 seguendo il suo README
(npm install e requirements.txt). Se pip rifiuta l'installazione, usa un
ambiente virtuale .venv. Poi esegui la demo documentata
01-flat-vector, verifica che produca un MP4 e mostrami l'output di ffprobe.
Se qualcosa fallisce, spiegami la causa e proponi la correzione.
```

Poi incolla il prompt “Salva su Git”.

## Fase 4 — Brand kit dal design system

Prima di qualsiasi video trasforma il design system in dati che il codice può leggere. Così ogni scena usa gli stessi colori e font, senza deriva.

Riepilogo dei valori chiave (dal tuo `03_DESIGN_SYSTEM`):

| Ruolo | Valore |
| --- | --- |
| Sfondo primario (cream) | `#FFF8F5` |
| Sfondo alternato (parchment) | `#F3ECE8` |
| Accento (blush) | `#E8B4B8`, hover `#D8A7B1` |
| Dettaglio oro (champagne) | `#7A5C38` |
| Testo | `#1E1E1E` primario, `#4A4A4A` secondario |
| Bordi | `#EFEAE7` |
| Titoli | Playfair Display (anche corsivo) |
| Testo e UI | Inter 400/500/600 |
| Bottoni | pillola, sfondo blush, testo `#1E1E1E` |
| Card | bianche, raggio 20 px, bordo `#EFEAE7` |

### 4.1 Scarica i font in locale

Il render headless può non avere internet, quindi i font vanno salvati in locale. Incolla:

```text
Scarica in assets/fonts/ i font Playfair Display (400, 600, 700, normale
e corsivo) e Inter (400, 500, 600) da Google Fonts o dal repository
ufficiale google/fonts. Per ciascuno salva anche il file di licenza.
Elenca i file scaricati e confermami la licenza di ciascun font.
```

### 4.2 Prompt: crea il brand kit

Incolla in chat (crea anche la skill di brand, che porta i colori in ogni sessione):

```text
Leggi per intero brand/01_STRUTTURA_PROGETTO.md, brand/02_TIPO_DI_PROGETTO.md
e brand/03_DESIGN_SYSTEM.md.

Crea:
1. brand/tokens.json con colori, font, raggi, ombre, texture, gradienti
   (shimmer, cover hero, orbi ambientali), spaziature e regole d'uso.
2. brand/BRAND_VIDEO.md: traduzione del design system in regole per il
   video: palette per inquadratura, uso di Playfair/Inter, tipo di
   movimento (lento, morbido, mai aggressivo), transizioni ammesse
   (dissolvenza, scorrimento morbido), durata minima del testo a schermo
   (leggibile su mobile), safe area per 9:16 e 16:9, stile dei bottoni CTA.
3. brand/PRODOTTO_FATTI.md: elenco SOLO delle funzionalità e dei claim
   verificabili nei file letti (sito in pochi minuti, RSVP senza account
   per gli invitati, fondo regalo senza commissioni, planning, tavoli,
   export, note private, notifiche) con il file di origine.
   Segna i prezzi come DA VERIFICARE in content/commercial.ts.
4. brand/preview.html: pagina di prova con palette, tipografia, bottone
   primario e secondario, card ed eyebrow, usando i font in assets/fonts/.
5. .claude/skills/brand-matrimoniosemplice/SKILL.md, con frontmatter
   (name, description) e queste regole: leggi brand/03_DESIGN_SYSTEM.md
   e brand/tokens.json prima di ogni scena; sfondo cream #FFF8F5, titoli
   Playfair Display, testo Inter, accento blush #E8B4B8, champagne
   #7A5C38 solo come dettaglio; bottoni a pillola; molto spazio bianco;
   niente nero puro, niente font geometrici freddi, massimo 3 colori
   per inquadratura.

Non inventare nulla che non sia nei file. Dove manca un dato, scrivilo
in una lista "domande aperte" in fondo a BRAND_VIDEO.md.
```

### 4.3 Controllo

Apri `brand/preview.html` in Chrome (trascinala nel browser) e confrontala con il sito. Se un colore o un font è sbagliato, chiedi a Claude di correggerlo. Poi incolla il prompt “Salva su Git”.

I prezzi nel design system e nella guida (12 euro al mese, 79 euro una tantum) vanno riletti nel codice del sito (`content/commercial.ts`) prima di usarli in un video.

## Fase 5 — Primo video di test (30 secondi)

Il primo video serve a collaudare tutta la catena. Scegli un soggetto semplice e breve: **“Dal caos delle conferme all'RSVP in un tap”**, 30 s, 9:16, per Reel, TikTok e Shorts.

### 5.1 Storyboard di riferimento

| Shot | Tempo | Azione | Camera e suono |
| --- | --- | --- | --- |
| 1 | 0–5 s | Una chat generica (senza loghi reali) si riempie di messaggi sovrapposti: “ci sono”, “forse”, “non so” | Camera fissa con lieve zoom, notifiche sonore soft |
| 2 | 5–10 s | Un foglio di calcolo disordinato con menu, allergie e accompagnatori sparsi | Scorrimento lento, suono di tasti |
| 3 | 10–15 s | Svolta: sfondo cream, petali, appare il sito matrimonio su uno smartphone con nomi fittizi | Push-in morbido, entra la musica |
| 4 | 15–20 s | Un invitato conferma la presenza in tre tap, senza creare un account | Close-up sullo schermo, tap sincronizzati |
| 5 | 20–25 s | Nella dashboard degli sposi il contatore delle conferme sale e gli invitati si ordinano da soli | Camera che sale, musica in crescita |
| 6 | 25–30 s | Schermata finale: logo, “Crea il tuo sito matrimonio”, pulsante pillola blush | Inquadratura ferma, chiusura musicale pulita |

Coerenza: nomi, colori e telefono identici dallo shot 3 al 6. Tutti i testi a schermo in italiano.

### 5.2 Prompt per Lemo-Opuscar

Incolla in chat (sostituisci i campi tra parentesi quadre):

```text
Usa la skill brand-matrimoniosemplice e il plugin lemo-opuscar.
Leggi brand/BRAND_VIDEO.md, brand/tokens.json e brand/PRODOTTO_FATTI.md.

Crea un video di 30 secondi, 9:16, 1080x1920, 30 fps.
Titolo: DAL CAOS ALL'RSVP.
Storia: [incolla lo storyboard della tabella 5.1].
Stile: carta pregiata, luce calda del pomeriggio, movimenti lenti e
morbidi. Sfondo cream #FFF8F5, accento blush #E8B4B8, dettagli
champagne #7A5C38, titoli Playfair Display, testi Inter.
Nomi degli sposi nel mockup: Giulia e Marco (fittizi).
Testo finale: "Crea il tuo sito matrimonio" + [URL DEL SITO].
Niente loghi di app terze, niente recensioni inventate, niente prezzi.
Musica: solo tracce originali o con licenza che trovo in assets/audio/.

Procedura obbligatoria:
1. Prima di scrivere codice mostrami lo storyboard a 6 shot con timecode,
   movimenti di camera e note di continuità. Aspetta il mio OK.
2. Dopo l'OK implementa le scene, elenca le dipendenze usate e i comandi
   di anteprima e di render.
3. Renderizza prima un'anteprima a bassa risoluzione e un contact sheet.
4. Fai auto-revisione (identità grafica, testi, timing, tagli involontari),
   correggi, poi esporta out/dal-caos-allrsvp.mp4.
5. Verifica con ffprobe e riportami durata, risoluzione, fps e audio.
```

### 5.3 Approva e verifica

1. Leggi lo storyboard proposto. Controlla durate, testi, colori, coerenza dei personaggi e del telefono. Poi scrivi: *“OK, implementa e renderizza l'anteprima”*.
2. Guarda il contact sheet. Correggi **solo gli shot sbagliati** con una richiesta mirata, per esempio: *“Rifai solo lo shot 4: i tap devono essere 3 e il testo deve restare nella safe area”*.
3. Guarda il video intero, almeno una volta con audio e una senza.
4. Controlla il file:

```text
Esegui ffprobe su out/dal-caos-allrsvp.mp4 e dimmi durata, risoluzione,
fps, codec video e audio. Confrontali con il brief e segnala ogni
differenza. Se il file non esiste, dimmelo: non dichiararlo finito.
```

Deve risultare circa 30 s, 1080×1920, 30 fps, H.264, audio AAC.

### 5.4 Alternativa: promo di 10 secondi con MG Styles 15

Migliore per un annuncio rapido o un'intro. Incolla il prompt seguente: Claude usa le cartelle `prompts/` e `demos/` della repo clonata in `_refs/` e i comandi di render documentati nel suo README.

```text
Leggi il prompt dello stile scelto, il template condiviso, il README e
rubric.md della repo _refs/mg-styles-15. Leggi anche brand/BRAND_VIDEO.md.
Crea un video di 10 secondi per MatrimonioSemplice: sfondo cream,
dettagli blush e champagne, geometrie morbide, ritmo premium.
Messaggio: "Il tuo sito matrimonio, pronto in pochi minuti".
Nessun font, foto o musica senza licenza. Renderizza un'anteprima a
bassa risoluzione, valuta con rubric.md, rivedi due volte, poi esporta
l'MP4 in out/ e collega i file modificati all'entry point corretto
dell'harness.
```

Richiede Node 22.12+ e Chrome rilevabile dal renderer.

## Fase 6 — Libreria di prompt per video SaaS

Sette prompt pronti, uno per messaggio di vendita. Salvali in `briefs/` come file `.md`, sostituisci i campi `[TRA PARENTESI]` e incollali in Claude Code. Ognuno parte con la stessa intestazione.

### Intestazione comune (da anteporre a ogni prompt)

```text
Usa la skill brand-matrimoniosemplice. Leggi brand/BRAND_VIDEO.md,
brand/tokens.json e brand/PRODOTTO_FATTI.md. Lingua: italiano.
Mostrami lo storyboard con timecode e aspetta il mio OK prima di scrivere
codice. Poi: anteprima, contact sheet, auto-revisione, export MP4 in out/,
verifica con ffprobe. Non inventare funzionalità, prezzi o recensioni.
```

### Negativo comune (da aggiungere in fondo)

```text
No deriva del volto o dei colori tra gli shot, no testo non richiesto,
no loghi di terzi, no watermark, no tagli o zoom casuali, no elementi
che escono dalla safe area, no nero puro, no musica o font senza licenza.
```

### Prompt 1 — Hero per la landing (loop, 16:9, 15 s)

```text
Crea un video loop di 15 secondi, 1920x1080, 30 fps, senza audio, per la
hero della landing. Messaggio: "Il tuo matrimonio, in un unico posto".
Sequenza: un sito matrimonio che si compone a blocchi (cover, storia,
programma, RSVP) su sfondo cream, con orbi blush sfocati e petali
rari. Movimento lentissimo, ultimo fotogramma uguale al primo per
il loop. Nomi fittizi: [NOME 1] e [NOME 2].
```

### Prompt 2 — RSVP senza account (9:16, 20 s)

```text
Crea un video di 20 secondi, 1080x1920, 30 fps. Messaggio: "I tuoi
invitati confermano in un tap, senza account". Sequenza: invito
condiviso → invitato apre il sito → compila il modulo RSVP (presenza,
accompagnatori, menu, allergie) → conferma → la dashboard degli sposi
aggiorna lo stato dell'invitato. Ricrea le interfacce in codice con i
token del brand: nessuno screenshot reale con dati personali.
Chiusura: CTA "Prova gratis" + [URL].
```

### Prompt 3 — Fondo regalo senza commissioni (9:16, 15 s)

```text
Crea un video di 15 secondi, 1080x1920. Messaggio: "Lista nozze senza
commissioni: gli invitati ti aiutano con un bonifico diretto".
Sequenza: salvadanaio elegante → sezione fondo regalo nel sito → IBAN
e copia in un tap → messaggio di ringraziamento. Non mostrare cifre
reali né IBAN reali: usa segnaposto grafici. Tono caldo, non finanziario.
```

### Prompt 4 — Tavoli e planning (16:9, 20 s)

```text
Crea un video di 20 secondi, 1920x1080. Messaggio: "Dal caos al piano
tavoli, in un posto solo". Sequenza: checklist che si spunta → budget
con barre che si riempiono → piantina sala con tavoli trascinati
(drag and drop) → timeline del giorno. Ricrea l'interfaccia in codice.
Marca la funzione come Premium solo se confermato in
brand/PRODOTTO_FATTI.md.
```

### Prompt 5 — Ad di prezzo (9:16, 10 s)

```text
Crea un video di 10 secondi, 1080x1920, stile MG Styles 15. Messaggio:
"Piano gratuito per iniziare, Premium quando serve". Mostra solo i
prezzi presenti in content/commercial.ts: leggili dal file e riportali
esattamente. Se il file non è disponibile, lascia un segnaposto [PREZZO]
e segnalamelo. CTA a pillola blush.
```

### Prompt 6 — Mini cartoon degli sposi (9:16, 15 s)

```text
Usa la repo _refs/ClaudeAnimationBase e leggi ANIMATION_GUIDE.md.
Crea un cartoon di 15 secondi: [DUE PERSONAGGI ORIGINALI] organizzano il
matrimonio con un telefono; un pacco di messaggi diventa un sito ordinato.
Crea prima una model sheet (fronte, profilo, primo piano) e le
espressioni; blocca sagoma e colori. Brush morbido con palette brand.
Nessun personaggio protetto da copyright.
```

### Prompt 7 — Video educativo per blog e SEO (9:16, 30 s)

```text
Crea un video di 30 secondi con testo animato. Tema: [TITOLO ARTICOLO DEL BLOG,
per esempio "5 errori da evitare con la lista invitati"]. Struttura:
gancio (3 s), 5 punti da 4 s, CTA (7 s). Titoli Playfair Display,
corpo Inter, transizioni a dissolvenza. Ogni punto deve avere un'icona
semplice disegnata in codice. Non citare dati o statistiche che non
siano nel brief.
```

### Regole sui contenuti

- Non produrre testimonianze o recensioni inventate presentate come vere. Se servono, usa solo feedback reali con il permesso di chi li ha scritti.
- Nomi, foto e dati degli sposi nei mockup devono essere fittizi.
- Prima di pubblicare, ricontrolla prezzi e funzioni con il prodotto reale.

## Fase 7 — Motore autonomo: da un prompt a un video

L'obiettivo: scrivere `npm run make -- "video di 20 secondi sul fondo regalo"` e ottenere un MP4 verificato in `out/`, senza guidare ogni passo. Il motore non sostituisce le repo della guida: le usa come riferimento di stile e riusa le stesse regole di brand e di qualità.

### 7.1 Architettura

| Stadio | Cosa fa | Output |
| --- | --- | --- |
| 1. Brief | Trasforma il tuo prompt in un brief strutturato (obiettivo, formato, durata, messaggio, CTA) | `brief.json` |
| 2. Regista | Scrive lo storyboard con timecode usando solo scene della libreria | `storyboard.json` (validato da schema) |
| 3. Scene | Componenti React/TS con i token del brand: titolo, card funzione, mockup RSVP, fondo regalo, tavoli, end card | `engine/scenes/` |
| 4. Render | Disegna i frame e li codifica | `out/<slug>/video.mp4` |
| 5. Audio | Mixa musica con licenza da `assets/audio/` | traccia nel MP4 |
| 6. QA | Contact sheet, controlli ffprobe, revisione automatica, fino a 3 giri di correzione | `qa-report.json` |
| 7. Consegna | Nomina i file, scrive un manifest con durata, costi e licenze | `manifest.json` |

**Scelta del renderer (mia raccomandazione, non dalla tua guida):** Remotion, perché usa React e TypeScript come il tuo sito Next.js e ha anteprima e render da riga di comando. In alternativa, l'harness HTML + Chrome + FFmpeg di MG Styles 15. Prima di un uso commerciale verifica la licenza di Remotion sul sito ufficiale: dipende dalle dimensioni dell'azienda.

**Autonomia e sicurezza:** il motore chiama Claude in modalità non interattiva (`claude -p`) o tramite Claude Agent SDK. Limita gli strumenti consentiti e non usare `--dangerously-skip-permissions` fuori da un container isolato. Imposta sempre un tetto ai giri di revisione e ai costi.

### 7.2 Come usare i prompt

Esegui i prompt **uno alla volta**, nell'ordine, in `claude` aperto nella cartella del progetto. Dopo ciascuno: controlla il risultato, fai `git commit`, poi passa al successivo. Se un passo fallisce, chiedi la correzione prima di andare avanti.

### Prompt M0 — Specifica (solo piano, nessun codice)

```text
Leggi CLAUDE.md, brand/ e _refs/ (README di mg-styles-15, ClaudeAnimationBase,
opus-video-prompts). Non scrivere ancora codice.
Progetta un motore autonomo "video studio": dato un prompt in italiano
produce un MP4 verificato per MatrimonioSemplice.
Scrivi engine/SPEC.md con: obiettivi, architettura a stadi (brief, regista,
scene, render, audio, QA, consegna), struttura cartelle, schema JSON di
brief e storyboard, libreria di scene, formato dei file di output, gestione
errori, limiti di costo e di tempo, rischi. Confronta Remotion e l'harness
HTML+Chrome+FFmpeg di mg-styles-15 e raccomanda uno dei due con motivazioni.
Chiudi con una lista di domande aperte. Aspetta le mie risposte.
```

### Prompt M1 — Scaffold del progetto

```text
Secondo engine/SPEC.md approvato, crea lo scaffold in engine/:
package.json, tsconfig, struttura cartelle (cli, director, scenes, render,
audio, qa, schemas, utils), script npm: make, preview, render, qa, test.
Installa solo le dipendenze necessarie (TypeScript, zod, il renderer scelto,
vitest). Aggiungi engine/README.md con i comandi. Verifica che
npm run preview parta e che npm test passi. Non inventare script: eseguili.
```

### Prompt M2 — Brand come codice

```text
Leggi brand/tokens.json e assets/fonts/. Crea engine/theme con colori,
font (caricati dai file locali), raggi, ombre, gradienti, orbi, texture e
safe area per 9:16 e 16:9. Crea un componente di prova che mostri tutto e
renderizza una sola immagine out/_test/brand.png. Controlla che i colori
corrispondano a tokens.json e che non compaia #000000.
```

### Prompt M3 — Libreria di scene

```text
Crea in engine/scenes componenti riusabili, parametrici e animati con i
token del brand, ciascuno con props tipizzate e una scheda in
engine/scenes/CATALOGO.md (nome, props, durata minima/consigliata):
TitleCard, HookText, ChatChaos, SpreadsheetChaos, PhoneMockupSite,
RsvpFlow, GuestDashboard, GiftFundCard, TableSeating, PlanningChecklist,
PriceCard (legge content/commercial.ts se disponibile), KineticList,
EndCard (logo + CTA a pillola). Interfacce ricreate in codice, nessun
screenshot. Per ogni scena renderizza un fotogramma di prova in
out/_test/ e mostrami il contact sheet.
```

### Prompt M4 — Brief e regista

```text
Crea il modulo "regista": engine/director. Input: prompt libero in
italiano. Passi: (1) chiama Claude in modalità non interattiva
(claude -p con output JSON, strumenti limitati alla sola lettura) con
brand/PRODOTTO_FATTI.md e il catalogo scene; (2) produce brief.json;
(3) produce storyboard.json con shot, timecode, scena, props, testo a
schermo, musica, note di camera. Valida entrambi con zod e rifai la
chiamata fino a 2 volte se non validi. Regole: usa solo scene del
catalogo, solo funzioni presenti in PRODOTTO_FATTI.md, nessun prezzo non
letto da file, somma durate uguale alla durata richiesta. Aggiungi test
vitest con 3 prompt di esempio e salva gli output in out/_test/.
```

### Prompt M5 — Render e audio

```text
Crea engine/render: da storyboard.json costruisce la composizione,
renderizza anteprima (bassa risoluzione) e finale, poi mixa l'audio con
FFmpeg: musica scelta da assets/audio/ in base ai tag in
assets/audio/index.json (titolo, durata, licenza, fonte), con fade in/out e
normalizzazione del volume. Se non ci sono tracce con licenza registrata
nel file indice, esporta senza audio e segnalalo nel manifest.
Output: H.264 + AAC, 1080x1920 o 1920x1080, 30 fps. Mostrami i comandi
usati e prova con un video di 10 secondi.
```

### Prompt M6 — Controllo qualità automatico

```text
Crea engine/qa. Dopo il render: (1) ffprobe: durata, risoluzione, fps,
codec, presenza audio, confronto con brief.json; (2) estrai fotogrammi
ogni secondo e crea contact sheet; (3) chiedi a Claude (claude -p, con le
immagini) di valutare con una rubrica: testo leggibile e dentro la safe
area, colori brand, nessun nero puro, coerenza tra shot, nessun elemento
tagliato, ritmo, claim corretti rispetto a PRODOTTO_FATTI.md; (4) scrivi
qa-report.json con punteggio e problemi per shot; (5) se ci sono problemi
gravi, rigenera solo gli shot indicati e rifai il QA, massimo 3 giri;
(6) se resta qualcosa di grave, esci con errore e spiega cosa non va.
Non dichiarare successo senza file e report.
```

### Prompt M7 — Comando unico e batch

```text
Crea il comando: npm run make -- "<prompt>" [--format 9:16|16:9]
[--duration 20] [--preview] [--max-cost <numero>] [--max-rounds 3].
Flusso: brief → storyboard → (se --preview, fermati e mostra il piano)
→ render → audio → QA → consegna in out/<slug>/ con video.mp4,
storyboard.json, qa-report.json, manifest.json (durata, comandi, versioni,
tracce e licenze usate, tempo e costo stimato). Aggiungi
npm run batch -- briefs/ per elaborare tutti i file .md in coda, con log e
ripresa dopo errore. Errori chiari in italiano. Aggiorna engine/README.md.
```

### Prompt M8 — Skill per usarlo da Claude Code

```text
Crea due skill di progetto: .claude/skills/make-video/SKILL.md (quando
l'utente chiede un video: legge brand e fatti, esegue npm run make con i
parametri giusti, mostra storyboard in anteprima, riporta percorso e
controllo ffprobe) e .claude/skills/qa-video/SKILL.md (controlla un MP4
esistente con il modulo qa e riassume i problemi). Frontmatter con name e
description chiari. Poi prova entrambe con il prompt: "video di 15 secondi
per il fondo regalo, 9:16" e mostrami il risultato.
```

### Prompt M9 — Test, documentazione, repo

```text
Esegui tutti i test. Crea 3 video di prova (RSVP 20 s 9:16, tavoli 20 s
16:9, prezzo 10 s 9:16) con npm run make. Per ciascuno riporta ffprobe e
qa-report. Correggi i difetti. Poi aggiorna README.md e engine/README.md
con: installazione da zero, comandi, come aggiungere una scena, come
aggiungere musica con licenza, problemi noti. Controlla con git status
che non ci siano MP4, .env o node_modules, poi fai commit e push.
```

### 7.3 Come lo userai ogni giorno

```bash
npm run make -- "video di 20 secondi sull'RSVP senza account per i miei invitati" --format 9:16 --preview
```

Con `--preview` il motore ti mostra lo storyboard e si ferma. Se ti piace, rilancia senza `--preview`. In Claude Code basta scrivere “fammi un video di 15 secondi sul fondo regalo”: la skill `make-video` fa il resto.

I controlli di qualità sono parte del motore, ma restano controlli automatici. Guarda sempre il video intero prima di pubblicarlo.

## Fase 8 — Qualità, diritti e problemi comuni

### Regola d'oro

Non saltare mai il giro anteprima → revisione. I video generati da codice richiedono quasi sempre più iterazioni per avere un ritmo cinematografico e personaggi coerenti.

### Checklist prima di pubblicare

- [ ] Messaggio e arco emotivo chiari nei primi 3 secondi
- [ ] Durata uguale allo storyboard
- [ ] Colori e font uguali al brand (niente `#000000`)
- [ ] Testi in italiano, leggibili su mobile e dentro la safe area
- [ ] Funzioni e prezzi mostrati coincidono con il prodotto reale
- [ ] Nessuna recensione o dato inventato presentato come vero
- [ ] Camera e transizioni fluide, nessun taglio o morphing involontario
- [ ] Musica, font, immagini con licenza verificata e registrata
- [ ] MP4 verificato con ffprobe: codec, dimensioni, fps, audio
- [ ] Visto per intero, una volta con audio e una senza

Formati consigliati: social verticale 1080×1920, 9:16, 30 fps, H.264, audio AAC. Orizzontale 1920×1080, 16:9, 24 o 30 fps.

### Diritti e licenze

- Gratis da leggere non significa gratis da usare: la licenza del codice non copre musica demo, font o immagini incluse nelle repo.
- Le repo pdoom-video e PDoomVideo sono progetti da studiare: usa solo audio, testi e grafica di cui hai i diritti, e tieni la demo originale separata dal tuo lavoro commerciale.
- Le raccolte di prompt (Awesome Opus 5.5, Awesome Claude 5.5, Opus Video Prompts) contengono voci parziali: non tutto è riproducibile.
- Registra ogni traccia audio in `assets/audio/index.json` con titolo, fonte, licenza e data.
- Rileggi sempre README e LICENSE di ogni repo prima della pubblicazione.

### Problemi comuni

| Sintomo | Causa probabile | Soluzione |
| --- | --- | --- |
| `command not found` per node, ffmpeg o claude | Terminale aperto prima dell'installazione, o PATH non aggiornato | Chiudi e riapri VS Code; rilancia le verifiche della fase 0 |
| Il render dice che non trova Chrome | Chrome non rilevabile dal renderer | Installa Chrome o indica il percorso nelle impostazioni della repo (vedi README) |
| Errore di versione Node | Node troppo vecchio | Aggiorna a 22.12+ |
| `pip` rifiuta l'installazione | Ambiente Python gestito dal sistema | Usa `python3 -m venv .venv` oppure `--break-system-packages` |
| `git push` va sull'account o sulla repo sbagliata | Credenziali o `origin` ereditati | `git remote -v`, poi `git remote set-url origin NUOVO-URL`; `gh auth switch` |
| `git push` rifiutato (rejected) | La repo remota non è vuota | Crea la repo senza README, oppure `git pull --rebase origin main` e riprova |
| Render molto lento | Effetti acquerello senza GPU | Chiedi a Claude uno stile pennello più semplice o una risoluzione minore per l'anteprima |
| Personaggio che cambia aspetto tra shot | Nessuna model sheet bloccata | Crea la model sheet, blocca sagoma e colori, rifai gli shot interessati |
| Claude dice “fatto” ma manca l'MP4 | Render non eseguito | Chiedi di eseguire il comando e mostrare ffprobe; la regola è già nel `CLAUDE.md` |
| Costi troppo alti | Troppi giri di revisione o risoluzione piena | Usa `--preview`, limita `--max-rounds`, renderizza prima a bassa risoluzione |

### Ordine di lavoro consigliato per i prossimi giorni

1. Fasi 0–4 in una sessione (circa 1–2 ore, la maggior parte è installazione).
2. Fase 5: il primo video di 30 secondi, per collaudare la catena.
3. Fase 6: tre video della libreria (RSVP, fondo regalo, tavoli).
4. Fase 7: costruisci il motore un prompt alla volta, con commit a ogni passo.
