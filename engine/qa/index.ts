import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fixShots, type ShotProblem } from "../director/fix.ts";
import { loadFacts } from "../director/facts.ts";
import { claudeCli, type LlmFn, type LlmUsage } from "../director/llm.ts";
import { probe } from "../render/probe.ts";
import { BriefSchema, type Brief } from "../schemas/brief.ts";
import { StoryboardSchema, type Storyboard } from "../schemas/storyboard.ts";
import { ROOT } from "../theme/tokens.ts";
import { EngineError } from "../utils/errors.ts";
import { checkProbe, type ProbeCheck, type Severity } from "./check.ts";
import { extractFrames, scanBlack, type FrameSet } from "./frames.ts";
import { CRITERIA, reviewVideo, type Criterion, type Review } from "./review.ts";

export { checkProbe } from "./check.ts";
export { extractFrames, scanBlack, shotAt, stillTimes } from "./frames.ts";
export { buildReviewPrompt, reviewVideo, ReviewSchema, CRITERIA } from "./review.ts";

const ENGINE = path.join(ROOT, "engine");
/** Fine anticipata con verdetto "fail": il testo è la ragione, che E_QA_BLOCKER riporta una volta sola. */
class Blocker extends Error {}

/** Sotto questo voto un criterio vale da solo come problema grave (anche senza una voce in "issues"). */
const FAIL_BELOW = 4;

export interface QaIssue {
  source: "probe" | "pixel" | "review";
  severity: Severity;
  /** Id dello shot, oppure "global" (non rigenerabile con un giro di correzione). */
  shot: string;
  criterion: string;
  t?: number;
  what: string;
  fix?: string;
}

export interface QaShot {
  id: string;
  scene: string;
  start: number;
  end: number;
  /** 0-100, dal revisore. */
  score: number | null;
  note: string;
  issues: QaIssue[];
}

export interface QaRound {
  round: number;
  verdict: "pass" | "warn" | "fail";
  score: number | null;
  regenerate: string[];
  issues: number;
  /** Cosa ha fatto il giro di correzione dopo questa valutazione (assente nell'ultimo). */
  fixed?: { shots: string[]; changed: string[]; textChanged: boolean } | { error: string };
  evidence: string;
}

export interface QaReport {
  version: 1;
  generatedAt: string;
  video: string;
  storyboard: string;
  /** Ultima valutazione (1 = il video originale, 2+ = dopo i giri di correzione). */
  round: number;
  maxRounds: number;
  verdict: "pass" | "warn" | "fail" | "error";
  /** 0-100: media dei voti della rubrica (senza il revisore: null). */
  score: number | null;
  probe: (Omit<ProbeCheck, "actual"> & { durationSec: number; w: number; h: number; fps: number; vcodec: string; pixFmt: string; acodec: string | null; sampleRate: number | null; frames: number | null }) | null;
  review: { model: string; scores: Record<string, number>; summary: string; contactSheets: string[]; stills: string[] } | null;
  issues: QaIssue[];
  shots: QaShot[];
  regenerate: string[];
  rounds: QaRound[];
  /** Una correzione ha cambiato un testo a schermo: serve una nuova approvazione (manuale o auto, SPEC §16). */
  needsReapproval: boolean;
  warnings: string[];
  calls: number;
  cost: { usd: number; inputTokens: number; outputTokens: number };
  error: { code: string; message: string } | null;
}

export interface QaOptions {
  /** `video.mp4` oppure la cartella che lo contiene (con storyboard.json e brief.json). */
  input: string;
  storyboardFile?: string;
  root?: string;
  maxRounds?: number;
  maxCalls?: number;
  /** Se false: un solo giro, solo il verdetto. Default true. */
  fix?: boolean;
  /** Se il verdetto è "fail", sposta il video in `.work/FAILED-QA.mp4` (SPEC §9). Default true. */
  quarantine?: boolean;
  workers?: number;
  /** Chiamata al modello (revisione e correzione); default `claude -p` con sola lettura. */
  llm?: LlmFn;
  /** Rigenera il video da uno storyboard modificato: ritorna il file del video. Default: `renderStoryboard`. */
  render?: (storyboardFile: string, outDir: string) => Promise<string>;
  progress?: (msg: string) => void;
}

