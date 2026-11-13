# 08_DESIGN_SYSTEM — MatrimonioSemplice

Design system ufficiale del brand. Estratto direttamente dalla codebase (`tailwind.config.ts`, `globals.css`, `layout.tsx`).
Da usare come riferimento per template Canva, presentazioni, post social, asset marketing.

---

## BRAND IDENTITY IN SINTESI

- **Posizionamento visivo**: romantico italiano, elegante ma accessibile, caldo e luminoso
- **Non è**: freddo, tech, minimal scandinavo, dark luxury
- **Tono visivo**: come una lettera scritta a mano su carta pregiata, sotto la luce del pomeriggio

---

## COLORI

### Palette principale (UI e marketing)

| Nome token     | Hex       | Uso                                      |
|----------------|-----------|------------------------------------------|
| `w-cream`      | `#FFF8F5` | Sfondo primario — la base di tutto       |
| `w-parchment`  | `#F3ECE8` | Sfondo secondario — sezioni alternate    |
| `w-blush`      | `#E8B4B8` | Accento primario — bottoni, highlights   |
| `w-blush-light`| `#FEF0F1` | Sfondo blush leggero — badge, tag        |
| `w-rose`       | `#D8A7B1` | Accento secondario — hover, sfumature    |
| `w-champagne`  | `#7A5C38` | Oro elegante — eyebrow, dettagli lusso   |
| `w-gold-light` | `#D4B896` | Oro chiaro — decorazioni, illustrazioni  |
| `w-gold-pale`  | `#F0E8E0` | Oro palissandro — sfondi caldi delicati  |
| `w-border`     | `#EFEAE7` | Bordi — linee, divisori, outline         |
| `white`        | `#FFFFFF` | Card, form, superfici sopraelevate       |

### Colori testo

| Nome token   | Hex       | Uso                              |
|--------------|-----------|----------------------------------|
| `w-ink`      | `#1E1E1E` | Testo primario — titoli e body   |
| `w-muted`    | `#4A4A4A` | Testo secondario — descrizioni   |
| `w-subtle`   | `#666666` | Testo terziario — placeholder    |

### Sfumatura shimmer (usata per testo headline premium)

```
Gradiente: #D8A7B1 → #E8B4B8 → #C6A27E → #E8B4B8 → #D8A7B1
Direzione: 90°
```

### Sfumatura cover hero (sfondo pagina matrimonio default)

```
Gradiente: #F9EEF2 → #FFF8F5 → #F3ECE8 → #EDE4DF
Direzione: 160°
```

---

## TEMI COLORE — Siti Matrimonio

I siti matrimonio possono usare uno dei seguenti temi. Ogni tema sovrascrive accent e background mantenendo la struttura visiva.

### Rosa Romantico (default del brand)

| Ruolo            | Hex       |
|------------------|-----------|
| Sfondo principale| `#FFF8F5` |
| Sfondo alt       | `#F3ECE8` |
| Accento          | `#E8B4B8` |
| Accento hover    | `#D8A7B1` |
| Dettaglio lusso  | `#7A5C38` |

### Avorio Classico

| Ruolo            | Hex       |
|------------------|-----------|
| Sfondo principale| `#FEFCF8` |
| Sfondo alt       | `#F5EFE6` |
| Accento          | `#C9A96E` |
| Accento hover    | `#B8935A` |
| Dettaglio lusso  | `#8B6914` |

### Verde Salvia

| Ruolo            | Hex       |
|------------------|-----------|
| Sfondo principale| `#F5F8F4` |
| Sfondo alt       | `#EAF0E8` |
| Accento          | `#7A9E76` |
| Accento hover    | `#5E7A5A` |
| Dettaglio lusso  | `#5E7535` |

### Blu Sera

| Ruolo            | Hex       |
|------------------|-----------|
| Sfondo principale| `#F4F6FA` |
| Sfondo alt       | `#EBF0F8` |
| Accento          | `#7A94C4` |
| Accento hover    | `#5A78B0` |
| Dettaglio lusso  | `#4A6094` |

### Terra Bruciata

