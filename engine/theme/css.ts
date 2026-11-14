import { fontFaceCss, fontStack } from "./fonts.ts";
import { ORB_DIAMETER, gradient, orbCss, textureCss } from "./effects.ts";
import { FORMAT_IDS, safeArea, type FormatId } from "./safe-area.ts";
import { COLOR_NAMES, SHADOW_NAMES, color, radius, shadow, typeTokens } from "./tokens.ts";

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

/**
 * Pesi dei titoli: i token non li fissano (dicono solo 400/600/700 disponibili).
 * Scelta del motore: display grande 700, display piccolo e H3 600.
 */
const HEADING_WEIGHT: Record<string, number> = { displayLarge: 700, displaySmall: 600, h3: 600 };

function typeClasses(): string {
  return Object.entries(typeTokens)
    .map(([name, t]) => {
      const heading = t.font === "heading";
      const decl = [
        `font-family:${fontStack[t.font]}`,
        `font-size:calc(${t.size}px * var(--ts,1))`,
        `font-weight:${t.weight ?? HEADING_WEIGHT[name] ?? 400}`,
        `line-height:${t.lineHeight ?? (heading ? 1.15 : 1.6)}`,
        t.uppercase ? "text-transform:uppercase" : "",
        t.letterSpacing ? `letter-spacing:${t.letterSpacing}` : "",
        t.color ? `color:var(--c-${kebab(t.color)})` : "",
      ].filter(Boolean);
      return `.t-${name}{${decl.join(";")};}`;
    })
    .join("\n");
}

/** CSS del tema per un formato: variabili, @font-face, classi tipografiche, orbi, texture, frame. */
export function themeCss(format: FormatId = "9:16", fontBaseUrl = "/"): string {
  const sa = safeArea(format);
  const vars = [
    ...COLOR_NAMES.map((n) => `--c-${kebab(n)}:${color[n]}`),
    ...SHADOW_NAMES.map((n) => `--sh-${kebab(n)}:${shadow[n]}`),
    `--r-pill:${radius.pill}px`, `--r-card:${radius.card}px`, `--r-input:${radius.input}px`,
    `--r-badge:${radius.badge}px`, `--r-badge-min:${radius.badgeMin}px`,
    `--g-shimmer:${gradient.shimmer}`, `--g-cover-hero:${gradient.coverHero}`,
    `--w:${sa.w}px`, `--h:${sa.h}px`,
    `--safe-left:${sa.left}px`, `--safe-right:${sa.right}px`, `--safe-top:${sa.top}px`, `--safe-bottom:${sa.bottom}px`,
    `--orb-d:${Math.round(Math.max(sa.w, sa.h) * ORB_DIAMETER)}px`,
  ];
  return [
    fontFaceCss(fontBaseUrl),
    `:root{${vars.join(";")};}`,
    `*{box-sizing:border-box;}`,
    `body{margin:0;background:var(--c-cream);color:var(--c-ink);font-family:${fontStack.body};}`,
    typeClasses(),
    `.italic{font-style:italic;}`,
    `.shimmer{background:var(--g-shimmer);-webkit-background-clip:text;background-clip:text;color:transparent;}`,
    // Frame video: sfondo coverHero, tutto ritagliato al canvas.
    `.frame{position:relative;width:var(--w);height:var(--h);overflow:hidden;background:var(--g-cover-hero);}`,
    `.safe{position:absolute;left:var(--safe-left);right:var(--safe-right);top:var(--safe-top);bottom:var(--safe-bottom);}`,
    orbCss(),
    textureCss(),
    // Componenti base del brand.
    `.pill-primary{display:inline-flex;align-items:center;justify-content:center;padding:0.9em 2em;border-radius:var(--r-pill);background:var(--c-blush);color:var(--c-ink);box-shadow:var(--sh-blush);}`,
    `.pill-secondary{display:inline-flex;align-items:center;justify-content:center;padding:0.9em 2em;border-radius:var(--r-pill);background:transparent;color:var(--c-ink);border:1.5px solid var(--c-blush);}`,
    `.card{position:relative;background:var(--c-white);border:1px solid var(--c-border);border-radius:var(--r-card);box-shadow:var(--sh-soft);overflow:hidden;}`,
    `.card::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 0% 0%, rgba(232,180,184,0.07), transparent 60%);}`,
    `.badge{display:inline-block;padding:0.35em 0.8em;border-radius:var(--r-badge);background:var(--c-blush-light);}`,
  ].join("\n");
}

export { FORMAT_IDS };
