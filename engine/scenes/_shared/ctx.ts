import { safeArea, type FormatId } from "../../theme/safe-area.ts";
import type { SceneCtx } from "./types.ts";

const cache = new Map<FormatId, ReturnType<typeof safeArea>>();

/** Contesto di scena per un formato e una durata. La safe area viene da theme/safe-area.ts. */
export function makeCtx(format: FormatId, dur: number): SceneCtx {
  let safe = cache.get(format);
  if (!safe) {
    safe = safeArea(format);
    cache.set(format, safe);
  }
  return { format, w: safe.w, h: safe.h, landscape: safe.w > safe.h, safe, dur };
}
