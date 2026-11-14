import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { sha256 } from "../director/index.ts";
import { batch, listBriefs, parseBriefFile } from "../make/batch.ts";
import { parseBatchArgs, parseMakeArgs } from "../make/args.ts";
import { make, validateOptions, type MakeOptions } from "../make/index.ts";
import { probe } from "../render/probe.ts";
import { StoryboardSchema } from "../schemas/storyboard.ts";
import { EngineError } from "../utils/errors.ts";
import fixture from "./fixtures/storyboard-10s.json" with { type: "json" };

vi.setConfig({ testTimeout: 120000 });
const tmp = mkdtempSync(path.join(os.tmpdir(), "ms-make-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const fresh = (name: string) => {
  const d = path.join(tmp, `${name}-${++n}`);
  mkdirSync(d, { recursive: true });
  return d;
};

// Stessa fixture della QA: con l'URL dichiarato il lint dello storyboard è pulito.
const sb0 = JSON.parse(JSON.stringify(fixture));
sb0.shots[1].onScreenText.push({ text: "www.matrimoniosemplice.com", role: "label", source: { kind: "cta" } });
delete sb0.music;
delete sb0.shots[0].transitionIn; // sul primo shot il lint la segnala come inutile
const baseBrief = {
  slug: "prova-uno", goal: "g", format: "9:16", durationSec: 10, audience: "a", message: "m", claims: [],
  cta: { label: "Crea il tuo sito matrimonio", url: "www.matrimoniosemplice.com", approved: true },
  tone: "caldo", loop: false, audio: "none", needsFromUser: [] as { field: string; reason: string }[], assumptions: [] as string[],
};

/** Risposta del regista; `pick` sceglie slug e brief a partire dal prompt (per i test del batch). */
function directorLlm(pick: (prompt: string) => Partial<typeof baseBrief> = () => ({})) {
  const calls: string[] = [];
  const llm = async ({ prompt }: { system: string; prompt: string }) => {
    calls.push(prompt);
    const { version: _v, briefHash: _h, format: _f, size: _s, fps: _p, durationSec: _d, ...rs } = sb0;
    void _v; void _h; void _f; void _s; void _p; void _d;
    return JSON.stringify({ brief: { ...baseBrief, ...pick(prompt) }, storyboard: rs });
  };
  return { llm, calls };
}

interface Fakes {
  opts: Partial<MakeOptions>;
  calls: { llm: string[]; render: number; qa: number };
}

/** Render e QA finti ma con un video vero (ffmpeg) e ffprobe vero, per provare consegna e verifica. */
function fakes(o: { costPerCall?: number; pick?: (p: string) => Partial<typeof baseBrief>; renderFails?: () => boolean; qaCallsLlm?: boolean } = {}): Fakes {
  const d = directorLlm(o.pick);
  const calls = { llm: d.calls, render: 0, qa: 0 };
  const opts: Partial<MakeOptions> = {
    retryDelaysMs: [],
    cliFactory: ({ onUsage }) => async (req) => {
      onUsage?.({ costUsd: o.costPerCall ?? 0.1, inputTokens: 100, outputTokens: 50 });
      return d.llm(req);
    },
    stages: {
      render: (async ({ input }: { input: string }) => {
        calls.render++;
        if (o.renderFails?.()) throw new EngineError("E_ENCODE", "ffmpeg finto fallito");
        const dir = input;
        const video = path.join(dir, "video.mp4");
        const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0xFFF8F5:s=1080x1920:r=30:d=10", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an", video]);
        if (r.status !== 0) throw new Error(String(r.stderr));
        const manifest = {
          version: 1, slug: "x", status: "final", storyboardHash: sha256(readFileSync(path.join(dir, "storyboard.json"), "utf8")),
          output: { file: "video.mp4", bytes: 1, probe: probe(video) }, audio: { mode: "none", reason: "test", tracks: [] },
          qa: { verdict: "not-run" }, warnings: [], commands: ["ffmpeg (finto)"], timing: { totalSec: 1, stages: { final: 1 } }, versions: { engine: "0.1.0" },
        };
        writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
        return { videoFile: video };
      }) as never,
      qa: (async ({ input, llm }: { input: string; llm?: (r: { system: string; prompt: string }) => Promise<string> }) => {
        calls.qa++;
        if (o.qaCallsLlm) await llm!({ system: "qa", prompt: "giudica" });
        const report = { version: 1, verdict: "pass", score: 88, round: 1, needsReapproval: false, probe: {} };
        const reportFile = path.join(input, "qa-report.json");
        writeFileSync(reportFile, JSON.stringify(report));
        const mf = path.join(input, "manifest.json");
        const m = JSON.parse(readFileSync(mf, "utf8"));
        m.qa = { verdict: "pass", score: 88, rounds: 1, report: "qa-report.json" };
        writeFileSync(mf, JSON.stringify(m));
        return { report, reportFile, videoFile: path.join(input, "video.mp4") };
      }) as never,
    },
  };
  return { opts, calls };
}

