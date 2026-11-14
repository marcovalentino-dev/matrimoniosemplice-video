// Utilità HTML per le scene: escape, testo ricco (*corsivo*, shimmer, a capo), conteggio parole.

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Testo senza marcatori: `*corsivo*` perde gli asterischi. */
export const plain = (s: string) => s.replace(/\*/g, "");

export const wordCount = (s: string) => plain(s).split(/\s+/).filter(Boolean).length;

export interface Tok {
  text: string;
  italic: boolean;
  shimmer: boolean;
  br?: boolean;
}

/**
 * Spezza un testo in parole. `*...*` = corsivo (Playfair italic, tocco romantico);
 * `shimmer` = sottostringa da rendere con la sfumatura shimmer (una sola headline premium per video).
 * `\n` = a capo.
 */
export function tokenize(text: string, shimmer?: string): Tok[] {
  const chars: { c: string; it: boolean }[] = [];
  let it = false;
  for (const c of text) {
    if (c === "*") it = !it;
    else chars.push({ c, it });
  }
  const flat = chars.map((x) => x.c).join("");
  const sIdx = shimmer ? flat.indexOf(plain(shimmer)) : -1;
  const sEnd = sIdx >= 0 ? sIdx + plain(shimmer!).length : -1;
  const toks: Tok[] = [];
  let cur = "";
  let start = 0;
  const flush = (end: number) => {
    if (!cur) return;
    const sh = sIdx >= 0 && start < sEnd && end > sIdx;
    toks.push({ text: cur, italic: chars[start]?.it ?? false, shimmer: sh });
    cur = "";
  };
  chars.forEach((x, i) => {
    if (x.c === "\n") {
      flush(i);
      toks.push({ text: "", italic: false, shimmer: false, br: true });
    } else if (/\s/.test(x.c)) {
      flush(i);
    } else {
      if (!cur) start = i;
      cur += x.c;
    }
  });
  flush(chars.length);
  // Il corsivo/shimmer applicato a una parte della frase porta anche il corsivo sul resto del segmento shimmer.
  return toks.map((k) => (k.shimmer ? { ...k, italic: true } : k));
}

/**
 * Testo ricco in linea (senza animazione per parola).
 * `shimmerPos` = posizione 0..100 del riflesso (un passaggio lentissimo per scena).
 */
export function richText(text: string, shimmer?: string, shimmerPos = 0): string {
  return tokenize(text, shimmer)
    .map((k) => (k.br ? "<br>" : wordSpan(k, "", shimmerPos)))
    .join(" ")
    .replace(/ <br> /g, "<br>");
}

function wordSpan(k: Tok, style: string, shimmerPos: number): string {
  const cls = [k.italic ? "italic" : "", k.shimmer ? "shimmer" : ""].filter(Boolean).join(" ");
  const sh = k.shimmer ? `background-size:300% 100%;background-position:${Math.round(shimmerPos * 10) / 10}% 0;padding:0 .06em;` : "";
  return `<span class="${cls}" style="display:inline-block;${sh}${style}">${esc(k.text)}</span>`;
}

/** Come richText, ma ogni parola ha uno stile proprio (entrata parola per parola). */
export function wordsHtml(text: string, shimmer: string | undefined, styleOf: (i: number) => string, shimmerPos = 0): string {
  let i = 0;
  return tokenize(text, shimmer)
    .map((k) => (k.br ? "<br>" : wordSpan(k, styleOf(i++), shimmerPos)))
    .join(" ")
    .replace(/ <br> /g, "<br>");
}

export const px = (v: number) => `${Math.round(v * 100) / 100}px`;
