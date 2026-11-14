import { existsSync } from "node:fs";
import path from "node:path";
import { ROOT, fontTokens } from "./tokens.ts";

/** Font locali (assets/fonts/, licenza OFL). Mai da CDN. Due famiglie in tutto: limite del brand. */
const FILES = [
  { family: fontTokens.heading.family, style: "normal", weight: "400 900", file: "assets/fonts/playfair-display/PlayfairDisplay[wght].ttf" },
  { family: fontTokens.heading.family, style: "italic", weight: "400 900", file: "assets/fonts/playfair-display/PlayfairDisplay-Italic[wght].ttf" },
  { family: fontTokens.body.family, style: "normal", weight: "100 900", file: "assets/fonts/inter/Inter[opsz,wght].ttf" },
] as const;

export const headingFamily = fontTokens.heading.family;
export const bodyFamily = fontTokens.body.family;
export const FONT_FAMILIES = [headingFamily, bodyFamily];

export const fontStack = {
  heading: `"${headingFamily}", ${fontTokens.heading.fallback}`,
  body: `"${bodyFamily}", ${fontTokens.body.fallback}`,
};

/** Verifica che i file dei font esistano. Restituisce quelli mancanti. */
export function missingFontFiles(): string[] {
  return FILES.filter((f) => !existsSync(path.join(ROOT, f.file))).map((f) => f.file);
}

/**
 * @font-face dai file locali. `baseUrl` è l'URL (o percorso) che corrisponde alla radice del repo
 * sul server statico del render, di default "/".
 */
export function fontFaceCss(baseUrl = "/"): string {
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  return FILES.map((f) => {
    const url = base + f.file.split("/").map(encodeURIComponent).join("/");
    return `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:block;src:url("${url}") format("truetype");}`;
  }).join("\n");
}