describe("argomenti di make", () => {
  it("accetta prompt e opzioni", () => {
    const a = parseMakeArgs(["Un video sull'RSVP", "--format", "16:9", "--duration", "20", "--preview", "--max-cost", "1.5", "--max-rounds", "2"]);
    expect(a).toMatchObject({ prompt: "Un video sull'RSVP", format: "16:9", durationSec: 20, preview: true, maxCost: 1.5, maxRounds: 2 });
  });
  it("errori chiari in italiano", () => {
    const msg = (argv: string[]) => { try { parseMakeArgs(argv); } catch (e) { expect((e as EngineError).code).toBe("E_USAGE"); return (e as Error).message; } throw new Error("doveva fallire"); };
    expect(msg([])).toMatch(/Manca il prompt/);
    expect(msg(["p", "--format", "1:1"])).toMatch(/9:16 o 16:9/);
    expect(msg(["p", "--duration", "venti"])).toMatch(/numero/);
    expect(msg(["p", "--max-cost=0"])).toMatch(/maggiore di 0/);
    expect(msg(["p", "--max-rounds", "1.5"])).toMatch(/intero/);
    expect(msg(["p", "--boh"])).toMatch(/Opzione sconosciuta/);
    expect(msg(["p", "--resume", "out/x"])).toMatch(/non entrambi/);
    expect(msg(["--resume", "out/x", "--format", "9:16"])).toMatch(/togli/);
  });
  it("batch: una cartella sola", () => {
    expect(parseBatchArgs(["briefs/", "--force"])).toMatchObject({ dir: "briefs/", force: true });
    expect(() => parseBatchArgs(["a", "b"])).toThrow(/Una sola cartella/);
  });
  it("la durata fuori 5-60 s è rifiutata prima di chiamare Claude", () => {
    const cfg = { autoApprove: true, maxCalls: 8, maxRounds: 3, maxWallMinutes: 45, durationSec: { min: 5, max: 60 } };
    expect(() => validateOptions({ prompt: "p", durationSec: 90 }, cfg)).toThrow(/tra 5 e 60/);
  });
});