export interface QaResult {
  report: QaReport;
  reportFile: string;
  videoFile: string;
}

interface EngineConfig {
  maxCalls: number;
  maxRounds: number;
  durationSec: { min: number; max: number };
  formats: Record<string, { w: number; h: number; fps: number }>;
}

const rel = (base: string, f: string) => path.relative(base, f).split(path.sep).join("/");

function findVideo(input: string): { outDir: string; video: string } {
  if (!existsSync(input)) throw new EngineError("E_SCHEMA", `Non trovo ${input}.`);
  if (statSync(input).isFile()) return { outDir: path.dirname(input), video: input };
  for (const n of ["video.mp4", "video-DRAFT.mp4"]) if (existsSync(path.join(input, n))) return { outDir: input, video: path.join(input, n) };
  throw new EngineError("E_SCHEMA", `In ${input} non c'è video.mp4 né video-DRAFT.mp4: renderizza prima (npm run render).`);
}

function loadStoryboard(file: string): Storyboard {
  const p = StoryboardSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!p.success) throw new EngineError("E_SCHEMA", `${file}: ${p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return p.data;
}

async function defaultRender(workers: number | undefined) {
  const { renderStoryboard } = await import("../render/index.ts");
  return async (sbFile: string, outDir: string): Promise<string> => {
    const r = await renderStoryboard({ input: sbFile, outDir, workers });
    if (!r.videoFile) throw new EngineError("E_ENCODE", "Il render non ha prodotto il video.");
    return r.videoFile;
  };
}

/** Voci della rubrica + pixel + ffprobe → elenco unico di problemi, con la gravità. */
function collectIssues(pc: ProbeCheck, black: { shot: string; t: number; fraction: number }[], review: Review | null): QaIssue[] {
  const issues: QaIssue[] = [];
  for (const p of pc.problems) issues.push({ source: "probe", severity: p.severity, shot: "global", criterion: "ffprobe", what: p.what });
  const byShot = new Map<string, { t: number[]; max: number }>();
  for (const b of black) {
    const e = byShot.get(b.shot) ?? { t: [], max: 0 };
    e.t.push(b.t);
    e.max = Math.max(e.max, b.fraction);
    byShot.set(b.shot, e);
  }
  for (const [shot, e] of byShot)
    issues.push({
      source: "pixel", severity: "major", shot, criterion: "neroPuro", t: e.t[0],
      what: `pixel neri puri #000000 fino al ${(e.max * 100).toFixed(1)}% del fotogramma (a ${e.t.slice(0, 4).join(", ")} s)`,
      fix: "sostituire il nero con ink #1E1E1E (testi, ombre, sfondi)",
    });
  if (review) {
    for (const x of review.issues) issues.push({ source: "review", severity: x.severity, shot: x.shot, criterion: x.criterion, t: x.t, what: x.what, fix: x.fix || undefined });
    for (const c of Object.keys(CRITERIA) as Criterion[]) {
      const v = review.scores[c];
      if (v < FAIL_BELOW && !issues.some((i) => i.severity === "major" && i.criterion === c))
        issues.push({ source: "review", severity: "major", shot: "global", criterion: c, what: `voto ${v}/10 su "${c}" senza un problema indicato su uno shot: ${CRITERIA[c]}` });
    }
  }
  return issues;
}

function verdictOf(issues: QaIssue[]): "pass" | "warn" | "fail" {
  if (issues.some((i) => i.severity === "major")) return "fail";
  return issues.length ? "warn" : "pass";
}

const regenerateOf = (issues: QaIssue[]) => [...new Set(issues.filter((i) => i.severity === "major" && i.shot !== "global").map((i) => i.shot))];

function describe(i: QaIssue): string {
  return `[${i.shot}] ${i.criterion}${i.t !== undefined ? ` @${i.t}s` : ""}: ${i.what}${i.fix ? ` (correzione: ${i.fix})` : ""}`;
}

