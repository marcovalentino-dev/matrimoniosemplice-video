import { z } from "zod";
import { BriefSchema, Format } from "./brief.ts";

/** Palette = i 5 temi colore di PRODOTTO_FATTI (D "Temi colore"). */
export const PALETTES = ["rosa-romantico", "avorio-classico", "verde-salvia", "blu-sera", "terra-bruciata"] as const;

/** Origine di un testo a schermo (SPEC §5.2). */
export const TextSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("claim"), id: z.string().min(1) }),
  z.object({ kind: z.literal("mock") }),
  z.object({ kind: z.literal("ui-label"), id: z.string().min(1) }),
  z.object({ kind: z.literal("cta") }),
  z.object({ kind: z.literal("price"), ref: z.string().min(1) }),
]);
export type TextSource = z.infer<typeof TextSourceSchema>;

export const OnScreenTextSchema = z.object({
  text: z.string().min(1),
  role: z.enum(["eyebrow", "headline", "sub", "caption", "cta", "label", "price", "mock"]),
  source: TextSourceSchema,
});

export const ShotSchema = z.object({
  id: z.string().regex(/^s\d{1,2}$/),
  start: z.number().min(0),
  end: z.number().positive(),
  scene: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
  onScreenText: z.array(OnScreenTextSchema),
  transitionIn: z.object({ type: z.enum(["dissolve", "slide", "fromCream"]), dur: z.number().min(0.2).max(1.2) }).optional(),
  camera: z.object({ move: z.enum(["none", "pushIn", "pullOut"]), amount: z.number().min(0).max(0.08).optional() }).optional(),
  audio: z.object({ music: z.string().optional(), cues: z.array(z.string()).optional() }).optional(),
  notes: z.string(),
});
export type Shot = z.infer<typeof ShotSchema>;

export const MusicSchema = z.object({
  mood: z.string().min(1),
  bpm: z.number().int().min(50).max(160).optional(),
  fadeIn: z.number().min(0).max(5),
  fadeOut: z.number().min(0).max(5),
});

/** storyboard.json (SPEC §5.2) */
export const StoryboardSchema = z.object({
  version: z.literal(1),
  briefHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  format: Format,
  size: z.object({ w: z.number().int(), h: z.number().int() }),
  fps: z.number().int().positive(),
  durationSec: z.number().min(5).max(60),
  theme: z.object({ palette: z.enum(PALETTES).default("rosa-romantico") }),
  shots: z.array(ShotSchema).min(1),
  music: MusicSchema.optional(),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

/**
 * Ciò che scrive il regista. I campi derivati (version, prompt, size, fps, briefHash...) li mette il codice:
 * il modello non deve poterli sbagliare.
 */
export const DirectorBriefSchema = BriefSchema.omit({ version: true, prompt: true, size: true, fps: true });
export const DirectorStoryboardSchema = StoryboardSchema.omit({ version: true, briefHash: true, format: true, size: true, fps: true, durationSec: true });

/** Il regista dichiara che la richiesta esce dal catalogo (SPEC §9, E_GAP). */
export const GapSchema = z.object({ reason: z.string().min(1), missing: z.array(z.string()).default([]) });

export const DirectorOutputSchema = z.union([
  z.object({ brief: DirectorBriefSchema, storyboard: DirectorStoryboardSchema }),
  z.object({ gap: GapSchema }),
]);
export type DirectorOutput = z.infer<typeof DirectorOutputSchema>;
