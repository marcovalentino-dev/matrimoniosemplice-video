# Dal caos all'RSVP — 30 s, 9:16, 1080x1920, 30 fps

Storyboard approvato dall'utente. Sorgente: `engine/dal-caos-allrsvp/` (timeline in `index.html`, audio in `mix.py`).

| Shot | Tempo | Contenuto |
|---|---|---|
| 1 | 0–5 s | Chat generica che si riempie di messaggi sovrapposti. Headline "Dal caos delle conferme…". Notifiche soft. |
| 2 | 5–10 s | Foglio di calcolo disordinato che scorre. "Menu, allergie, +1… ovunque." Suono di tasti. |
| 3 | 10–15 s | Cream, petali, telefono con il sito di Giulia & Marco (fittizi). Push-in. Entra la musica. |
| 4 | 15–20 s | Primo piano: tre tap (Conferma la presenza / Ci sarò / Invia conferma). "Pochi tap, nessun account." |
| 5 | 20–25 s | Dashboard: il contatore sale e gli invitati si ordinano da soli. |
| 6 | 25–30 s | End card: logo (`assets/logo/icon.svg`), "Dal caos all'RSVP.", bottone "Crea il tuo sito matrimonio", www.matrimoniosemplice.com. |

Dati nel mockup (nomi, date, luogo, conteggi) tutti fittizi.

## Build
- Anteprima 540x960 @15 fps: `sh engine/dal-caos-allrsvp/build.sh preview`
- Render completo: `sh engine/dal-caos-allrsvp/build.sh` → `out/dal-caos-allrsvp.mp4`
- Richiede la libreria Lemo-Opuscar in `~/lemo-opuscar` (`LIB=...` per cambiarla), con `setup.sh deps`.

## Crediti
- Playfair Display e Inter: OFL (`assets/fonts/*/OFL.txt`).
- Musica e effetti: sintetizzati in codice in `mix.py`, nessun campione di terzi.
- Logo: `assets/logo/icon.svg` del progetto.
- Strumenti di render e mux: libreria Lemo-Opuscar.
