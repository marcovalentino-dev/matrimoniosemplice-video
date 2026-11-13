# BRAND_VIDEO — il design system tradotto in regole per il video

Fonti: `03_DESIGN_SYSTEM.md` e `tokens.json`. Dove una regola è **[Proposta]** non viene dalle fonti: è una scelta di produzione necessaria per il video, da approvare (vedi "Domande aperte").

## 1. Tono visivo

Romantico italiano, elegante ma accessibile, caldo e luminoso: "una lettera scritta a mano su carta pregiata, sotto la luce del pomeriggio" (D). Non è freddo, tech, minimal scandinavo, dark luxury. Quindi: **niente inquadrature scure**, niente neon, niente effetti "tech".

## 2. Palette per inquadratura

Regola (D, skill): **massimo 3 colori per inquadratura**. **[Proposta]** conteggio: sfondo + testo + accento (le sfumature della stessa famiglia, es. cream/parchment, contano come uno).

| Tipo di inquadratura | Sfondo | Testo | Accento | Dettaglio |
|---|---|---|---|---|
| Titolo / gancio | cream `#FFF8F5` | ink `#1E1E1E` | blush `#E8B4B8` | champagne `#7A5C38` solo per l'eyebrow |
| Testo di supporto | cream | muted `#4A4A4A` | blush | — |
| Mockup interfaccia (telefono, dashboard) | cream o parchment `#F3ECE8` | ink | blush | card bianche `#FFFFFF` con bordo `#EFEAE7` |
| Sezione alternata | parchment | ink | rose `#D8A7B1` | — |
| Hero atmosferica | gradiente cover hero | ink | orbi ambientali | — |
| End card / CTA | cream | ink | blush (bottone) | champagne per una riga piccola |

Altri vincoli: mai `#000000` (usa `#1E1E1E`); blush **mai** come sfondo di testo piccolo; champagne e gold-light mai dominanti; testo terziario `#666666` solo per note secondarie. Temi alternativi (Avorio, Salvia, Blu Sera, Terra Bruciata): solo se il video mostra un sito matrimonio a tema, e un solo tema per video.

### Gradienti, orbi, texture
- **Cover hero**: 160°, `#F9EEF2 → #FFF8F5 → #F3ECE8 → #EDE4DF`. Sfondo di default delle hero.
- **Shimmer**: 90°, `#D8A7B1 → #E8B4B8 → #C6A27E → #E8B4B8 → #D8A7B1`. Solo per **una** headline premium per video. **[Proposta]** lo scorrimento del riflesso è lentissimo, un passaggio per scena.
- **Orbi ambientali**: radiali sfocati, blush `rgba(232,180,184,0.20)` in alto a sinistra; rose `rgba(216,167,177,0.16)` in basso a destra; caldo `rgba(198,162,126,0.12)` al centro destra. Possono derivare lentamente.
- **Texture** (sottili, carta pregiata): grain 1,8%, lino 6%, acquerello 4,8%, petali 5,5%. **[Proposta]** una sola texture per inquadratura; i petali vanno usati "rari".

## 3. Tipografia

Massimo **2 font** per composizione: **Playfair Display** + **Inter**. Font locali in `assets/fonts/` (licenza OFL inclusa). I font alternativi (Cormorant, EB Garamond, DM Serif, Josefin) **non si usano** nei video di brand (tokens).

| Ruolo | Font | Stile | Note |
|---|---|---|---|
| Titolo / hook | Playfair Display 400–700 | normale o *corsivo* | Corsivo per un tocco romantico, non per intere frasi lunghe |
| Sottotitolo | Playfair o Inter | — | Inter 400/500 in muted |
| Eyebrow | Inter 600 | maiuscolo, tracking `0.18em` | champagne `#7A5C38` |
| Testo / UI | Inter 400–500 | — | line-height 1.5–1.65 |
| Bottone | Inter 600 | tracking `0.04em` | mai tracking zero |

