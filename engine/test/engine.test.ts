import path from "node:path";
import { describe, expect, it } from "vitest";
import { versionAtLeast, firstLine } from "../cli/doctor.ts";
import { startPreview } from "../cli/preview.ts";
import { BriefSchema } from "../schemas/brief.ts";
import { ERRORS, EngineError } from "../utils/errors.ts";

const brief = {
  version: 1,
  slug: "rsvp-senza-account-20s",
  prompt: "p",
  goal: "g",
  format: "9:16",
  size: { w: 1080, h: 1920 },
  fps: 30,
  durationSec: 20,
  audience: "a",
  message: "m",
  claims: [],
  cta: { label: "Crea il tuo sito matrimonio", url: "www.matrimoniosemplice.com", approved: true },
  tone: "caldo",
  loop: false,
  audio: "synth",
  needsFromUser: [],
  assumptions: [],
};

describe("doctor", () => {
  it("confronta le versioni", () => {
    expect(versionAtLeast("v26.12.1", [22, 18])).toBe(true);
    expect(versionAtLeast("v22.17.0", [22, 18])).toBe(false);
  });
  it("prende la prima riga", () => expect(firstLine("a\nb")).toBe("a"));
});

describe("schema brief", () => {
  it("accetta un brief valido", () => expect(BriefSchema.safeParse(brief).success).toBe(true));
  it("rifiuta durate fuori 5-60 s", () => expect(BriefSchema.safeParse({ ...brief, durationSec: 90 }).success).toBe(false));
  it("rifiuta formati non previsti", () => expect(BriefSchema.safeParse({ ...brief, format: "1:1" }).success).toBe(false));
  it("rifiuta slug non validi", () => expect(BriefSchema.safeParse({ ...brief, slug: "Ciao Mondo" }).success).toBe(false));
});

describe("errori", () => {
  it("hanno codici di uscita unici", () => {
    const codes = Object.values(ERRORS).map((e) => e.exit);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("EngineError espone il codice di uscita", () => expect(new EngineError("E_BUDGET").exitCode).toBe(70));
});

describe("preview", () => {
  it("serve brand/preview.html e blocca i percorsi fuori radice", async () => {
    const root = path.resolve(import.meta.dirname, "..", "..");
    const srv = await startPreview(root);
    const port = (srv.address() as { port: number }).port;
    expect((await fetch(`http://127.0.0.1:${port}/brand/preview.html`)).status).toBe(200);
    expect((await fetch(`http://127.0.0.1:${port}/nonesiste`)).status).toBe(404);
    expect((await fetch(`http://127.0.0.1:${port}/..%2F..%2Fwindows%2Fwin.ini`)).status).toBe(404);
    srv.close();
  });
});
