// Primitive di animazione: tutto funzione di t, easing dolce (seno), nessun rimbalzo.

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** Avanzamento lineare 0..1 di t tra a e b. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** Ease-in-out dolce (BRAND_VIDEO §4: niente elastico). */
export const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
/** Numero compatto per le stringhe CSS (3 decimali al massimo). */
export const n = (x: number) => String(Math.round(x * 1000) / 1000);

/** Spostamento massimo d'entrata ammesso: 24 px a 1080 (BRAND_VIDEO §4). */
export const MAX_ENTER_DIST = 24;

export interface Reveal {
  /** Avanzamento con easing 0..1 (è anche l'opacità). */
  p: number;
  /** Spostamento verticale residuo in px. */
  y: number;
}

/** Entrata: dissolvenza + piccolo spostamento verso l'alto, 0,6-0,9 s. */
export function reveal(t: number, start: number, dur = 0.7, dist = 20): Reveal {
  const p = ease(seg(t, start, start + dur));
  return { p, y: (1 - p) * Math.min(dist, MAX_ENTER_DIST) };
}

/** Stile inline di un'entrata. `extra` si appende (es. transform aggiuntivi vanno gestiti a parte). */
export function revealStyle(t: number, start: number, dur = 0.7, dist = 20, extra = ""): string {
  const r = reveal(t, start, dur, dist);
  return `opacity:${n(r.p)};transform:translateY(${n(r.y)}px);${extra}`;
}

/** Generatore pseudo-casuale con seme (mulberry32): stesso seme, stessa sequenza, sempre. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Respiro lentissimo: 0..1..0 con periodo `period` s, attivo da `start`. */
export function breath(t: number, start: number, period: number): number {
  return (0.5 - 0.5 * Math.cos((2 * Math.PI * (t - start)) / period)) * seg(t, start, start + 0.6);
}

/** Impulso 0..1..0 centrato su `at`: sale in `up` s, scende in `down` s (pressione di un bottone). */
export function pulse(t: number, at: number, up = 0.14, down = 0.3, hold = 0.16): number {
  return seg(t, at - 0.02, at - 0.02 + up) * (1 - seg(t, at + hold, at + hold + down));
}

/** Arrotonda per eccesso al mezzo secondo. */
export const ceilHalf = (x: number) => Math.ceil(x * 2 - 1e-9) / 2;

/** Durata minima di un testo leggibile (BRAND_VIDEO §6): 1,2 s + 0,30 s per parola, minimo 2 s. */
export const textDuration = (words: number) => Math.max(2, 1.2 + 0.3 * words);

/** Il testo deve restare fermo almeno 1,5 s dopo la fine dell'entrata. */
export const HOLD = 1.5;