Gerarchia di riferimento (px web, D): display grande 88, display piccolo 56, H3 24–32, body 16, body small 14, eyebrow/label 12.
**[Proposta]** scala per video 1080×1920: i valori web sono troppo piccoli per un telefono. Tenere la stessa gerarchia moltiplicata (es. ×2,5 → titolo 140–220 px, body 40 px, eyebrow 30 px); **minimo assoluto 36 px** per qualsiasi testo a schermo in 9:16 e 28 px in 16:9. Nei mockup di interfaccia il testo "finto" può essere più piccolo ma non deve essere un claim.

## 4. Movimento

Lento, morbido, **mai aggressivo**.
- Camera: push-in morbido, lieve zoom, scorrimento lento (GUIDA_VIDEO). Movimento lentissimo nei loop.
- **[Proposta]** easing in-out (ease-in-out o spring molto smorzata), nessun rimbalzo/elastico, nessun scuotimento, nessun whip-pan, nessun glitch.
- **[Proposta]** entrate degli elementi: dissolvenza + piccolo spostamento (≤ 24 px a 1080 di larghezza), 0,6–0,9 s. Uscite: dissolvenza 0,4–0,6 s.
- **[Proposta]** zoom totale per inquadratura ≤ 8%. Un solo movimento di camera alla volta.
- L'eccezione "caos" (chat o foglio di calcolo disordinati) può avere più elementi, ma con la stessa dolcezza: niente flash, niente scossoni.
- Loop: ultimo fotogramma uguale al primo (GUIDA_VIDEO, prompt hero).
- Niente movimenti che causano morphing o tagli involontari.

## 5. Transizioni ammesse

| Ammessa | Note |
|---|---|
| **Dissolvenza** (cross-dissolve) | Standard. **[Proposta]** 0,5–0,8 s |
| **Scorrimento morbido** (slide lento con easing) | Per passaggi tra blocchi o schermate. **[Proposta]** 0,7–1,0 s |
| Dissolvenza da/verso cream | Per aperture e chiusure |

**Non ammesse**: tagli netti a ritmo rapido, wipe geometrici, zoom-through, glitch, flash bianchi, rotazioni, 3D flip, whip-pan, shake.

## 6. Durata minima del testo a schermo (leggibile su mobile)

Non nelle fonti: **[Proposta]**
- Regola base: durata = **1,2 s + 0,30 s per parola**, con **minimo 2,0 s** (comprese le animazioni di entrata/uscita, il testo deve restare fermo e leggibile per almeno 1,5 s).
- Hook di 3–6 parole: 2,5–3 s. Frasi da 8–10 parole: ~4 s.
- Massimo **2 righe** di testo corrente per inquadratura e circa **8 parole per riga** in 9:16.
- CTA finale: ferma **almeno 3 s**.
- Contrasto: testo ink su cream/white; niente testo su immagini senza velo cream.

## 7. Safe area

Le fonti non indicano valori. **[Proposta]** — da verificare contro l'interfaccia di Reel, TikTok e Shorts prima del primo export:

| Formato | Canvas | Margine laterale | Alto | Basso |
|---|---|---|---|---|
| 9:16 | 1080×1920 | 64 px | 220 px | 340 px (zona UI social: nome, didascalia, bottoni) |
| 16:9 | 1920×1080 | 96 px | 54 px | 54 px |

Tutto il testo e i bottoni stanno dentro la safe area; sfondi, orbi e texture possono andare a pieno schermo. Nessun elemento importante tagliato dal bordo.

## 8. Bottoni CTA