| Ruolo            | Hex       |
|------------------|-----------|
| Sfondo principale| `#FAF6F2` |
| Sfondo alt       | `#EFE6DC` |
| Accento          | `#C4785A` |
| Accento hover    | `#A85E46` |
| Dettaglio lusso  | `#7A4E38` |

---

## TIPOGRAFIA

### Font principali

| Ruolo              | Font                 | Varianti usate               | Uso in prodotto                              |
|--------------------|----------------------|------------------------------|----------------------------------------------|
| **Heading (serif)**| Playfair Display     | 400, 600, 700 — normale, corsivo | Titoli dashboard, landing, sito matrimonio default |
| **Body (sans)**    | Inter                | 400, 500, 600                | Tutto il testo corpo, UI, bottoni, label     |

### Font alternativi (per siti matrimonio)

| Font                | Varianti       | Carattere visivo                          |
|---------------------|----------------|-------------------------------------------|
| Cormorant Garamond  | 400, 600       | Ultra-elegante, delicato, old money       |
| EB Garamond         | 400, 500       | Classico letterario, sobrio e caldo       |
| DM Serif Display    | 400            | Moderno ma serif, equilibrato, versatile  |
| Josefin Sans        | 300, 400, 600  | Geometrico, contemporaneo, leggero        |

---

## GERARCHIA TIPOGRAFICA

### Dashboard e landing (font: Playfair Display + Inter)

| Livello         | Font           | Dimensione indicativa    | Uso                             |
|-----------------|----------------|--------------------------|----------------------------------|
| Display grande  | Playfair       | ~5.5rem (88px)           | Hero headline landing           |
| Display piccolo | Playfair       | ~3.5rem (56px)           | Titoli sezione                  |
| H3              | Playfair       | ~1.5–2rem                | Sottotitoli, card title         |
| Eyebrow         | Inter          | 0.75rem (12px) uppercase | Label sopra titoli — oro champagne |
| Body            | Inter          | 1rem (16px)              | Testo corrente                  |
| Body small      | Inter          | 0.875rem (14px)          | Descrizioni, note               |
| Label UI        | Inter          | 0.75rem (12px) uppercase | Form label, badge               |
| Bottone         | Inter          | 0.875rem (14px) semibold | CTA                             |

### Regole tipografiche fondamentali

- **Titoli**: sempre Playfair Display (o font serif alternativo scelto)
- **Tutto il resto**: Inter (bottoni, form, body, label, eyebrow)
- **Eyebrow** (etichetta sopra il titolo): uppercase, tracking larghissimo (`0.18em`), colore champagne/oro
- **Titoli heading**: possono usare il corsivo di Playfair per tocco romantico
- **Letter-spacing bottoni**: `0.04em` — leggera apertura, mai zero
- **Line-height body**: `1.5–1.65` per leggibilità su mobile

---

## SPACING E FORMA

### Border radius

| Elemento           | Radius    |
|--------------------|-----------|
| Bottoni (pill)     | `9999px`  |
| Card, modal        | `20px`    |
| Input boxed        | `12px`    |
| Badge, tag piccoli | `6–8px`   |

### Ombre

| Nome         | Valore                                      | Uso                        |
|--------------|---------------------------------------------|----------------------------|
| soft         | `0 2px 16px rgba(0,0,0,0.04)`              | Card base                  |
| soft-md      | `0 4px 24px rgba(0,0,0,0.06)`              | Card hover leggero         |
| soft-lg      | `0 8px 40px rgba(0,0,0,0.08)`              | Elementi elevati           |
| blush        | `0 4px 20px rgba(232,180,184,0.30)`        | Bottoni, elementi blush    |
| blush-lg     | `0 12px 40px rgba(232,180,184,0.22)`       | Hover card con accento     |

---

## COMPONENTI CHIAVE (da replicare su Canva)

### Bottone primario

- Sfondo: `#E8B4B8` (blush)
- Testo: `#1E1E1E` (ink)
- Font: Inter Semibold, uppercase-like tracking
- Forma: pill (border-radius massimo)
- Hover: sfondo `#D8A7B1` + ombra blush

### Bottone secondario (outline)

- Sfondo: trasparente
- Bordo: `1.5px solid #E8B4B8`
- Testo: `#1E1E1E`
- Hover: riempimento blush

