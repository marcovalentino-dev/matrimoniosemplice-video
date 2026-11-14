# PRODOTTO_FATTI — funzionalità e claim verificabili

Solo ciò che è scritto nei file di `brand/`. Se un claim non è qui, **non va nel video**.
Sigle fonte: **S** = `01_STRUTTURA_PROGETTO.md`, **T** = `02_TIPO_DI_PROGETTO.md`, **D** = `03_DESIGN_SYSTEM.md`, **CLAUDE** = `CLAUDE.md`.

## Promesse di valore (esplicite)

| Claim | Fonte |
|---|---|
| Sito matrimonio pronto in pochi minuti | T, "Value proposition esplicita" n.1 |
| Conferme di presenza semplici, senza account per gli invitati | T, "Value proposition esplicita" n.2 |
| Lista nozze / fondo regalo senza commissioni | T, "Value proposition esplicita" n.3; CLAUDE (Scopo) |
| Organizzazione del matrimonio in un unico posto | T, "Value proposition esplicita" n.4 |
| Pensato per coppie italiane (matrimonio civile o religioso in Italia) | T, "Segmento specifico" |

## Funzionalità

| Funzione | Cosa è verificabile | Piano | Fonte |
|---|---|---|---|
| Sito matrimonio pubblico | Pagina pubblica per gli invitati con storia della coppia, conferma presenza, contenuti evento, lista nozze/fondo regalo; componenti Countdown, Fondo regalo, Viaggio nozze, Gallery, Storia, Video intro | Gratuito (sito); personalizzazioni avanzate Premium | S §5; T "Piano gratuito/premium" |
| Creazione in pochi minuti | Setup iniziale leggero: nomi, data, luogo, cover, messaggio; generazione automatica dello slug pubblico | — | S §2; T "target primario" |
| RSVP senza account | L'invitato apre il sito e compila il modulo RSVP; nessun account richiesto | Gratuito | S "Flusso RSVP"; T value prop n.2 e "Piano gratuito" |
| Raccolta e gestione invitati | Caricamento manuale, bulk o CSV; abbinamento ospite–RSVP (fuzzy match); inserimento automatico di nominativi fuori lista; stati, accompagnatori, bambini, menu, allergie, note | — (limiti più alti con Premium) | S §4; T "problemi risolti" n.3 |
| Fondo regalo / lista nozze | Soluzione senza commissioni, con bonifico diretto; IBAN | Lista nozze/IBAN nel piano gratuito (T); pagina `/dashboard/fondo-regalo` (S) | T problema n.4 e "Piano gratuito"; S routing |
| Condivisione link | Il sito si condivide con un link | Gratuito | S "Flusso utente"; T "Piano gratuito" |
| Planning | Checklist, budget, fornitori, timeline | Premium (`/pianificazione`) | S §7 e "Pianificazione premium"; T "Piano premium" |
| Piano tavoli | Piano tavoli interattivo, drag and drop, elementi piantina sala | Premium (`/pianificazione/tavoli`) | S §7 e §Moduli; T "Piano premium" |
| Export | Export CSV della lista invitati | Premium | S §4 |
| Note private | Note private sugli invitati | Premium | S §4 |
| Notifiche | Email di notifica all'arrivo di un RSVP, "se premium e configurato" | Premium | S "Flusso RSVP" |
| Personalizzazione grafica | Temi, font, animazioni, divisori, texture; cover e posizionamento immagine; sezioni attivabili e ordinabili; contenuti per storia, gallery, FAQ, programma, video, mappe | Premium (personalizzazione avanzata) | S §6; T "Piano premium" |
| Temi colore | Rosa Romantico, Avorio Classico, Verde Salvia, Blu Sera, Terra Bruciata | — | D "Temi colore" |

## Prezzi

| Voce | Valore trovato nei file | Stato |
|---|---|---|
| Abbonamento mensile | EUR 12/mese (T "Modalità di pricing rilevate") | **CONFERMATO dall'utente il 2026-11-13**; valori in `brand/prezzi.json` |
| Una tantum | EUR 79 (T "Modalità di pricing rilevate") | **CONFERMATO dall'utente il 2026-11-13**; valori in `brand/prezzi.json` |

I prezzi si mostrano solo se letti da `brand/prezzi.json` (EUR 12/mese, EUR 79 una tantum, confermati dall'utente il 2026-11-13). `content/commercial.ts` non è in questo repository: se il sito cambia i prezzi, aggiornare `prezzi.json` a mano. Non dire cosa includa ciascun piano: nei file non c'è.

## Non verificabile / da non dire

- Numeri di utenti, coppie, matrimoni, risparmi, percentuali di tempo risparmiato: **assenti** nei file.
- Recensioni, testimonianze, premi: **assenti**. Mai inventarli (CLAUDE).
- Integrazioni, app mobile, numero di temi oltre ai 5 elencati, limiti numerici del piano gratuito: **assenti**.
- "Senza commissioni" riguarda il fondo regalo/lista nozze con bonifico diretto; non estenderlo ad altro (es. Stripe per l'abbonamento è un costo separato, S §8).
- Stack tecnico (Next.js, Supabase, Stripe): dato interno, non è un claim per il pubblico.

## Incoerenze tra i file da tenere presenti

- `03_DESIGN_SYSTEM.md` ha come titolo interno "08_DESIGN_SYSTEM": solo un'etichetta, i valori sono coerenti con `tokens.json`.
- Il fondo regalo compare nel piano gratuito come "lista nozze / IBAN" (T); non è detto nei file se funzioni di fondo regalo più avanzate siano Premium. Nei video: dire solo "lista nozze senza commissioni, con bonifico diretto".