describe("make", () => {
  it("--preview si ferma al piano: nessun render, nessuna QA", async () => {
    const outRoot = fresh("out");
    const f = fakes();
    const r = await make({ ...f.opts, prompt: "video di prova", preview: true, outRoot });
    expect(r.status).toBe("planned");
    expect(r.plan).toMatch(/s1\s+0\.0– 5\.0 s/);
    expect(f.calls.render).toBe(0);
    expect(f.calls.qa).toBe(0);
    for (const x of ["brief.json", "storyboard.json", "run.log"]) expect(existsSync(path.join(outRoot, "prova-uno", x))).toBe(true);
    expect(existsSync(path.join(outRoot, "prova-uno", "video.mp4"))).toBe(false);
  });

  it("flusso completo: consegna con video, storyboard, qa-report e manifest completo", async () => {
    const outRoot = fresh("out");
    const f = fakes();
    const r = await make({ ...f.opts, prompt: "video di prova", outRoot, command: 'npm run make -- "video di prova"' });
    expect(r.status).toBe("delivered");
    const dir = path.join(outRoot, "prova-uno");
    for (const x of ["video.mp4", "storyboard.json", "qa-report.json", "manifest.json", "brief.json", "approval.json"]) expect(existsSync(path.join(dir, x)), x).toBe(true);
    const p = probe(path.join(dir, "video.mp4"));
    expect([p.durationSec, p.w, p.h, p.fps]).toEqual([10, 1080, 1920, 30]);
    const m = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
    expect(m.durationSec).toBe(10);
    expect(m.status).toBe("final");
    expect(m.approval.by).toBe("auto");
    expect(m.cost).toMatchObject({ estimated: true, llmCalls: 1, usd: 0.1 });
    expect(m.commands[0]).toBe('npm run make -- "video di prova"');
    expect(m.commands).toContain("ffmpeg (finto)");
    expect(m.timing.stages).toHaveProperty("regista");
    expect(m.timing.stages).toHaveProperty("qa");
    expect(m.versions).toHaveProperty("claudeCli");
    expect(m.audio.mode).toBe("none");
    expect(m.licenses ?? {}).toBeDefined();
    expect(m.qa.verdict).toBe("pass");
    expect(existsSync(path.join(dir, "error.json"))).toBe(false);
  });

  it("niente approvazione automatica se il brief chiede dati: si ferma, poi --resume --approve riprende senza richiamare il regista", async () => {
    const outRoot = fresh("out");
    const f = fakes({ pick: () => ({ needsFromUser: [{ field: "prezzo", reason: "da confermare" }] }) });
    const err = await make({ ...f.opts, prompt: "video di prova", outRoot }).catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(err.code).toBe("E_NOT_APPROVED");
    expect(err.message).toMatch(/--resume .*prova-uno --approve/);
    const dir = path.join(outRoot, "prova-uno");
    expect(JSON.parse(readFileSync(path.join(dir, "error.json"), "utf8")).code).toBe("E_NOT_APPROVED");
    expect(f.calls.render).toBe(0);

    const r = await make({ ...f.opts, resume: dir, approve: true, outRoot });
    expect(r.status).toBe("delivered");
    expect(f.calls.llm.length).toBe(1); // il regista non è stato richiamato
    expect(JSON.parse(readFileSync(path.join(dir, "approval.json"), "utf8")).by).toBe("user");
    expect(existsSync(path.join(dir, "error.json"))).toBe(false);
  });

  it("--max-cost ferma prima della chiamata che sfora; la ripresa recupera il video già renderizzato", async () => {
    const outRoot = fresh("out");
    const f = fakes({ costPerCall: 0.5, qaCallsLlm: true });
    const err = await make({ ...f.opts, prompt: "video di prova", outRoot, maxCost: 0.4 }).catch((e) => e);
    expect(err.code).toBe("E_BUDGET");
    expect(err.message).toMatch(/tetto di \$0\.4/);
    const dir = path.join(outRoot, "prova-uno");
    // niente video non verificato nella cartella di consegna
    expect(existsSync(path.join(dir, "video.mp4"))).toBe(false);
    expect(existsSync(path.join(dir, ".work", "UNVERIFIED.mp4"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")).status).toBe("failed");
    expect(JSON.parse(readFileSync(path.join(dir, "error.json"), "utf8")).hint).toMatch(/--max-cost/);

    const r = await make({ ...f.opts, resume: dir, outRoot, maxCost: 5 });
    expect(r.status).toBe("delivered");
    expect(f.calls.render).toBe(1); // ripristinato, non rifatto
    expect(f.calls.llm.length).toBe(2); // regista (prima corsa) + revisione finta (seconda); il regista non è stato richiamato
    const m = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
    expect(m.cost).toMatchObject({ usd: 1, llmCalls: 2 }); // costo cumulato delle due corse
    expect(m.status).toBe("final");
    expect(existsSync(path.join(dir, "video.mp4"))).toBe(true);
  });

  it("un errore del regista senza slug lascia comunque un rapporto in out/_errori", async () => {
    const outRoot = fresh("out");
    const gap = async () => JSON.stringify({ gap: { reason: "serve una scena nuova", missing: ["x"] } });
    await expect(make({ prompt: "p", outRoot, retryDelaysMs: [], cliFactory: () => gap })).rejects.toMatchObject({ code: "E_GAP" });
    const errDir = path.join(outRoot, "_errori");
    const sub = path.join(errDir, readdirOne(errDir));
    expect(existsSync(path.join(sub, "gap-report.md"))).toBe(true);
    expect(existsSync(path.join(sub, "error.json"))).toBe(true);
  });

  it("riprova due volte se claude non risponde, poi E_LLM_UNAVAILABLE", async () => {
    let calls = 0;
    const down = async (): Promise<string> => { calls++; throw new EngineError("E_LLM_UNAVAILABLE", "giù"); };
    await expect(make({ prompt: "p", outRoot: fresh("out"), retryDelaysMs: [1, 1], cliFactory: () => down })).rejects.toMatchObject({ code: "E_LLM_UNAVAILABLE" });
    expect(calls).toBe(3);
  });
});

function readdirOne(dir: string): string {
  const r = spawnSync("node", ["-e", `console.log(require('fs').readdirSync(${JSON.stringify(dir)})[0])`], { encoding: "utf8" });
  return r.stdout.trim();
}

describe("brief del batch", () => {
  it("legge formato e durata dall'intestazione e il prompt dal resto", () => {
    expect(parseBriefFile("---\nformato: 16:9\ndurata: 20\n---\nUn video.\n")).toEqual({ prompt: "Un video.", format: "16:9", durationSec: 20 });
    expect(parseBriefFile("Solo prompt")).toEqual({ prompt: "Solo prompt" });
  });
  it("rifiuta intestazioni e brief non validi", () => {
    expect(() => parseBriefFile("---\nformato: 1:1\n---\nx")).toThrow(/9:16 o 16:9/);
    expect(() => parseBriefFile("---\ncolore: rosa\n---\nx")).toThrow(/Riga non valida/);
    expect(() => parseBriefFile("---\ndurata: 20\n---\n   ")).toThrow(/vuoto/);
  });
  it("elenca i .md in ordine, senza README e senza file nascosti", () => {
    const d = fresh("briefs");
    for (const f of ["b.md", "a.md", "README.md", "_bozza.md", "nota.txt"]) writeFileSync(path.join(d, f), "x");
    expect(listBriefs(d)).toEqual(["a.md", "b.md"]);
  });
});

describe("batch", () => {
  it("elabora in coda, registra stato e log, e alla seconda corsa salta i consegnati e riprende i falliti", async () => {
    const dir = fresh("briefs");
    const outRoot = fresh("out");
    writeFileSync(path.join(dir, "a.md"), "PROMPT_A");
    writeFileSync(path.join(dir, "b.md"), "---\ndurata: 10\n---\nPROMPT_B");
    writeFileSync(path.join(dir, "c.md"), "---\nformato: quadrato\n---\nPROMPT_C");
    let failB = true;
    const f = fakes({ pick: (p) => ({ slug: p.includes("PROMPT_B") ? "prova-due" : "prova-uno" }), renderFails: () => failB && f.calls.render === 2 });
    // la prima chiamata di render (a.md) va bene, la seconda (b.md) fallisce

    const s1 = await batch({ ...f.opts, dir, outRoot });
    expect(s1.done).toEqual(["a.md"]);
    expect(s1.failed.map((x) => [x.file, x.code])).toEqual([["b.md", "E_ENCODE"], ["c.md", "E_USAGE"]]);
    expect(existsSync(path.join(outRoot, "prova-uno", "video.mp4"))).toBe(true);
    expect(existsSync(path.join(outRoot, "prova-due", "video.mp4"))).toBe(false);
    const state1 = JSON.parse(readFileSync(s1.stateFile, "utf8"));
    expect(state1.jobs["b.md"]).toMatchObject({ status: "failed", outDir: path.join(outRoot, "prova-due") });
    expect(readFileSync(s1.logFile, "utf8")).toMatch(/\[b\.md\].*FALLITO E_ENCODE/);
    const llmBefore = f.calls.llm.length;

    failB = false;
    const s2 = await batch({ ...f.opts, dir, outRoot });
    expect(s2.skipped).toEqual(["a.md"]);
    expect(s2.done).toEqual(["b.md"]);
    expect(s2.failed.map((x) => x.file)).toEqual(["c.md"]);
    expect(f.calls.llm.length).toBe(llmBefore); // b.md è ripreso dalla sua cartella: il regista non viene richiamato
    expect(existsSync(path.join(outRoot, "prova-due", "video.mp4"))).toBe(true);
    expect(JSON.parse(readFileSync(s2.stateFile, "utf8")).jobs["b.md"]).toMatchObject({ status: "done", attempts: 2 });
  });

  it("si ferma se Claude non è disponibile e lascia in coda gli altri", async () => {
    const dir = fresh("briefs");
    for (const x of ["a", "b", "c"]) writeFileSync(path.join(dir, `${x}.md`), `prompt ${x}`);
    let calls = 0;
    const makeFn = (async () => { calls++; throw new EngineError("E_LLM_UNAVAILABLE", "limite raggiunto"); }) as never;
    const s = await batch({ dir, outRoot: fresh("out"), makeFn });
    expect(calls).toBe(1);
    expect(s.aborted).toMatch(/E_LLM_UNAVAILABLE/);
    expect(s.notRun).toEqual(["b.md", "c.md"]);
  });

  it("--force rifà anche i consegnati", async () => {
    const dir = fresh("briefs");
    writeFileSync(path.join(dir, "a.md"), "PROMPT_A");
    const outRoot = fresh("out");
    const f = fakes();
    await batch({ ...f.opts, dir, outRoot });
    const again = await batch({ ...f.opts, dir, outRoot, force: true });
    expect(again.done).toEqual(["a.md"]);
    expect(f.calls.render).toBe(2);
  });
});

void StoryboardSchema;