### Card

- Sfondo: `#FFFFFF`
- Bordo: `1px solid #EFEAE7`
- Border-radius: `20px`
- Ombra: `0 2px 16px rgba(0,0,0,0.04)`
- Gradiente overlay opzionale: `rgba(232,180,184,0.07)` in alto a sinistra

### Eyebrow (etichetta sopra titolo)

- Font: Inter Semibold
- Dimensione: 12px
- Colore: `#7A5C38` (champagne)
- Transform: uppercase
- Letter-spacing: `0.18em`

---

## TEXTURE E DETTAGLI ATMOSFERICI

Il brand usa texture sottili per evocare carta pregiata e materiali fisici:

| Texture          | Effetto visivo                    | Opacità |
|------------------|-----------------------------------|---------|
| Grain (grana)    | Film grain, rumore fine           | 1.8%    |
| Lino             | Trama tessuto                     | 6%      |
| Carta acquerello | Rumore a bassa frequenza          | 4.8%    |
| Petali           | Petali rosa sparsi ripetuti       | 5.5%    |

Su Canva: si può simulare con overlay di texture paper a opacità molto bassa (2–6%).

---

## ORBI AMBIENTALI (background decorativo)

Gradiente sfumato usato come decorazione di sfondo nelle hero section:

- **Orb 1 (blush)**: radiale blush `rgba(232,180,184,0.20)` — in alto a sinistra
- **Orb 2 (rose)**: radiale rosa `rgba(216,167,177,0.16)` — in basso a destra
- **Orb 3 (caldo)**: radiale champagne `rgba(198,162,126,0.12)` — al centro destra

Su Canva: replicare con cerchi con gradiente radiale, sfocatura alta (blur), opacità bassa.

---

## REGOLE D'USO DEL BRAND

### Cosa fare

- Usare Playfair Display per i titoli nelle comunicazioni esterne
- Mantenere lo sfondo cream `#FFF8F5` come base nelle slide e nei template
- Usare il blush `#E8B4B8` come colore accento per evidenziare CTA e elementi chiave
- Aggiungere oro champagne `#7A5C38` solo come dettaglio, non come colore dominante
- Lasciare spazio bianco: il brand respira, non è affollato

### Cosa non fare

- Non usare nero puro `#000000` — usare sempre `#1E1E1E`
- Non usare font geometrici freddi (es. Futura, Helvetica) come heading
- Non saturare con troppi colori: max 2–3 colori per layout
- Non usare il blush come sfondo su testo piccolo (contrasto insufficiente)
- Non combinare più di 2 font nella stessa composizione

---

## QUICK REFERENCE PER CANVA

### Combinazione colori consigliata per template

```
Sfondo:   #FFF8F5  (cream)
Titolo:   #1E1E1E  (ink) — font Playfair Display
Sottotito:#4A4A4A  (muted) — font Inter
Accento:  #E8B4B8  (blush)
Dettaglio:#7A5C38  (champagne)
Bordo:    #EFEAE7
```

### Font stack Canva

| Uso        | Font Canva              | Peso      |
|------------|-------------------------|-----------|
| Titolo H1  | Playfair Display        | Regular / Bold |
| Titolo H2  | Playfair Display Italic | Regular corsivo |
| Eyebrow    | Inter                   | SemiBold, uppercase |
| Body       | Inter                   | Regular / Medium |
| Bottone    | Inter                   | SemiBold  |

### Palette esadecimale da importare in Canva

```
#FFF8F5  — Cream (sfondo)
#F3ECE8  — Parchment (sfondo alternativo)
#E8B4B8  — Blush (accento principale)
#D8A7B1  — Rose (accento secondario)
#FEF0F1  — Blush light (sfondo badge)
#7A5C38  — Champagne (dettaglio oro)
#D4B896  — Gold light (decorazioni)
#F0E8E0  — Gold pale (sfondi caldi)
#EFEAE7  — Border (linee e bordi)
#FFFFFF  — Bianco (card)
#1E1E1E  — Ink (testo primario)
#4A4A4A  — Muted (testo secondario)
#666666  — Subtle (testo terziario)
```