/** Aggiorna `manifest.json` accanto al video con l'esito della QA. */
function updateManifest(outDir: string, report: QaReport, failed: boolean): void {
  const f = path.join(outDir, "manifest.json");
  if (!existsSync(f)) return;
  try {
    const m = JSON.parse(readFileSync(f, "utf8"));
    m.qa = { verdict: report.verdict, score: report.score, rounds: report.round, report: "qa-report.json" };
    if (failed) m.status = "failed";
    writeFileSync(f, JSON.stringify(m, null, 2) + "\n");
  } catch {
    /* il manifest è un di più: la QA non deve fallire per questo */
  }
}

/**
 * QA dopo il render (SPEC §8.2, livelli 6a, 6c e 6d), con giri di correzione:
 * (1) ffprobe contro il brief; (2) fotogrammi ogni secondo, contact sheet, still e scansione del nero puro;
 * (3) revisione di Claude con la rubrica; (4) `qa-report.json`; (5) se ci sono problemi gravi su shot precisi,
 * il regista corregge solo quelli, si ri-renderizzano (blocchi in cache) e si rifà la QA, al massimo `maxRounds` giri;
 * (6) se resta qualcosa di grave: E_QA_BLOCKER con la spiegazione. Non c'è successo senza video e report.
 */
export async function runQa(opts: QaOptions): Promise<QaResult> {
  const root = opts.root ?? ROOT;
  const cfg = JSON.parse(readFileSync(path.join(root, "engine", "engine.config.json"), "utf8")) as EngineConfig;
  const maxRounds = opts.maxRounds ?? cfg.maxRounds;
  const maxCalls = opts.maxCalls ?? cfg.maxCalls;
  const say = opts.progress ?? (() => {});

  const found = findVideo(path.resolve(opts.input));
  const outDir = found.outDir;
  let video = found.video;
  const sbFile = path.resolve(opts.storyboardFile ?? path.join(outDir, "storyboard.json"));
  if (!existsSync(sbFile)) throw new EngineError("E_SCHEMA", `Serve lo storyboard per giudicare shot per shot: ${sbFile} non esiste (usa --storyboard).`);
  const briefFile = path.join(path.dirname(sbFile), "brief.json");
  let brief: Brief | null = null;
  if (existsSync(briefFile)) {
    const b = BriefSchema.safeParse(JSON.parse(readFileSync(briefFile, "utf8")));
    if (!b.success) throw new EngineError("E_SCHEMA", `${briefFile}: ${b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    brief = b.data;
  }
  let sb = loadStoryboard(sbFile);
  const manifestFile = path.join(outDir, "manifest.json");
  const manifest = existsSync(manifestFile) ? (JSON.parse(readFileSync(manifestFile, "utf8")) as { audio?: { reason?: string | null } }) : null;

  const { md: factsMd, facts } = loadFacts(path.join(root, "brand", "PRODOTTO_FATTI.md"));
  const brandMd = readFileSync(path.join(root, "brand", "BRAND_VIDEO.md"), "utf8");

  const usage: LlmUsage = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const base =
    opts.llm ??
    claudeCli({
      cwd: root,
      tools: ["Read"],
      addDirs: [outDir],
      timeoutMs: 600000,
      onUsage: (u) => {
        usage.inputTokens += u.inputTokens ?? 0;
        usage.outputTokens += u.outputTokens ?? 0;
        usage.costUsd += u.costUsd ?? 0;
      },
    });
  const llm: LlmFn = async (req) => {
    if (usage.calls >= maxCalls) throw new EngineError("E_BUDGET", `Chiamate al modello: ${usage.calls}/${maxCalls}.`);
    usage.calls++;
    return base(req);
  };

  const canFix = opts.fix !== false;
  const render = opts.render ?? (await defaultRender(opts.workers));
  const reportFile = path.join(outDir, "qa-report.json");
  const rounds: QaRound[] = [];
  const warnings: string[] = [];
  let needsReapproval = false;
  let last: Partial<QaReport> = {};
  let evaluation = 0;

  const writeReport = (extra: Partial<QaReport>): QaReport => {
    const report: QaReport = {
      version: 1,
      generatedAt: new Date().toISOString(),
      video: rel(outDir, video),
      storyboard: rel(outDir, sbFile),
      round: evaluation,
      maxRounds,
      verdict: "error",
      score: null,
      probe: null,
      review: null,
      issues: [],
      shots: [],
      regenerate: [],
      rounds,
      needsReapproval,
      warnings,
      calls: usage.calls,
      cost: { usd: Math.round(usage.costUsd * 10000) / 10000, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      error: null,
      ...last,
      ...extra,
    };
    writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
    return report;
  };

  try {
    for (;;) {
      evaluation++;
      const evidenceDir = path.join(outDir, "qa", `round-${evaluation}`);
      mkdirSync(evidenceDir, { recursive: true });
      say(`QA giro ${evaluation}: ffprobe`);

      // (1) ffprobe contro il brief (o, senza brief, contro lo storyboard)
      const p = probe(video);
      const expected = brief
        ? { durationSec: brief.durationSec, toleranceSec: 0.1, w: brief.size.w, h: brief.size.h, fps: brief.fps, audio: brief.audio, from: "brief.json" as const }
        : { durationSec: sb.durationSec, toleranceSec: 0.1, w: sb.size.w, h: sb.size.h, fps: sb.fps, audio: (p.acodec ? "synth" : "none") as "none" | "synth", from: "storyboard.json" as const };
      const pc = checkProbe(p, expected, manifest?.audio?.reason);
      const { actual, ...pcRest } = pc;
      const probeSection: QaReport["probe"] = { ...pcRest, durationSec: actual.durationSec, w: actual.w, h: actual.h, fps: actual.fps, vcodec: actual.vcodec, pixFmt: actual.pixFmt, acodec: actual.acodec, sampleRate: actual.sampleRate, frames: actual.frames };

      let frames: FrameSet | null = null;
      let black: Awaited<ReturnType<typeof scanBlack>> = [];
      let review: Review | null = null;
      if (pc.ok) {
        // (2) fotogrammi, contact sheet, still, nero puro
        say(`QA giro ${evaluation}: fotogrammi, contact sheet e pixel`);
        frames = await extractFrames({ video, sb, dir: evidenceDir });
        black = await scanBlack({ video, sb });
        // (3) revisione di Claude con la rubrica
        say(`QA giro ${evaluation}: revisione di Claude (${frames.sheets.length} contact sheet, ${frames.stills.length} still)`);
        review = await reviewVideo({
          brief: brief ?? { goal: "(brief.json assente)", message: "(brief.json assente)", claims: [], cta: { label: "", url: "", approved: false }, tone: "caldo, elegante", format: sb.format, durationSec: sb.durationSec, audience: "coppie italiane" },
          storyboard: sb, factsMd, brandMd, frames, llm,
        });
      } else {
        warnings.push(`giro ${evaluation}: ffprobe ha trovato problemi gravi, revisione LLM saltata (rigenerare gli shot non li risolve).`);
      }

      const issues = collectIssues(pc, black, review);
      const verdict = verdictOf(issues);
      const regenerate = regenerateOf(issues);
      const score = review ? Math.round((Object.values(review.scores).reduce((a, b) => a + b, 0) / Object.keys(review.scores).length) * 100) / 10 : null;
      const shots: QaShot[] = sb.shots.map((s) => {
        const r = review?.shots.find((x) => x.id === s.id);
        return { id: s.id, scene: s.scene, start: s.start, end: s.end, score: r ? Math.round(r.score * 10) : null, note: r?.note ?? "", issues: issues.filter((i) => i.shot === s.id) };
      });
      last = {
        probe: probeSection,
        review: review && frames ? { model: "claude (claude -p)", scores: review.scores, summary: review.summary, contactSheets: frames.sheets.map((s) => rel(outDir, s.file)), stills: frames.stills.map((s) => rel(outDir, s.file)) } : null,
        score, issues, shots, regenerate, verdict,
      };
      const rd: QaRound = { round: evaluation, verdict, score, regenerate, issues: issues.length, evidence: rel(outDir, evidenceDir) };
      rounds.push(rd);
      writeReport({});
      say(`QA giro ${evaluation}: ${verdict}${score !== null ? `, voto ${score}/100` : ""}${regenerate.length ? `, shot da rigenerare: ${regenerate.join(", ")}` : ""}`);

      if (verdict !== "fail") break;
      const globalMajor = issues.filter((i) => i.severity === "major" && i.shot === "global");
      const fixRoundsDone = evaluation - 1;
      if (!canFix || !regenerate.length || fixRoundsDone >= maxRounds) {
        const why = !canFix ? "correzione disattivata" : !regenerate.length ? `restano solo problemi che non si risolvono rigenerando uno shot${globalMajor.length ? " (globali o di ffprobe)" : ""}` : `giri di correzione esauriti (${maxRounds})`;
        throw new Blocker(why);
      }

      // (5) rigenera solo gli shot indicati, ri-renderizza e rifà la QA
      const problems: ShotProblem[] = issues.filter((i) => regenerate.includes(i.shot)).map((i) => ({ shot: i.shot, severity: i.severity, what: `${i.criterion}${i.t !== undefined ? ` @${i.t}s` : ""}: ${i.what}`, fix: i.fix }));
      say(`Giro di correzione ${fixRoundsDone + 1}/${maxRounds}: il regista rivede ${regenerate.join(", ")}`);
      let fixed;
      try {
        fixed = await fixShots({
          brief: brief ?? BriefSchema.parse({ version: 1, slug: "senza-brief", prompt: "-", goal: "-", format: sb.format, size: sb.size, fps: sb.fps, durationSec: sb.durationSec, audience: "-", message: "-", claims: [], cta: { label: "Crea il tuo sito matrimonio", url: "www.matrimoniosemplice.com", approved: true }, tone: "-", loop: false, audio: "none", needsFromUser: [], assumptions: [] }),
          storyboard: sb, facts, factsMd, config: cfg, shots: regenerate, problems, llm,
        });
      } catch (e) {
        if (e instanceof EngineError && e.code === "E_SCHEMA") {
          rd.fixed = { error: e.message };
          writeReport({});
          throw new Blocker(`il regista non è riuscito a correggere ${regenerate.join(", ")}: ${e.message}`);
        }
        throw e;
      }
      rd.fixed = { shots: regenerate, changed: fixed.changed, textChanged: fixed.textChanged };
      if (fixed.textChanged) {
        needsReapproval = true;
        warnings.push(`giro ${fixRoundsDone + 1}: cambiato il testo a schermo di ${fixed.changed.join(", ")}: serve una nuova approvazione dello storyboard (o auto-approve con lint pulito, SPEC §16).`);
      }
      if (!fixed.changed.length) warnings.push(`giro ${fixRoundsDone + 1}: il regista ha restituito gli shot ${regenerate.join(", ")} identici a prima.`);
      const backup = path.join(outDir, "qa", "storyboard.before-qa.json");
      if (!existsSync(backup)) copyFileSync(sbFile, backup);
      writeFileSync(sbFile, JSON.stringify(fixed.storyboard, null, 2) + "\n");
      sb = fixed.storyboard;
      say(`Ri-render (solo i blocchi cambiati) di ${fixed.changed.join(", ") || "nessuno shot"}`);
      video = await render(sbFile, outDir);
    }

    const report = writeReport({});
    updateManifest(outDir, report, false);
    if (!existsSync(video) || !existsSync(reportFile) || !report.probe) throw new Blocker("mancano il video o il report: nessun successo senza file e report");
    return { report, reportFile, videoFile: video };
  } catch (e) {
    if (e instanceof Blocker) {
      const majors = (last.issues ?? []).filter((i) => i.severity === "major");
      const report = writeReport({ verdict: "fail", error: { code: "E_QA_BLOCKER", message: e.message } });
      let where = video;
      if (opts.quarantine !== false && existsSync(video)) {
        where = path.join(outDir, ".work", "FAILED-QA.mp4");
        mkdirSync(path.dirname(where), { recursive: true });
        rmSync(where, { force: true });
        renameSync(video, where);
      }
      updateManifest(outDir, report, true);
      const list = majors.map((i) => `  - ${describe(i)}`).join("\n");
      throw new EngineError("E_QA_BLOCKER", `${e.message}.\nProblemi gravi rimasti:\n${list || "  (nessuno elencato)"}\nVideo non consegnato${opts.quarantine !== false ? `, tenuto in ${where}` : ""}. Dettagli: ${reportFile}`);
    }
    if (e instanceof EngineError) {
      const report = writeReport({ verdict: "error", error: { code: e.code, message: e.message } });
      updateManifest(outDir, report, false);
    }
    throw e;
  }
}
