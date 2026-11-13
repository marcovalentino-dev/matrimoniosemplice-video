import { z } from "zod";

export const Format = z.enum(["9:16", "16:9"]);

/** brief.json (SPEC §5.1) */
export const BriefSchema = z.object({
  version: z.literal(1),
  slug: z.string().regex(/^[a-z0-9-]{1,48}$/),
  prompt: z.string().min(1),
  goal: z.string().min(1),
  format: Format,
  size: z.object({ w: z.number().int(), h: z.number().int() }),
  fps: z.number().int().positive(),
  durationSec: z.number().min(5).max(60),
  audience: z.string(),
  message: z.string().min(1),
  claims: z.array(z.string()),
  cta: z.object({ label: z.string(), url: z.string(), approved: z.boolean() }),
  tone: z.string(),
  loop: z.boolean(),
  audio: z.enum(["none", "synth", "library"]),
  needsFromUser: z.array(z.object({ field: z.string(), reason: z.string() })),
  assumptions: z.array(z.string()),
});
export type Brief = z.infer<typeof BriefSchema>;
