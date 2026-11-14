import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { probe } from "../render/probe.ts";
import { checkProbe, extractFrames, runQa, scanBlack, stillTimes, buildReviewPrompt, type QaOptions } from "../qa/index.ts";
import { StoryboardSchema } from "../schemas/storyboard.ts";
import { EngineError } from "../utils/errors.ts";
import { REVIEW_SYSTEM } from "../qa/review.ts";
import fixture from "./fixtures/storyboard-10s.json" with { type: "json" };

const tmp = mkdtempSync(path.join(os.tmpdir(), "ms-qa-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** La fixture del render con l'URL dichiarato in onScreenText: col brief di test il lint dello storyboard è pulito. */
const fixture0 = JSON.parse(JSON.stringify(fixture));
fixture0.shots[1].onScreenText.push({ text: "www.matrimoniosemplice.com", role: "label", source: { kind: "cta" } });
delete fixture0.music;
const sb = StoryboardSchema.parse(fixture0);
const brief = {
  version: 1, slug: "qa-test", prompt: "p", goal: "g", format: "9:16" as const, size: { w: 1080, h: 1920 }, fps: 30, durationSec: 10,
  audience: "a", message: "m", claims: [], cta: { label: "Crea il tuo sito matrimonio", url: "www.matrimoniosemplice.com", approved: true },
  tone: "caldo", loop: false, audio: "none" as const, needsFromUser: [], assumptions: [],
};

/** Video H.264 di test: sfondo cream, con un riquadro del colore dato nel primo shot (se richiesto). */
function makeVideo(file: string, opts: { box?: string; dur?: number } = {}): string {
  const dur = opts.dur ?? 10;
  const vf = opts.box ? `drawbox=x=100:y=300:w=400:h=400:color=${opts.box}:t=fill:enable='lt(t,5)'` : "null";
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=0xFFF8F5:s=1080x1920:r=30:d=${dur}`, "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", file]);
  if (r.status !== 0) throw new Error(String(r.stderr));
  return file;
}

function workdir(name: string, video: { box?: string; dur?: number } = {}): string {
  const dir = path.join(tmp, name);
  spawnSync("node", ["-e", `require('fs').mkdirSync(${JSON.stringify(dir)},{recursive:true})`]);
  writeFileSync(path.join(dir, "storyboard.json"), JSON.stringify(fixture0, null, 2));
  writeFileSync(path.join(dir, "brief.json"), JSON.stringify(brief, null, 2));
  makeVideo(path.join(dir, "video.mp4"), video);
  return dir;
}

const scores = (v: number) => ({ leggibilita: v, safeArea: v, brand: v, neroPuro: v, coerenza: v, nessunTaglio: v, ritmo: v, claim: v });
const review = (issues: unknown[] = [], v = 8) => JSON.stringify({ scores: scores(v), shots: [{ id: "s1", score: v, note: "ok" }, { id: "s2", score: v, note: "ok" }], issues, summary: "giudizio" });
const major = (shot = "s1") => ({ shot, severity: "major", criterion: "leggibilita", t: 3, what: "testo troppo piccolo", fix: "ingrandire" });
const fixResponse = (changeText = false) => {
  const s1 = JSON.parse(JSON.stringify(fixture0.shots[0]));
  s1.notes = "corretto";
  if (changeText) {
    s1.props.headline = "Nessuna app.\nNessun *account.*";
    s1.onScreenText[1].text = "Nessuna app. Nessun account.";
  }
  return JSON.stringify({ shots: [s1] });
};

/** Revisore e regista finti: `reviews` è la coda di risposte del revisore, `fixes` quella del regista. */
function fakeLlm(reviews: string[], fixes: string[] = [fixResponse()]) {
  const calls: { kind: "review" | "fix"; prompt: string }[] = [];
  const llm: QaOptions["llm"] = async ({ system, prompt }) => {
    const kind = system === REVIEW_SYSTEM ? "review" : "fix";
    calls.push({ kind, prompt });
    const q = kind === "review" ? reviews : fixes;
    return q.length > 1 ? q.shift()! : q[0]!;
  };
  return { llm, calls };
}

describe("ffprobe contro il brief", () => {
  const exp = { durationSec: 10, toleranceSec: 0.1, w: 1080, h: 1920, fps: 30, audio: "none" as const, from: "brief.json" as const };
  const ok = { durationSec: 10, w: 1080, h: 1920, fps: 30, vcodec: "h264", pixFmt: "yuv420p", acodec: null, sampleRate: null, audioDurationSec: null, frames: 300 };
  it("accetta un file conforme", () => expect(checkProbe(ok, exp).ok).toBe(true));
  it("segnala durata, risoluzione, fps, codec e fotogrammi", () => {
    const c = checkProbe({ ...ok, durationSec: 9.5, w: 540, fps: 15, vcodec: "vp9", frames: 150 }, exp);
    expect(c.ok).toBe(false);
    expect(c.problems.length).toBe(5);
  });
  it("audio: none con una traccia presente è grave", () => expect(checkProbe({ ...ok, acodec: "aac", sampleRate: 48000 }, exp).ok).toBe(false));
  it("audio atteso ma file muto: solo avviso, con il motivo", () => {
    const c = checkProbe(ok, { ...exp, audio: "synth" }, "libreria vuota");
    expect(c.ok).toBe(true);
    expect(c.problems[0]!.severity).toBe("minor");
    expect(c.problems[0]!.what).toContain("libreria vuota");
  });
});

describe("fotogrammi e pixel", { timeout: 120000 }, () => {
  it("still: uno per shot, al 60%; con troppi shot li distribuisce", () => {
    expect(stillTimes(sb, 8)).toEqual([{ t: 3, shot: "s1" }, { t: 8, shot: "s2" }]);
    const many = { shots: Array.from({ length: 12 }, (_, i) => ({ ...sb.shots[0]!, id: `s${i + 1}`, start: i, end: i + 1 })) };
    const t = stillTimes(many, 8);
    expect(t.length).toBe(8);
    expect(t[0]!.shot).toBe("s1");
    expect(t[7]!.shot).toBe("s12");
  });
  it("con più di 16 fotogrammi (video da 20 s) produce due contact sheet senza errori", async () => {
    const dir = workdir("frames20", { dur: 20 });
    const f = await extractFrames({ video: path.join(dir, "video.mp4"), sb: { ...sb, durationSec: 20 }, dir: path.join(dir, "ev") });
    expect(f.frames.length).toBe(20);
    expect(f.sheets.map((s) => [s.from, s.to])).toEqual([[0, 15], [16, 19]]);
  });
  it("estrae un fotogramma al secondo, il contact sheet e gli still", async () => {
    const dir = workdir("frames");
    const f = await extractFrames({ video: path.join(dir, "video.mp4"), sb, dir: path.join(dir, "ev") });
    expect(f.frames.length).toBe(10);
    expect(f.frames[4]!.shot).toBe("s1");
    expect(f.frames[5]!.shot).toBe("s2");
    expect(f.sheets.length).toBe(1);
    expect(f.stills.map((s) => s.shot)).toEqual(["s1", "s2"]);
    for (const x of [f.sheets[0]!.file, ...f.stills.map((s) => s.file)]) expect(existsSync(x)).toBe(true);
  });
  it("trova il nero puro e lo attribuisce allo shot giusto; #1E1E1E non è nero", async () => {
    const dir = workdir("black", { box: "black" });
    const hits = await scanBlack({ video: path.join(dir, "video.mp4"), sb });
    expect(hits.length).toBeGreaterThan(0);
    expect(new Set(hits.map((h) => h.shot))).toEqual(new Set(["s1"]));
    const ink = workdir("ink", { box: "0x1E1E1E" });
    expect(await scanBlack({ video: path.join(ink, "video.mp4"), sb })).toEqual([]);
  });
  it("il prompt di revisione contiene rubrica, safe area, shot, fatti e percorsi delle immagini", async () => {
    const dir = workdir("prompt");
    const frames = await extractFrames({ video: path.join(dir, "video.mp4"), sb, dir: path.join(dir, "ev") });
    const p = buildReviewPrompt({ brief, storyboard: sb, factsMd: "FATTI-XYZ", brandMd: "BRAND-XYZ", frames });
    for (const s of ["safeArea", "neroPuro", "alto 220", "FATTI-XYZ", "BRAND-XYZ", "s2", frames.sheets[0]!.file, frames.stills[0]!.file]) expect(p).toContain(s);
  });
});

describe("giri di QA", { timeout: 180000 }, () => {
  const base = (dir: string, llm: QaOptions["llm"], extra: Partial<QaOptions> = {}): QaOptions => ({
    input: dir, llm, root: path.resolve(import.meta.dirname, "..", ".."),
    render: async (_sb, out) => makeVideo(path.join(out, "video.mp4")),
    ...extra,
  });

  it("video pulito al primo giro: pass, report e voti per shot", async () => {
    const dir = workdir("pass");
    const { llm, calls } = fakeLlm([review()]);
    const r = await runQa(base(dir, llm));
    expect(r.report.verdict).toBe("pass");
    expect(r.report.round).toBe(1);
    expect(r.report.score).toBe(80);
    expect(r.report.shots.map((s) => s.score)).toEqual([80, 80]);
    expect(r.report.probe!.ok).toBe(true);
    expect(calls.length).toBe(1);
    const saved = JSON.parse(readFileSync(r.reportFile, "utf8"));
    expect(saved.verdict).toBe("pass");
    expect(saved.review.contactSheets.length).toBe(1);
    expect(existsSync(r.videoFile)).toBe(true);
  });

  it("solo problemi minori: warn, nessun giro di correzione", async () => {
    const dir = workdir("warn");
    const { llm, calls } = fakeLlm([review([{ ...major(), severity: "minor" }])]);
    const r = await runQa(base(dir, llm));
    expect(r.report.verdict).toBe("warn");
    expect(r.report.regenerate).toEqual([]);
    expect(calls.map((c) => c.kind)).toEqual(["review"]);
  });

  it("problema grave su s1: rigenera solo s1, rifà la QA e passa", async () => {
    const dir = workdir("fix");
    const { llm, calls } = fakeLlm([review([major("s1")]), review()]);
    const r = await runQa(base(dir, llm));
    expect(calls.map((c) => c.kind)).toEqual(["review", "fix", "review"]);
    const fixPrompt = calls[1]!.prompt;
    expect(fixPrompt).toContain("testo troppo piccolo");
    expect(fixPrompt).toContain("SHOT DA CORREGGERE");
    expect(r.report.verdict).toBe("pass");
    expect(r.report.round).toBe(2);
    expect(r.report.rounds[0]!.regenerate).toEqual(["s1"]);
    expect(r.report.rounds[0]!.fixed).toMatchObject({ shots: ["s1"], changed: ["s1"], textChanged: false });
    const stored = JSON.parse(readFileSync(path.join(dir, "storyboard.json"), "utf8"));
    expect(stored.shots[0].notes).toBe("corretto");
    expect(stored.shots[1]).toEqual(fixture0.shots[1]);
    expect(existsSync(path.join(dir, "qa", "storyboard.before-qa.json"))).toBe(true);
    expect(r.report.needsReapproval).toBe(false);
  });

  it("se la correzione cambia un testo segnala la nuova approvazione", async () => {
    const dir = workdir("reapprove");
    const { llm } = fakeLlm([review([major("s1")]), review()], [fixResponse(true)]);
    const r = await runQa(base(dir, llm));
    expect(r.report.needsReapproval).toBe(true);
    expect(r.report.warnings.join(" ")).toMatch(/nuova approvazione/);
  });

  it("rifiuta una correzione che sposta i timecode e riprova con gli errori", async () => {
    const dir = workdir("timecode");
    const bad = JSON.parse(fixResponse());
    bad.shots[0].end = 4;
    const { llm, calls } = fakeLlm([review([major("s1")]), review()], [JSON.stringify(bad), fixResponse()]);
    const r = await runQa(base(dir, llm));
    expect(calls.filter((c) => c.kind === "fix").length).toBe(2);
    expect(calls[2]!.prompt).toContain("start/end devono restare");
    expect(r.report.verdict).toBe("pass");
  });

  it("dopo 3 giri di correzione con problemi ancora gravi esce con E_QA_BLOCKER, spiega e sposta il video", async () => {
    const dir = workdir("exhaust");
    const { llm, calls } = fakeLlm([review([major("s1")])]);
    const err = await runQa(base(dir, llm)).catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(err.code).toBe("E_QA_BLOCKER");
    expect(err.message).toMatch(/giri di correzione esauriti \(3\)/);
    expect(err.message).toContain("[s1] leggibilita @3s: testo troppo piccolo");
    expect(calls.filter((c) => c.kind === "review").length).toBe(4);
    expect(calls.filter((c) => c.kind === "fix").length).toBe(3);
    const rep = JSON.parse(readFileSync(path.join(dir, "qa-report.json"), "utf8"));
    expect(rep.verdict).toBe("fail");
    expect(rep.error.code).toBe("E_QA_BLOCKER");
    expect(rep.rounds.length).toBe(4);
    expect(existsSync(path.join(dir, "video.mp4"))).toBe(false);
    expect(existsSync(path.join(dir, ".work", "FAILED-QA.mp4"))).toBe(true);
  });

  it("il nero puro è un problema grave deterministico: lo shot viene rigenerato anche se il revisore non lo vede", async () => {
    const dir = workdir("blackfix", { box: "black" });
    const { llm, calls } = fakeLlm([review(), review()]);
    const r = await runQa(base(dir, llm));
    expect(calls.map((c) => c.kind)).toEqual(["review", "fix", "review"]);
    expect(calls[1]!.prompt).toContain("pixel neri puri");
    expect(r.report.rounds[0]!.regenerate).toEqual(["s1"]);
    expect(r.report.verdict).toBe("pass");
  });

  it("senza correzione (--no-fix) un problema grave dà subito E_QA_BLOCKER", async () => {
    const dir = workdir("nofix");
    const { llm, calls } = fakeLlm([review([major("s1")])]);
    const err = await runQa(base(dir, llm, { fix: false })).catch((e) => e);
    expect(err.code).toBe("E_QA_BLOCKER");
    expect(calls.length).toBe(1);
  });

  it("ffprobe fuori dal brief: blocco immediato, nessuna chiamata al modello", async () => {
    const dir = workdir("badprobe", { dur: 8 });
    const { llm, calls } = fakeLlm([review()]);
    const err = await runQa(base(dir, llm)).catch((e) => e);
    expect(err.code).toBe("E_QA_BLOCKER");
    expect(err.message).toContain("durata");
    expect(calls.length).toBe(0);
    expect(JSON.parse(readFileSync(path.join(dir, "qa-report.json"), "utf8")).probe.ok).toBe(false);
  });

  it("voto sotto 4 su un criterio senza problema indicato conta come grave globale (non rigenerabile)", async () => {
    const dir = workdir("lowscore");
    const raw = JSON.parse(review());
    raw.scores.ritmo = 2;
    const { llm } = fakeLlm([JSON.stringify(raw)]);
    const err = await runQa(base(dir, llm)).catch((e) => e);
    expect(err.code).toBe("E_QA_BLOCKER");
    expect(err.message).toContain("[global] ritmo");
  });

  it("tetto di chiamate: E_BUDGET, report con verdict error, il video non viene spostato", async () => {
    const dir = workdir("budget");
    const { llm } = fakeLlm([review([major("s1")])]);
    const err = await runQa(base(dir, llm, { maxCalls: 2 })).catch((e) => e);
    expect(err.code).toBe("E_BUDGET");
    const rep = JSON.parse(readFileSync(path.join(dir, "qa-report.json"), "utf8"));
    expect(rep.verdict).toBe("error");
    expect(existsSync(path.join(dir, "video.mp4"))).toBe(true);
  });

  it("revisione non valida: la richiede di nuovo, poi E_SCHEMA e report", async () => {
    const dir = workdir("badjson");
    const { llm, calls } = fakeLlm(["non è json"]);
    const err = await runQa(base(dir, llm)).catch((e) => e);
    expect(err.code).toBe("E_SCHEMA");
    expect(calls.length).toBe(2);
    expect(JSON.parse(readFileSync(path.join(dir, "qa-report.json"), "utf8")).verdict).toBe("error");
  });

  it("aggiorna manifest.json con l'esito", async () => {
    const dir = workdir("manifest");
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ status: "final", qa: { verdict: "not-run" } }));
    await runQa(base(dir, fakeLlm([review()]).llm));
    const m = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
    expect(m.qa).toMatchObject({ verdict: "pass", report: "qa-report.json" });
    expect(probe(path.join(dir, "video.mp4")).h).toBe(1920);
  });
});
