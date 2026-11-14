import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { doctor } from "./doctor.ts";
import { startPreview } from "./preview.ts";
import { EngineError, HINTS } from "../utils/errors.ts";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(ENGINE, "..");

/** Restituisce il codice di uscita; -1 = il processo resta attivo (server). */
async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "doctor": {
      const checks = doctor(path.join(ENGINE, "engine.config.json"));
      for (const c of checks) console.log(`${c.ok ? "OK    " : "MANCA "} ${c.name}: ${c.detail}`);
      const bad = checks.filter((c) => c.required && !c.ok);
      if (bad.length) throw new EngineError("E_ENV", `Mancano: ${bad.map((c) => c.name).join(", ")}.`);
      console.log("Ambiente pronto.");
      return 0;
    }
    case "preview": {
      // M1: serve la pagina di riferimento del brand. L'anteprima degli storyboard arriva con M5.
      const srv = await startPreview(ROOT, Number(rest[0]) || 0);
      const port = (srv.address() as { port: number }).port;
      console.log(`Anteprima: http://127.0.0.1:${port}/brand/preview.html  (Ctrl-C per chiudere)`);
      if (process.env.ENGINE_PREVIEW_ONCE) {
        srv.close();
        return 0;
      }
      return -1;
    }
    case "theme-test": {
      const { renderBrandTest } = await import("../theme/render-test.ts");
      const r = await renderBrandTest();
      for (const c of r.checks) console.log(`${c.ok ? "OK     " : "ERRORE "} ${c.name}: ${c.detail}`);
      if (!r.ok) throw new EngineError("E_RENDER_PAGE", "Controlli del tema falliti.");
      console.log(`Immagine: ${r.png} (${r.width}×${r.height})`);
      return 0;
    }
    case "catalog": {
      const { writeCatalog } = await import("../scenes/catalog.ts");
      const r = writeCatalog();
      console.log(`Catalogo scritto: ${r.md} e ${r.json}`);
      return 0;
    }
    case "scenes-test": {
      const { renderSceneFrames } = await import("../scenes/test-frames.ts");
      const r = await renderSceneFrames(rest.filter((a) => !a.startsWith("-")));
      let bad = 0;
      for (const f of r.frames) {
        const fails = f.checks.filter((c) => !c.ok);
        bad += fails.length;
        console.log(`${fails.length ? "ERRORE" : "OK    "} ${f.scene} ${f.format} (t=${f.t} s, shot ${f.dur} s)`);
        for (const c of fails) console.log(`        - ${c.name}: ${c.detail}`);
      }
      for (const s of r.sheets) console.log(`Contact sheet: ${s}`);
      if (!r.ok) throw new EngineError("E_RENDER_PAGE", `${bad} controlli delle scene falliti.`);
      return 0;
    }
    case "direct": {
      // Regista: prompt -> brief.json + storyboard.json (si ferma al GATE A, non renderizza).
      const { direct } = await import("../director/index.ts");
      const flag = (n: string) => {
        const i = rest.indexOf(n);
        return i >= 0 ? rest[i + 1] : undefined;
      };
      const prompt = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--")).join(" ").trim();
      if (!prompt) throw new EngineError("E_SCHEMA", 'Uso: npm run direct -- "<prompt>" [--out cartella] [--duration s] [--format 9:16|16:9]');
      const duration = flag("--duration") ? Number(flag("--duration")) : undefined;
      const format = flag("--format") as "9:16" | "16:9" | undefined;
      const out = flag("--out");
      const r = await direct({
        prompt,
        root: ROOT,
        expect: { durationSec: duration, format },
        outDir: out ? path.resolve(out) : (b) => path.join(ROOT, "out", b.slug),
      });
      console.log(`Brief e storyboard validati (${r.usage.calls} chiamata/e al regista).`);
      for (const s of r.storyboard.shots) console.log(`  ${s.id}  ${s.start.toFixed(1)}–${s.end.toFixed(1)} s  ${s.scene}`);
      for (const w of r.warnings) console.log(`  attenzione: ${w}`);
      for (const f of r.files) console.log(`  scritto: ${f}`);
      return 0;
    }
    case "render": {
      // storyboard.json (o cartella) -> preview.mp4 + video.mp4 (+ audio dalla libreria) + manifest.json
      const { renderStoryboard } = await import("../render/index.ts");
      const flag = (n: string) => {
        const i = rest.indexOf(n);
        return i >= 0 ? rest[i + 1] : undefined;
      };
      const input = rest.find((a, i) => !a.startsWith("--") && !["--out", "--workers", "--audio-dir"].includes(rest[i - 1] ?? ""));
      if (!input) throw new EngineError("E_SCHEMA", "Uso: npm run render -- <storyboard.json|cartella> [--out cartella] [--preview-only|--final-only] [--no-audio] [--workers n] [--audio-dir cartella]");
      let last = "";
      const r = await renderStoryboard({
        input: path.resolve(input),
        outDir: flag("--out") ? path.resolve(flag("--out")!) : undefined,
        preview: !rest.includes("--final-only"),
        final: !rest.includes("--preview-only"),
        noAudio: rest.includes("--no-audio"),
        workers: flag("--workers") ? Number(flag("--workers")) : undefined,
        audioDir: flag("--audio-dir") ? path.resolve(flag("--audio-dir")!) : undefined,
        progress: (stage, done, total) => {
          const pct = Math.floor((done / total) * 4) * 25;
          const key = `${stage}${pct}`;
          if (key !== last && done > 0) {
            last = key;
            console.log(`  ${stage}: ${done}/${total} fotogrammi`);
          }
        },
      });
      const m = r.manifest;
      console.log("Comandi usati:");
      for (const c of r.commands) console.log(`  ${c}`);
      for (const w of m.warnings) console.log(`  attenzione: ${w}`);
      if (r.previewFile) console.log(`Anteprima: ${r.previewFile}`);
      if (r.videoFile) console.log(`Video:     ${r.videoFile}  [${m.status}]`);
      console.log(`Manifest:  ${r.manifestFile}`);
      return 0;
    }
    case "qa": {
      // QA dopo il render: ffprobe, contact sheet, revisione di Claude, qa-report.json, giri di correzione.
      const { runQa } = await import("../qa/index.ts");
      const flag = (n: string) => {
        const i = rest.indexOf(n);
        return i >= 0 ? rest[i + 1] : undefined;
      };
      const input = rest.find((a, i) => !a.startsWith("--") && !["--storyboard", "--max-rounds", "--max-calls", "--workers"].includes(rest[i - 1] ?? ""));
      if (!input) throw new EngineError("E_SCHEMA", "Uso: npm run qa -- <video.mp4|cartella> [--storyboard file] [--max-rounds 3] [--max-calls 8] [--no-fix] [--no-quarantine] [--workers n]");
      const r = await runQa({
        input: path.resolve(input),
        storyboardFile: flag("--storyboard") ? path.resolve(flag("--storyboard")!) : undefined,
        maxRounds: flag("--max-rounds") ? Number(flag("--max-rounds")) : undefined,
        maxCalls: flag("--max-calls") ? Number(flag("--max-calls")) : undefined,
        workers: flag("--workers") ? Number(flag("--workers")) : undefined,
        fix: !rest.includes("--no-fix"),
        quarantine: !rest.includes("--no-quarantine"),
        progress: (m) => console.log(`  ${m}`),
      });
      const rep = r.report;
      const p = rep.probe!;
      console.log(`ffprobe: ${p.durationSec.toFixed(2)} s, ${p.w}x${p.h}, ${p.fps} fps, ${p.vcodec}/${p.pixFmt}, audio ${p.acodec ?? "assente"} (atteso da ${p.expected.from}: ${p.expected.durationSec} s, ${p.expected.w}x${p.expected.h}, ${p.expected.fps} fps)`);
      for (const s of rep.shots) console.log(`  ${s.id} ${s.scene.padEnd(18)} ${s.score ?? "—"}/100  ${s.issues.length ? `${s.issues.length} problema/i` : "ok"}`);
      for (const i of rep.issues) console.log(`  ${i.severity === "major" ? "GRAVE " : "minore"} [${i.shot}] ${i.criterion}: ${i.what}`);
      for (const w of rep.warnings) console.log(`  attenzione: ${w}`);
      console.log(`Verdetto: ${rep.verdict.toUpperCase()}, voto ${rep.score ?? "—"}/100, giri di valutazione ${rep.round}, ${rep.calls} chiamata/e al modello`);
      console.log(`Report: ${r.reportFile}`);
      console.log(`FINITO: ${r.videoFile} (${(statSync(r.videoFile).size / 1e6).toFixed(1)} MB), ffprobe e qa-report.json verificati.`);
      return 0;
    }
    case "make": {
      // prompt -> brief -> storyboard -> (--preview: si ferma) -> render -> audio -> QA -> consegna in out/<slug>/
      const { parseMakeArgs, resolveFromCwdOrRoot } = await import("../make/args.ts");
      const { make } = await import("../make/index.ts");
      const a = parseMakeArgs(rest);
      const r = await make({
        ...a,
        resume: a.resume ? resolveFromCwdOrRoot(a.resume, ROOT) : undefined,
        root: ROOT,
        command: ["npm run make --", ...rest.map((x) => (/[\s"]/.test(x) ? JSON.stringify(x) : x))].join(" "),
        say: console.log,
      });
      const rel = path.relative(ROOT, r.outDir).split(path.sep).join("/");
      if (r.status === "planned") {
        console.log(`Piano pronto in ${rel}/ (brief.json, storyboard.json). Non è stato renderizzato nulla.`);
        console.log(`Se va bene: npm run make -- --resume ${rel} --approve`);
        return 0;
      }
      const m = JSON.parse(readFileSync(path.join(r.outDir, "manifest.json"), "utf8"));
      const p = m.output.probe;
      const audio = m.audio.mode === "synth" ? `sintetizzata in codice, ${m.audio.loudnessLUFS} LUFS` : m.audio.mode === "library" ? m.audio.tracks.map((t: { titolo: string; licenza: string }) => `${t.titolo} (${t.licenza})`).join(", ") : `nessuno (${m.audio.reason})`;
      console.log(`${r.status === "draft" ? "BOZZA (non finale)" : "FINITO"}: ${r.videoFile} — ${p.durationSec.toFixed(2)} s, ${p.w}x${p.h}, ${p.fps} fps, ${(m.output.bytes / 1e6).toFixed(1)} MB (ffprobe verificato)`);
      console.log(`QA: ${r.qa!.verdict}, voto ${r.qa!.score ?? "—"}/100, ${r.qa!.round} valutazione/i. Audio: ${audio}.`);
      console.log(`Tempo ${m.timing.totalSec} s, costo stimato ~$${m.cost.usd} (${m.cost.llmCalls} chiamata/e a Claude).`);
      for (const f of r.files) console.log(`  ${path.relative(ROOT, f).split(path.sep).join("/")}`);
      return 0;
    }
    case "batch": {
      // Tutti i .md di una cartella in coda, con log e ripresa dopo errore.
      const { parseBatchArgs, resolveFromCwdOrRoot } = await import("../make/args.ts");
      const { batch } = await import("../make/batch.ts");
      const a = parseBatchArgs(rest);
      const s = await batch({ ...a, dir: resolveFromCwdOrRoot(a.dir ?? "briefs", ROOT), root: ROOT, say: console.log });
      for (const f of s.failed) console.log(`  FALLITO ${f.file}: ${f.code} — ${f.message.split("\n")[0]}`);
      console.log(`Stato: ${path.relative(ROOT, s.stateFile)}  Log: ${path.relative(ROOT, s.logFile)}`);
      return s.failed.length || s.aborted ? 1 : 0;
    }
    default:
      console.log("Uso: npm run <make|preview|render|qa|batch|doctor> -- [opzioni]  (vedi engine/README.md)");
      return cmd ? 1 : 0;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    if (code >= 0) process.exit(code);
  })
  .catch((e) => {
    if (e instanceof EngineError) {
      console.error(`${e.code}: ${e.message}`);
      if (HINTS[e.code]) console.error(`Cosa fare: ${HINTS[e.code]}`);
      process.exit(e.exitCode);
    }
    console.error(`Errore imprevisto: ${(e as Error)?.message ?? e}`);
    console.error("Dettagli in out/<slug>/error.json e run.log; con ENGINE_DEBUG=1 anche lo stack.");
    if (process.env.ENGINE_DEBUG) console.error(e);
    process.exit(1);
  });
