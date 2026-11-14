# CLAUDE.md — matrimoniosemplice-video

## Scopo
Video promozionali e di prodotto per **MatrimonioSemplice**, SaaS verticale per coppie italiane: sito del matrimonio, RSVP senza account per gli invitati, fondo regalo senza commissioni, planning, tavoli.

## Lingua
Video e testi a schermo sono sempre in **italiano**.

## Prima di creare scene
- Leggi sempre `brand/03_DESIGN_SYSTEM.md` e `brand/tokens.json`.

## Contenuti
- Non inventare funzionalità, prezzi, numeri o recensioni. Le fonti sono i file in `brand/`.
- Mai testimonianze inventate presentate come vere.

## Design
- Mai nero puro `#000000`: usa `#1E1E1E`.
- Massimo 2 font per composizione.
- Solo musica, font e immagini con licenza chiara.

## Flusso di lavoro
1. Prima di scrivere codice: storyboard con timecode e approvazione esplicita dell'utente.
   Deroga dell'utente (2026-11-13): per i video generati dal motore `engine/` è ammessa l'auto-approvazione (`--auto-approve`), solo con lint dello storyboard pulito e senza segnaposto; vedi `engine/SPEC.md` §16. Resta valida la regola per lo sviluppo del motore e per i video fatti a mano.
2. Prima dell'export: anteprima, contact sheet, auto-revisione.
3. Non dichiarare un video finito se l'MP4 non esiste e `ffprobe` non conferma durata, risoluzione e fps.

## Git
Non committare MP4, `.env`, `node_modules`, `_refs/`.
