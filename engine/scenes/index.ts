import { themeCss } from "../theme/css.ts";
import type { FormatId } from "../theme/safe-area.ts";
import { EngineError } from "../utils/errors.ts";
import { ChatChaos } from "./ChatChaos/index.ts";
import { EndCard } from "./EndCard/index.ts";
import { GiftFundCard } from "./GiftFundCard/index.ts";
import { GuestDashboard } from "./GuestDashboard/index.ts";
import { HookText } from "./HookText/index.ts";
import { KineticList } from "./KineticList/index.ts";
import { PhoneMockupSite } from "./PhoneMockupSite/index.ts";
import { PlanningChecklist } from "./PlanningChecklist/index.ts";
import { PriceCard } from "./PriceCard/index.ts";
import { RsvpFlow } from "./RsvpFlow/index.ts";
import { SpreadsheetChaos } from "./SpreadsheetChaos/index.ts";
import { TableSeating } from "./TableSeating/index.ts";
import { TitleCard } from "./TitleCard/index.ts";
import { SHARED_CSS } from "./_shared/ui.ts";
import { makeCtx } from "./_shared/ctx.ts";
import type { AnyScene, SceneCtx } from "./_shared/types.ts";

export { makeCtx };
export type { AnyScene, SceneCtx, SceneDef, Cue, OnScreenText, DurationInfo } from "./_shared/types.ts";

/** Il catalogo, nell'ordine in cui compare in CATALOGO.md. */
export const SCENES: AnyScene[] = [
  TitleCard, HookText, ChatChaos, SpreadsheetChaos, PhoneMockupSite, RsvpFlow, GuestDashboard,
  GiftFundCard, TableSeating, PlanningChecklist, PriceCard, KineticList, EndCard,
];

export const SCENE_NAMES = SCENES.map((s) => s.name);

export function getScene(name: string): AnyScene {
  const s = SCENES.find((x) => x.name === name);
  if (!s) throw new EngineError("E_GAP", `Scena "${name}" non presente nel catalogo (${SCENE_NAMES.join(", ")}).`);
  return s;
}

/** Valida le props con lo schema della scena (applica i default) e risolve i dati esterni (es. prezzi). */
export async function prepareProps(scene: AnyScene, raw: unknown): Promise<unknown> {
  const parsed = scene.schema.parse(raw);
  return scene.resolve ? scene.resolve(parsed) : parsed;
}

/** HTML di un fotogramma: `.frame` con il contenuto della scena al tempo locale `t`. */
export function renderFrame(scene: AnyScene, props: unknown, t: number, ctx: SceneCtx): string {
  return `<div class="frame">${scene.render(props, t, ctx)}</div>`;
}

/** CSS di tutte le scene (condiviso + per scena). */
export function scenesCss(): string {
  return [SHARED_CSS, ...SCENES.map((s) => s.css).filter(Boolean)].join("\n");
}

/** Pagina host per un formato: tema + CSS scene + `#root`. Il render imposta `#root.innerHTML = renderFrame(...)`. */
export function hostHtml(format: FormatId, fontBaseUrl = "/"): string {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>scene</title><style>${themeCss(format, fontBaseUrl)}\n${scenesCss()}\nhtml,body{margin:0;overflow:hidden}</style></head><body><div id="root"></div></body></html>`;
}
