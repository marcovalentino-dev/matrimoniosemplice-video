import { z } from "zod";
import type { Brief } from "../schemas/brief.ts";
import { ShotSchema, StoryboardSchema, type Shot, type Storyboard } from "../schemas/storyboard.ts";
import { EngineError } from "../utils/errors.ts";
import type { Fact } from "./facts.ts";
import { extractJson, type LlmFn } from "./llm.ts";
import { lintStoryboard, type LintIssue } from "./lint.ts";
import { compactCatalog, RULES, SYSTEM_PROMPT, type DirectorConfig } from "./prompt.ts";

/** Un problema segnalato dalla QA su uno shot, da passare al regista. */
export interface ShotProblem {
  shot: string;
  severity: "major" | "minor";
  what: string;
  fix?: string;
}

export interface FixInput {
  brief: Brief;
  storyboard: Storyboard;
  facts: Fact[];
  factsMd: string;
  config: DirectorConfig;
  /** Shot da correggere: tutti gli altri restano com'erano. */
  shots: string[];
  problems: ShotProblem[];
  llm: LlmFn;
  /** Tentativi per giro (il secondo riceve gli errori del lint). */
  attempts?: number;
}

export interface FixResult {
  storyboard: Storyboard;
  /** Shot davvero cambiati rispetto a prima. */
  changed: string[];
  /** True se è cambiato un testo a schermo (nuova approvazione, SPEC §8.2). */
  textChanged: boolean;
  attempts: number;
}

const FixOutputSchema = z.object({ shots: z.array(ShotSchema).min(1) });

const FIX_SPEC = `FORMATO DELLA RISPOSTA (solo JSON):
{ "shots": [ { ...lo shot COMPLETO corretto, stessa forma degli shot dello storyboard... } ] }
- Restituisci SOLO gli shot elencati in "SHOT DA CORREGGERE", ognuno con lo stesso "id", lo stesso "start" e lo stesso "end" (i timecode non si toccano: gli altri shot restano dove sono).
- Puoi cambiare props, testi, transizione, camera, note. Non puoi cambiare scena con una fuori catalogo né usare testi non verificabili.
- Se cambi un testo, aggiornalo anche in onScreenText con la sua source.
- Correggi i problemi elencati senza introdurne altri; se un problema chiede più spazio per il testo, accorcia il testo o usa una scena più adatta (stessa durata).`;

const textsOf = (s: Shot) => JSON.stringify(s.onScreenText.map((t) => t.text));

function buildFixPrompt(i: FixInput, retry?: { previous: string; issues: (LintIssue | string)[] }): string {
  const target = i.storyboard.shots.filter((s) => i.shots.includes(s.id));
  const context = i.storyboard.shots.map((s) => ({ id: s.id, start: s.start, end: s.end, scene: s.scene, testi: s.onScreenText.map((t) => t.text) }));
  const problems = i.problems.map((p) => `- [${p.shot}] (${p.severity}) ${p.what}${p.fix ? ` — correzione suggerita: ${p.fix}` : ""}`).join("\n");
  const factIds = i.facts.map((f) => `- ${f.id} — ${f.text}${f.kind === "funzione" ? ` [${f.plan}]` : ""}`).join("\n");
  const rules = RULES.replace("{MIN}", String(i.config.durationSec.min)).replace("{MAX}", String(i.config.durationSec.max));
  const parts = [
    `# CONTESTO\nIl video è già stato renderizzato e controllato dalla QA: alcuni shot hanno problemi. Correggi solo quelli.\n\n## Brief\n${JSON.stringify(i.brief, null, 1)}\n\n## Storyboard attuale (vista d'insieme)\n${JSON.stringify(context, null, 1)}`,
    `# PROBLEMI TROVATI DALLA QA\n${problems}`,
    `# SHOT DA CORREGGERE (JSON completo attuale)\n${JSON.stringify(target, null, 1)}`,
    `# ID DEI FATTI CITABILI\n${factIds}`,
    `# PRODOTTO_FATTI.md (unica fonte di funzioni e claim)\n${i.factsMd}`,
    `# CATALOGO SCENE (unico vocabolario)\n${JSON.stringify(compactCatalog(), null, 1)}`,
    rules,
    FIX_SPEC,
  ];
  if (retry) {
    const list = retry.issues.map((x) => `- ${typeof x === "string" ? x : x.msg}`).join("\n");
    parts.push(`# CORREZIONE\nLa tua risposta precedente è stata respinta:\n${list}\n\nRisposta precedente:\n${retry.previous}\n\nRiscrivi l'intero JSON correggendo questi errori.`);
  }
  return parts.join("\n\n");
}

