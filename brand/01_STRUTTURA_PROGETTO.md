# 01_STRUTTURA_PROGETTO

## Executive summary

Il progetto e' un SaaS verticale costruito per il mercato wedding italiano. L'architettura applicativa e' coerente con un prodotto web moderno: frontend e backend convivono in Next.js 14, autenticazione e database sono delegati a Supabase, i pagamenti a Stripe, mentre il modello di crescita e monetizzazione e' incorporato nella codebase tramite feature gating centralizzato.

Non e' un semplice "template website builder": il nucleo del valore e' la combinazione fra sito pubblico per gli invitati, dashboard privata per gli sposi, raccolta RSVP, gestione invitati, planning e strumenti premium ad alta utilita' operativa.

## Aggiornamento stato implementazione

Alla data attuale risultano gia' eseguiti alcuni interventi coerenti con le raccomandazioni strategiche:

- introdotto un layer commerciale condiviso in `content/commercial.ts` per centralizzare prezzi e feature summary commerciali
- riallineato il pricing tra landing, pricing page, dashboard upgrade, Open Graph e structured data SEO
- corretto il mismatch tra gating reale e feature gratuite mostrate in dashboard
- avviato il refactor di `components/GuestListManager.tsx` con estrazione del sottocomponente `components/guest-list/GuestListItem.tsx`

## Architettura del progetto

### Stack tecnologico

- Frontend: `Next.js 14` con App Router, `React 18`, `TypeScript`
- Styling: `Tailwind CSS`
- Backend applicativo: Route Handlers Next.js in `app/api`
- Database e auth: `Supabase`
- Storage media: bucket pubblico Supabase `wedding-photos`
- Pagamenti: `Stripe`
- Analytics: `@vercel/analytics`
- Utility UI specifiche:
  - `@dnd-kit/core` per drag and drop
  - `qrcode.react` per QR code

### Modello architetturale

L'applicazione e' organizzata in 4 livelli:

1. `app/`
   - routing, pagine pubbliche, dashboard, route API
2. `components/`
   - componenti UI e moduli funzionali
3. `lib/`
   - logica condivisa, helper, client Supabase, analytics, subscription logic
4. `supabase/`
   - schema SQL, migration incrementali, template email

### Rendering model

Il progetto usa prevalentemente Server Components per lettura dati e rendering iniziale, mentre affida ai Client Components le mutazioni e l'interazione avanzata:

- pagine dashboard e pubbliche: fetch lato server
- form, editor, drag and drop, upload: lato client
- aggiornamento stato: `router.refresh()` dopo le mutazioni

Questo approccio e' corretto per un SaaS content-heavy con molte personalizzazioni e stato utente autenticato.

## Struttura cartelle

### Root

- `app/`: pagine, layout e API
- `components/`: UI e blocchi funzionali
- `content/`: copy marketing, pricing, testi landing e sito wedding
- `features/`: configurazione centralizzata del gating premium
- `lib/`: helper business e integrazioni
- `supabase/`: schema, migration, seed, template email
- `types/`: modelli dominio TypeScript
- `docs/`: documentazione interna

### Routing applicativo

#### Pagine pubbliche

- `/`
- `/prezzi`
- `/chi-siamo`
- `/blog`
- `/privacy`
- `/termini`
- `/matrimonio/[slug]`

#### Autenticazione

- `/signup`
- `/signup/conferma`
- `/login`
- `/forgot-password`
- `/reset-password`

#### Onboarding e dashboard

- `/setup`
- `/dashboard`
- `/dashboard/modifica`
- `/dashboard/invitati`
- `/dashboard/aspetto`
- `/dashboard/sezioni`
- `/dashboard/fondo-regalo`
- `/dashboard/viaggio-nozze`
- `/dashboard/account`
- `/dashboard/upgrade`

#### Pianificazione premium

- `/pianificazione`
- `/pianificazione/timeline`
- `/pianificazione/tavoli`

#### API

- `/api/rsvp-notify`
- `/api/wedding-access`
- `/api/stripe/checkout`
- `/api/stripe/portal`
- `/api/stripe/webhook`
- `/api/delete-account`

## Moduli principali

### 1. Landing e acquisition layer

Gestito da:

- `app/page.tsx`
- `components/landing/*`
- `content/commercial.ts`
- `content/landing.ts`
- `content/pricing.ts`
- `app/blog/*`

Funzione:

- acquisizione organica
- conversione signup
- education del mercato
- differenziazione rispetto a tool esteri e wedding planner tradizionali

### 2. Onboarding e creazione matrimonio

Gestito da:

- `app/signup/page.tsx`
- `app/setup/page.tsx`

Funzione:

- creazione account
- creazione record `weddings`
- generazione slug pubblico
- primo set di dati essenziali: nomi, data, luogo, cover, messaggio

### 3. Dashboard operativa

Gestito da:

- `app/dashboard/*`
- `components/DashboardSidebar.tsx`
- `components/SiteStatusSummary.tsx`
- `components/FeatureSummary.tsx`
- `app/dashboard/upgrade/UpgradeClient.tsx`

Funzione:

- centro di controllo del prodotto
- monitoraggio stato sito
- accesso alle feature di editing, invitati, planning, monetizzazione

### 4. Gestione invitati e RSVP

Gestito da:

- `app/dashboard/invitati/page.tsx`
- `components/GuestListManager.tsx`
- `components/guest-list/GuestListItem.tsx`
- `components/guest-list/constants.ts`
- `components/RSVPForm.tsx`
- `components/RSVPTable.tsx`
- `app/api/rsvp-notify/route.ts`
- `lib/fuzzyMatch.ts`

