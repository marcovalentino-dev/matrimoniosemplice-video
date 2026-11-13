import path from "node:path";
import { fileURLToPath } from "node:url";
import { doctor } from "./doctor.ts";
import { startPreview } from "./preview.ts";
import { EngineError } from "../utils/errors.ts";

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
    case "make":
    case "render":
    case "qa":
    case "batch":
      throw new EngineError("E_NOT_IMPLEMENTED", `Il comando "${cmd}" arriva nei prossimi passi (SPEC §15).`);
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
      process.exit(e.exitCode);
    }
    console.error(e);
    process.exit(1);
  });
