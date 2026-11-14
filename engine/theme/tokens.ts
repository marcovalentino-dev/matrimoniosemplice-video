import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/** Radice del repo (engine/theme -> engine -> repo). */
export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const TOKENS_PATH = path.join(ROOT, "brand", "tokens.json");

const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const COLOR_NAMES = [
  "cream", "parchment", "blush", "blushLight", "rose", "champagne", "goldLight",
  "goldPale", "border", "white", "ink", "muted", "subtle",
] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

export const SHADOW_NAMES = ["soft", "softMd", "softLg", "blush", "blushLg"] as const;
export type ShadowName = (typeof SHADOW_NAMES)[number];

export const TEXTURE_NAMES = ["grain", "linen", "watercolor", "petals"] as const;
export type TextureName = (typeof TEXTURE_NAMES)[number];

export const ORB_NAMES = ["blush", "rose", "warm"] as const;
export type OrbName = (typeof ORB_NAMES)[number];

const Gradient = z.object({ angle: z.number(), stops: z.array(Hex).min(2), use: z.string() });
const TypeStyle = z.object({
  font: z.enum(["heading", "body"]),
  size: z.number().positive(),
  sizeMin: z.number().optional(),
  weight: z.number().optional(),
  uppercase: z.boolean().optional(),
  letterSpacing: z.string().optional(),
  color: z.string().optional(),
  lineHeight: z.number().optional(),
  note: z.string().optional(),
});

const TokensSchema = z.object({
  color: z.object(Object.fromEntries(COLOR_NAMES.map((n) => [n, z.object({ value: Hex, role: z.string() })])) as Record<ColorName, z.ZodObject<{ value: typeof Hex; role: z.ZodString }>>),
  forbidden: z.object({ colors: z.array(Hex) }),
  gradient: z.object({ shimmer: Gradient, coverHero: Gradient }),
  orb: z.object(Object.fromEntries(ORB_NAMES.map((n) => [n, z.object({ color: z.string(), position: z.string() })])) as Record<OrbName, z.ZodObject<{ color: z.ZodString; position: z.ZodString }>>),
  font: z.object({
    maxPerComposition: z.number(),
    heading: z.object({ family: z.string(), fallback: z.string(), weights: z.array(z.number()), styles: z.array(z.string()) }),
    body: z.object({ family: z.string(), fallback: z.string(), weights: z.array(z.number()), styles: z.array(z.string()) }),
  }),
  type: z.object({
    displayLarge: TypeStyle, displaySmall: TypeStyle, h3: TypeStyle, eyebrow: TypeStyle,
    body: TypeStyle, bodySmall: TypeStyle, label: TypeStyle, button: TypeStyle,
  }),
  radius: z.object({ pill: z.number(), card: z.number(), input: z.number(), badge: z.number(), badgeMin: z.number() }),
  shadow: z.object(Object.fromEntries(SHADOW_NAMES.map((n) => [n, z.string()])) as Record<ShadowName, z.ZodString>),
  texture: z.object(Object.fromEntries(TEXTURE_NAMES.map((n) => [n, z.object({ opacity: z.number().min(0).max(1), effect: z.string() })])) as Record<TextureName, z.ZodObject<{ opacity: z.ZodNumber; effect: z.ZodString }>>),
});

export type Tokens = z.infer<typeof TokensSchema>;

/** Legge e valida brand/tokens.json. Fallisce forte se manca un token atteso. */
export function loadTokens(file = TOKENS_PATH): Tokens {
  return TokensSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

const T = loadTokens();

/** Colori: nome -> hex (maiuscolo, come in tokens.json). */
export const color = Object.fromEntries(COLOR_NAMES.map((n) => [n, T.color[n].value.toUpperCase()])) as Record<ColorName, string>;

export const forbiddenColors = T.forbidden.colors.map((c) => c.toUpperCase());

export const shadow = Object.fromEntries(SHADOW_NAMES.map((n) => [n, T.shadow[n]])) as Record<ShadowName, string>;

export const radius = { ...T.radius };

export const texture = Object.fromEntries(TEXTURE_NAMES.map((n) => [n, T.texture[n].opacity])) as Record<TextureName, number>;

export const orbColor = Object.fromEntries(ORB_NAMES.map((n) => [n, T.orb[n].color])) as Record<OrbName, string>;

export const gradientTokens = T.gradient;

/** Tutti gli hex presenti in tokens.json (qualsiasi sezione), maiuscoli. */
export function allTokenHexes(file = TOKENS_PATH): Set<string> {
  const raw = readFileSync(file, "utf8");
  return new Set((raw.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toUpperCase()));
}

export const fontTokens = T.font;
export const typeTokens = T.type;