Funzione:

- caricamento invitati manuale, bulk o CSV
- raccolta conferme dal sito pubblico
- matching ospite-RSVP
- inserimento automatico di nominativi fuori lista
- note private premium
- export CSV premium

### 5. Sito matrimonio pubblico

Gestito da:

- `app/matrimonio/[slug]/page.tsx`
- componenti `Countdown`, `FondoRegalo`, `ViaggioNozze`, `GalleryLayouts`, `StoriaLayouts`, `VideoIntro`

Funzione:

- esperienza pubblica degli invitati
- storytelling della coppia
- conferma presenza
- navigazione contenuti evento
- lista nozze/fondo regalo

### 6. Personalizzazione grafica e contenuti

Gestito da:

- `app/dashboard/modifica/page.tsx`
- `app/dashboard/aspetto/page.tsx`
- `app/dashboard/sezioni/SezioniClient.tsx`

Funzione:

- modifica dati base
- cover e posizionamento immagine
- temi, font, animazioni, divisori, texture, dettagli grafici
- attivazione/disattivazione e ordinamento sezioni
- contenuti per storia, gallery, FAQ, programma, video, mappe

### 7. Planning premium

Gestito da:

- `app/pianificazione/page.tsx`
- `app/pianificazione/timeline/*`
- `app/pianificazione/tavoli/*`

Funzione:

- checklist
- budget
- fornitori
- timeline
- piano tavoli interattivo
- elementi piantina sala

### 8. Monetizzazione e billing

Gestito da:

- `content/commercial.ts`
- `content/pricing.ts`
- `app/prezzi/page.tsx`
- `app/dashboard/upgrade/*`
- `app/api/stripe/*`
- `lib/subscription.ts`
- `features/config.ts`
- `lib/features.ts`

Funzione:

- monetizzazione freemium
- upgrade mensile o una tantum
- access control premium centralizzato

## Flusso applicativo

### Flusso utente principale

1. L'utente arriva da landing, blog o pricing
2. Si registra via `/signup`
3. Completa il setup iniziale su `/setup`
4. Ottiene un sito pubblico su `/matrimonio/[slug]`
5. Condivide il link con gli invitati
6. Gli invitati compilano il form RSVP
7. Gli sposi gestiscono dashboard, invitati e sito
8. In presenza di bisogno operativo avanzato, fanno upgrade a Premium
9. Usano planning, tavoli, personalizzazioni avanzate e strumenti di export/notifica

### Flusso RSVP

1. L'invitato apre il sito
2. Compila `RSVPForm`
3. I dati finiscono in `rsvps`
4. `rsvp-notify` aggiorna stato invitati con fuzzy match
5. Se premium e configurato, parte email notifica
6. La dashboard riflette il nuovo stato

### Flusso monetizzazione

1. L'utente gratuito incontra blocchi o limiti funzionali
2. La UI mostra lock, benefit e CTA di upgrade
3. `/api/stripe/checkout` crea sessione Stripe
4. `/api/stripe/webhook` aggiorna piano nel database
5. `hasFeatureAccess()` abilita immediatamente le funzionalita' premium

## Dipendenze logiche

### Dipendenze core

- `weddings` e' l'entita' centrale
- tutte le feature operative dipendono da `weddings.id`
- `features/config.ts` definisce il perimetro free vs premium
- `lib/features.ts` e `lib/subscription.ts` sono il centro di controllo del gating

### Dipendenze dati

- `weddings` -> `rsvps`
- `weddings` -> `guests`
- `weddings` -> `planning_tasks`
- `weddings` -> `budget_categorie`
- `weddings` -> `fornitori`
- `weddings` -> `tavoli`
- `tavoli` -> `posti`
- `weddings` -> `viaggio_esperienze`
- `weddings` -> contenuti JSON e media

### Dipendenze di business

- landing e pricing dipendono dal modello freemium
- dashboard dipende dallo stato wedding e dal piano
- sito pubblico dipende dalla completezza contenuti e toggles sezione
- upgrade dipende dalla coerenza tra copy, pricing e feature gating

## Osservazioni architetturali rilevanti

### Punti forti

- buona separazione fra contenuto marketing, UI e logica business
- feature gating centralizzato: scelta molto sana per un SaaS
- buon uso di Supabase per un prodotto early-stage/scale-up
- prodotto gia' strutturato per espandersi su nuove feature premium
- dopo gli ultimi interventi, maggiore coerenza tra pricing esposto, markup SEO e UI di upgrade
- dopo gli ultimi interventi, migliore separazione tra orchestrazione e rendering nella gestione invitati

### Debolezze emerse

- forte concentrazione di logica in componenti molto grandi, soprattutto:
  - `app/dashboard/sezioni/SezioniClient.tsx`
  - `app/pianificazione/tavoli/TavoliClient.tsx`
- `components/GuestListManager.tsx` resta un componente corposo, ma e' gia' iniziata una decomposizione concreta del rendering RSVP
- assenza di test automatici e script di quality assurance dedicati
- restano da consolidare test e analytics sui flussi revenue-critical

### Inferenze dichiarate

- Non ho trovato un backend separato o microservizi: il prodotto e' pensato come monolite applicativo web, scelta sensata per il momento.
- Non ho trovato infrastruttura enterprise, job queue o multi-tenant isolation avanzata oltre a Supabase + RLS: il target e' chiaramente SMB/consumer, non wedding planner enterprise.