Da D e tokens:
- **Primario**: forma a **pillola** (raggio 9999), sfondo blush `#E8B4B8`, testo ink `#1E1E1E`, Inter 600, tracking `0.04em`, ombra blush `0 4px 20px rgba(232,180,184,0.30)`. Hover (o stato "premuto" nell'animazione): sfondo rose `#D8A7B1`.
- **Secondario**: pillola trasparente, bordo `1.5px solid #E8B4B8`, testo ink; "premuto": riempimento blush.
- Il testo del bottone è piccolo → **mai blush come sfondo di testo piccolo** (D): il testo nel bottone resta ink, e va tenuto grande abbastanza (≥ 36 px in 9:16).
- **[Proposta]** nell'animazione: entra in dissolvenza, un "respiro" lentissimo (scala 1 → 1,03), simulazione di tap con onda blush morbida. Un solo CTA per end card.
- Il testo del CTA va approvato: esempi presenti in `GUIDA_VIDEO.md` ("Crea il tuo sito matrimonio", "Prova gratis") non sono verificati come copy ufficiale del sito.

## 9. Componenti nei mockup

- **Card**: bianca `#FFFFFF`, bordo `1px #EFEAE7`, raggio 20, ombra `0 2px 16px rgba(0,0,0,0.04)`, overlay opzionale `rgba(232,180,184,0.07)` in alto a sinistra.
- **Eyebrow**: Inter 600, 12 px (scalato), maiuscolo, tracking 0,18em, champagne.
- **Badge/tag**: sfondo blush-light `#FEF0F1`, raggio 6–8.
- **Input**: raggio 12.
- Interfacce **ricreate in codice** con questi token: niente screenshot reali, nomi e dati fittizi (CLAUDE, GUIDA_VIDEO).

## 10. Contenuti e licenze (richiamo)

Testi in italiano. Solo funzioni e claim di `PRODOTTO_FATTI.md`. Prezzi solo se letti da `content/commercial.ts`. Niente recensioni inventate. Musica, font e immagini solo con licenza chiara registrata.

---

## Domande aperte

1. **Spaziature**: il design system non ha una scala di spaziature (solo raggi e line-height). Ne definiamo una per il video (es. multipli di 8 px) o la derivi da un componente del sito?
2. **Scala tipografica per video**: confermi il moltiplicatore (~×2,5) e i minimi 36 px (9:16) / 28 px (16:9)?
3. **Safe area**: confermi i margini proposti (9:16: 64/220/340 px; 16:9: 96/54/54 px) o hai le misure ufficiali delle piattaforme che userai?
4. **Durata minima del testo**: ok per la formula 1,2 s + 0,30 s/parola, minimo 2 s?
5. **Conteggio dei 3 colori**: il testo ink e lo sfondo cream contano? Qui sono contati (sfondo + testo + accento).
6. **Durate e curve di movimento/transizione**: confermi i valori proposti (dissolvenza 0,5–0,8 s, scorrimento 0,7–1,0 s)?
7. **Logo**: `assets/logo/` non esiste/è vuoto e il design system non descrive il logo. Dove lo trovo, in che versioni (colore, su cream) e con quali regole di spazio libero?
8. **URL del sito** e dominio da mostrare nelle CTA: non presenti nei file.
9. **Copy dei CTA ufficiali** (es. "Prova gratis", "Crea il tuo sito matrimonio"): confermati dal sito o solo esempi della guida?
10. **Prezzi**: `content/commercial.ts` non è nel repository. Puoi fornire il file o i valori attuali (nei file letti: EUR 12/mese e EUR 79 una tantum)?
11. **Fondo regalo**: nei file è "lista nozze/IBAN" nel piano gratuito; le funzioni avanzate (se esistono) sono Premium? Per ora il video dice solo "senza commissioni, bonifico diretto".
12. **Limiti del piano gratuito** (numero invitati, foto, sezioni): assenti; servono solo se vogliamo un video di confronto free/Premium.
13. **Musica**: nessuna traccia con licenza in `assets/audio/` (e nessun `index.json`). Fonte e licenza?
14. **Texture e petali**: esistono asset sorgente (SVG/PNG) dei petali e del lino, o li generiamo in codice come approssimazione?
15. **Shimmer**: in uso solo per headline premium; ok limitarlo a una headline per video?