/**
 * Giro di correzione (SPEC §8.2): il regista riceve SOLO gli shot indicati e i loro problemi; il codice
 * sostituisce solo quelli (id e timecode restano), rilancia il lint dell'intero storyboard e rifiuta ciò che non passa.
 */
export async function fixShots(i: FixInput): Promise<FixResult> {
  const known = new Set(i.storyboard.shots.map((s) => s.id));
  const unknown = i.shots.filter((id) => !known.has(id));
  if (unknown.length) throw new EngineError("E_SCHEMA", `Shot inesistenti da correggere: ${unknown.join(", ")}.`);
  const attempts = Math.max(1, i.attempts ?? 2);

  let retry: { previous: string; issues: (LintIssue | string)[] } | undefined;
  let last: (LintIssue | string)[] = [];
  for (let n = 1; n <= attempts; n++) {
    const raw = await i.llm({ system: SYSTEM_PROMPT, prompt: buildFixPrompt(i, retry) });
    const issues: (LintIssue | string)[] = [];
    try {
      const out = FixOutputSchema.safeParse(extractJson(raw));
      if (!out.success) issues.push(...out.error.issues.map((x) => `JSON non valido — ${x.path.join(".") || "(radice)"}: ${x.message}`));
      else {
        const byId = new Map(out.data.shots.map((s) => [s.id, s]));
        for (const id of i.shots) if (!byId.has(id)) issues.push(`manca lo shot ${id} nella risposta.`);
        for (const id of byId.keys()) if (!i.shots.includes(id)) issues.push(`lo shot ${id} non era da correggere: restituisci solo ${i.shots.join(", ")}.`);
        for (const s of i.storyboard.shots) {
          const n2 = byId.get(s.id);
          if (n2 && (Math.abs(n2.start - s.start) > 0.005 || Math.abs(n2.end - s.end) > 0.005))
            issues.push(`${s.id}: start/end devono restare ${s.start}–${s.end} (trovato ${n2.start}–${n2.end}).`);
        }
        if (!issues.length) {
          const merged = StoryboardSchema.parse({ ...i.storyboard, shots: i.storyboard.shots.map((s) => byId.get(s.id) ?? s) });
          const lint = lintStoryboard({ brief: i.brief, storyboard: merged, facts: i.facts });
          if (lint.errors.length) issues.push(...lint.errors);
          else {
            const changed = i.storyboard.shots.filter((s) => byId.has(s.id) && JSON.stringify(byId.get(s.id)) !== JSON.stringify(s));
            const textChanged = changed.some((s) => textsOf(s) !== textsOf(byId.get(s.id)!));
            return { storyboard: merged, changed: changed.map((s) => s.id), textChanged, attempts: n };
          }
        }
      }
    } catch (e) {
      if (e instanceof EngineError) throw e;
      issues.push(`JSON non valido — ${(e as Error).message}`);
    }
    last = issues;
    retry = { previous: raw, issues };
  }
  throw new EngineError("E_SCHEMA", `Correzione degli shot ${i.shots.join(", ")} non valida dopo ${attempts} tentativi:\n${last.map((x) => `- ${typeof x === "string" ? x : x.msg}`).join("\n")}`);
}
