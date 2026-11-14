import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { direct, extractJson, lintStoryboard, loadFacts, parseFacts, sha256 } from "../director/index.ts";
import { BriefSchema, type Brief } from "../schemas/brief.ts";
import { StoryboardSchema, type Storyboard } from "../schemas/storyboard.ts";
import { getScene } from "../scenes/index.ts";
import { EngineError } from "../utils/errors.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const { md, facts } = loadFacts(path.join(ROOT, "brand", "PRODOTTO_FATTI.md"));
const FACT = facts.find((f) => f.id === "rsvp-senza-account")!.id;

// ---------- fixture ----------

type Shot = Storyboard["shots"][number];

/** Shot valido: le props vengono dall'esempio della scena e i testi `prop` sono dichiarati come claim. */
function shot(id: string, sceneName: string, start: number, end: number, over: Record<string, unknown> = {}): Shot {
  const scene = getScene(sceneName);
  const { prices: _p, ...base } = scene.preview.props as Record<string, unknown>; // `prices` lo risolve il motore
  void _p;
  const props = { ...base, ...over };
  const parsed = scene.schema.parse({ ...props, prices: undefined });
  const texts = scene.texts(parsed).filter((t) => t.origin === "prop");
  return {
    id, start, end, scene: sceneName, props,
    onScreenText: texts.map((t) => ({
      text: t.text,
      role: t.role,
      source: t.role === "cta" || /^www\./.test(t.text) ? { kind: "cta" as const } : { kind: "claim" as const, id: FACT },
    })),
    notes: "nota",
  };
}

const brief: Brief = BriefSchema.parse({
  version: 1, slug: "rsvp-senza-account-20s", prompt: "video di 20 secondi sull'RSVP senza account",
  goal: "spiegare l'RSVP senza account", format: "9:16", size: { w: 1080, h: 1920 }, fps: 30, durationSec: 20,
  audience: "coppie italiane", message: "Gli invitati confermano senza account", claims: [FACT],
  cta: { label: "Crea il tuo sito matrimonio", url: "www.matrimoniosemplice.com", approved: true },
  tone: "caldo", loop: false, audio: "synth", needsFromUser: [], assumptions: [],
});

function storyboardOf(shots: Shot[], durationSec = 20): Storyboard {
  return StoryboardSchema.parse({
    version: 1, briefHash: sha256(JSON.stringify(brief, null, 2)), format: "9:16", size: { w: 1080, h: 1920 }, fps: 30,
    durationSec, theme: { palette: "rosa-romantico" }, shots, music: { mood: "caldo-minimale", bpm: 96, fadeIn: 1, fadeOut: 2 },
  });
}

const goodShots = () => [shot("s1", "HookText", 0, 6), shot("s2", "RsvpFlow", 6, 15), shot("s3", "EndCard", 15, 20)];
const good = () => storyboardOf(goodShots());
const codes = (sb: Storyboard, b: Brief = brief, expectOpts?: { durationSec?: number }) => lintStoryboard({ brief: b, storyboard: sb, facts, expect: expectOpts }).errors.map((e) => e.code);

/** Risposta del regista nel formato che il modello deve produrre (senza i campi derivati). */
function modelOutput(sb: Storyboard, b: Brief = brief) {
  const { version, prompt, size, fps, ...rb } = b;
  void version; void prompt; void size; void fps;
  const { version: _v, briefHash, format, size: _s, fps: _f, durationSec, ...rs } = sb;
  void _v; void briefHash; void format; void _s; void _f; void durationSec;
  return { brief: rb, storyboard: rs };
}

const tmp: string[] = [];
const tmpDir = () => { const d = mkdtempSync(path.join(os.tmpdir(), "director-")); tmp.push(d); return d; };
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

// ---------- unit ----------

describe("fatti", () => {
  it("estrae promesse e funzioni da PRODOTTO_FATTI.md con id unici", () => {
    const ids = parseFacts(md).map((f) => f.id);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("rsvp-senza-account");
    expect(ids).toContain("piano-tavoli");
    expect(facts.find((f) => f.id === "planning")!.plan).toMatch(/Premium/);
  });
});

describe("extractJson", () => {
  it("ignora recinti e testo attorno", () => {
    expect(extractJson('Ecco:\n```json\n{"a":1}\n```\nfine')).toEqual({ a: 1 });
    expect(extractJson('{"a":{"b":2}}')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("nessun json")).toThrow();
  });
});

describe("lint dello storyboard", () => {
  it("accetta uno storyboard valido", () => {
    const r = lintStoryboard({ brief, storyboard: good(), facts, expect: { durationSec: 20, format: "9:16" } });
    expect(r.errors).toEqual([]);
  });

  it("rifiuta scene fuori catalogo (E_GAP)", () => {
    const shots = goodShots();
    shots[1] = { ...shots[1]!, scene: "VideoTestimonial" };
    expect(codes(storyboardOf(shots))).toContain("E_GAP");
  });

  it("rifiuta una somma delle durate diversa dalla durata richiesta", () => {
    const sb = storyboardOf([shot("s1", "HookText", 0, 6), shot("s2", "RsvpFlow", 6, 15), shot("s3", "EndCard", 15, 18)]);
    expect(codes(sb)).toContain("E_SCHEMA");
    expect(codes(good(), brief, { durationSec: 30 })).toContain("E_SCHEMA"); // il brief dice 20 ma l'utente ha chiesto 30
  });

  it("rifiuta timecode non contigui", () => {
    const sb = storyboardOf([shot("s1", "HookText", 0, 6), shot("s2", "RsvpFlow", 7, 15), shot("s3", "EndCard", 15, 20)]);
    expect(codes(sb)).toContain("E_SCHEMA");
  });

  it("rifiuta shot più brevi del minimo della scena", () => {
    const sb = storyboardOf([shot("s1", "HookText", 0, 3), shot("s2", "RsvpFlow", 3, 17), shot("s3", "EndCard", 17, 20)]);
    const e = lintStoryboard({ brief, storyboard: sb, facts }).errors;
    expect(e.some((x) => x.shot === "s1" && /minimo/.test(x.msg))).toBe(true);
    expect(e.some((x) => x.shot === "s3")).toBe(true); // EndCard: min 4 s
  });

  it("rifiuta props non valide per lo schema della scena", () => {
    const shots = goodShots();
    shots[0] = { ...shots[0]!, props: { eyebrow: "x" } }; // manca headline
    expect(codes(storyboardOf(shots))).toContain("E_SCHEMA");
  });

  it("rifiuta importi scritti a mano fuori da PriceCard", () => {
    const shots = goodShots();
    shots[0] = shot("s1", "HookText", 0, 6, { headline: "Solo 12 € al mese" });
    expect(codes(storyboardOf(shots))).toContain("E_PRICE_UNVERIFIED");
  });

  it("accetta PriceCard con prezzi letti da file e rifiuta cifre nelle sue props o un altro priceRef", () => {
    const price = (over: Record<string, unknown>) => storyboardOf([shot("s1", "HookText", 0, 6), shot("s2", "PriceCard", 6, 14, over), shot("s3", "EndCard", 14, 20)]);
    expect(codes(price({}))).toEqual([]);
    expect(codes(price({ headline: "Solo 12 al mese" }))).toContain("E_PRICE_UNVERIFIED");
    expect(codes(price({ priceRef: "prezzi-inventati.json" }))).toContain("E_PRICE_UNVERIFIED");
    const hand = price({});
    hand.shots[1]!.props = { ...hand.shots[1]!.props, prices: { valuta: "EUR", mensile: 5, unaTantum: 9, fonte: "x" } };
    expect(codes(hand)).toContain("E_PRICE_UNVERIFIED");
  });

  it("rifiuta claim con id inesistente, numeri inventati e source mock fuori dai mockup", () => {
    const withText = (i: number, text: string, source: unknown) => {
      const sb = good();
      sb.shots[i]!.onScreenText.push({ text, role: "caption", source } as never);
      return sb;
    };
    expect(codes(withText(0, "Funziona", { kind: "claim", id: "app-mobile" }))).toContain("E_CLAIM");
    expect(codes(withText(0, "Scelto da 5.000 coppie", { kind: "claim", id: FACT }))).toContain("E_CLAIM");
    expect(codes(withText(0, "Risparmi il 40% del tempo", { kind: "claim", id: FACT }))).toContain("E_CLAIM");
    expect(codes(withText(0, "Giulia & Marco", { kind: "mock" }))).toContain("E_CLAIM"); // HookText non è un mockup
    expect(codes(withText(1, "Giulia & Marco", { kind: "mock" }))).toEqual([]); // RsvpFlow sì
  });

  it("rifiuta claim del brief fuori da PRODOTTO_FATTI e URL non ufficiale non segnalato", () => {
    expect(codes(good(), { ...brief, claims: ["premio-miglior-sito"] })).toContain("E_CLAIM");
    expect(codes(good(), { ...brief, cta: { ...brief.cta, url: "www.altro.it" } })).toContain("E_CLAIM");
    const noUrl = storyboardOf([shot("s1", "HookText", 0, 6), shot("s2", "RsvpFlow", 6, 15), shot("s3", "EndCard", 15, 20, { url: "[URL]" })]);
    noUrl.shots[2]!.onScreenText.forEach((t) => t.text === "[URL]" && (t.source = { kind: "cta" }));
    expect(codes(noUrl, { ...brief, cta: { ...brief.cta, url: "[URL]" }, needsFromUser: [{ field: "cta.url", reason: "manca" }] })).toEqual([]);
  });

  it("pretende che ogni testo delle props sia dichiarato in onScreenText", () => {
    const sb = good();
    sb.shots[0]!.onScreenText = [];
    const e = lintStoryboard({ brief, storyboard: sb, facts }).errors;
    expect(e.some((x) => x.shot === "s1" && /manca da onScreenText/.test(x.msg))).toBe(true);
  });

  it("segnala come avviso l'assenza di EndCard", () => {
    const sb = storyboardOf([shot("s1", "HookText", 0, 6), shot("s2", "RsvpFlow", 6, 20)]);
    const r = lintStoryboard({ brief, storyboard: sb, facts });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/EndCard/);
  });
});

describe("regista (modello simulato)", () => {
  const llmFrom = (responses: string[]) => {
    const prompts: string[] = [];
    const fn = async ({ prompt }: { system: string; prompt: string }) => {
      prompts.push(prompt);
      return responses[Math.min(prompts.length - 1, responses.length - 1)]!;
    };
    return { fn, prompts };
  };
  const valid = () => JSON.stringify(modelOutput(good()));

  it("produce brief.json e storyboard.json coerenti (hash, formato, dimensioni)", async () => {
    const out = tmpDir();
    const { fn } = llmFrom(["Ecco il JSON:\n```json\n" + valid() + "\n```"]);
    const r = await direct({ prompt: "video di 20 secondi sull'RSVP senza account", llm: fn, outDir: out, expect: { durationSec: 20, format: "9:16" } });
    expect(r.usage.calls).toBe(1);
    expect(r.storyboard.briefHash).toBe(sha256(readFileSync(path.join(out, "brief.json"), "utf8").trimEnd()));
    expect(r.brief.prompt).toBe("video di 20 secondi sull'RSVP senza account");
    expect(r.brief.size).toEqual({ w: 1080, h: 1920 });
    expect(BriefSchema.safeParse(JSON.parse(readFileSync(path.join(out, "brief.json"), "utf8"))).success).toBe(true);
    expect(StoryboardSchema.safeParse(JSON.parse(readFileSync(path.join(out, "storyboard.json"), "utf8"))).success).toBe(true);
    expect(existsSync(path.join(out, "storyboard.lint.json"))).toBe(true);
  });

  it("rifà la chiamata passando gli errori e ha successo al secondo tentativo", async () => {
    const bad = modelOutput(storyboardOf([shot("s1", "HookText", 0, 6), shot("s2", "RsvpFlow", 6, 15), shot("s3", "EndCard", 15, 18)]));
    const { fn, prompts } = llmFrom([JSON.stringify(bad), valid()]);
    const r = await direct({ prompt: "p", llm: fn });
    expect(r.usage.calls).toBe(2);
    expect(prompts[1]).toMatch(/# CORREZIONE/);
    expect(prompts[1]).toMatch(/somma delle durate/);
  });

  it("tenta al massimo 3 volte (1 + 2 rifacimenti) poi E_SCHEMA e scrive director.error.json", async () => {
    const out = tmpDir();
    const { fn, prompts } = llmFrom(["non è json"]);
    const err = await direct({ prompt: "p", llm: fn, outDir: out }).catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect((err as EngineError).code).toBe("E_SCHEMA");
    expect(prompts.length).toBe(3);
    expect(existsSync(path.join(out, "director.error.json"))).toBe(true);
    expect(existsSync(path.join(out, "storyboard.json"))).toBe(false);
  });

  it("riporta E_PRICE_UNVERIFIED se il regista insiste con un prezzo scritto a mano", async () => {
    const shots = goodShots();
    shots[0] = shot("s1", "HookText", 0, 6, { headline: "Solo 79 € una tantum" });
    const { fn } = llmFrom([JSON.stringify(modelOutput(storyboardOf(shots)))]);
    const err = await direct({ prompt: "p", llm: fn }).catch((e) => e);
    expect((err as EngineError).code).toBe("E_PRICE_UNVERIFIED");
  });

  it("su richiesta fuori catalogo scrive gap-report.md e si ferma senza rifare la chiamata (E_GAP)", async () => {
    const out = tmpDir();
    const { fn, prompts } = llmFrom([JSON.stringify({ gap: { reason: "Servono testimonianze di coppie", missing: ["scena testimonianze"] } })]);
    const err = await direct({ prompt: "video con le recensioni delle coppie", llm: fn, outDir: out }).catch((e) => e);
    expect((err as EngineError).code).toBe("E_GAP");
    expect(prompts.length).toBe(1);
    expect(readFileSync(path.join(out, "gap-report.md"), "utf8")).toMatch(/testimonianze/);
  });

  it("rispetta il tetto di chiamate (E_BUDGET)", async () => {
    const { fn } = llmFrom(["non è json"]);
    const err = await direct({ prompt: "p", llm: fn, maxCalls: 2 }).catch((e) => e);
    expect((err as EngineError).code).toBe("E_BUDGET");
  });

  it("il prompt contiene fatti, catalogo e regole", async () => {
    const { fn, prompts } = llmFrom([valid()]);
    await direct({ prompt: "video RSVP", llm: fn, expect: { durationSec: 20 } });
    const p = prompts[0]!;
    expect(p).toMatch(/PRODOTTO_FATTI/);
    expect(p).toMatch(/"scena": "PriceCard"/);
    expect(p).toMatch(/brand\/prezzi\.json/);
    expect(p).toMatch(/durata ESATTA: 20 s/);
    expect(p).not.toMatch(/12 €|79 €/); // i prezzi non sono nel prompt: li legge la scena dal file
  });
});

// ---------- con il modello vero (costano chiamate: solo con DIRECTOR_LIVE=1) ----------

const LIVE = process.env.DIRECTOR_LIVE === "1";
const OUT = path.join(ROOT, "out", "_test", "director");

const PROMPTS = [
  { name: "rsvp-20s-9x16", prompt: "Video di 20 secondi in verticale sull'RSVP senza account per gli invitati.", durationSec: 20, format: "9:16" as const, scenes: ["RsvpFlow"] },
  { name: "tavoli-20s-16x9", prompt: "Video di 20 secondi in orizzontale (16:9) sul piano tavoli del matrimonio.", durationSec: 20, format: "16:9" as const, scenes: ["TableSeating"] },
  { name: "prezzo-10s-9x16", prompt: "Video di 10 secondi in verticale sul prezzo di MatrimonioSemplice.", durationSec: 10, format: "9:16" as const, scenes: ["PriceCard"] },
];

describe.skipIf(!LIVE)("regista con Claude (DIRECTOR_LIVE=1)", () => {
  for (const p of PROMPTS) {
    it(`${p.name}: brief e storyboard validi, durata esatta, solo catalogo`, { timeout: 15 * 60_000 }, async () => {
      const dir = path.join(OUT, p.name);
      mkdirSync(dir, { recursive: true });
      const r = await direct({ prompt: p.prompt, outDir: dir });
      writeFileSync(path.join(dir, "usage.json"), JSON.stringify(r.usage, null, 2) + "\n");

      expect(r.brief.durationSec).toBe(p.durationSec);
      expect(r.brief.format).toBe(p.format);
      const sum = r.storyboard.shots.reduce((a, s) => a + (s.end - s.start), 0);
      expect(sum).toBeCloseTo(p.durationSec, 2);
      for (const s of r.storyboard.shots) expect(() => getScene(s.scene)).not.toThrow();
      for (const name of p.scenes) expect(r.storyboard.shots.map((s) => s.scene)).toContain(name);
      expect(lintStoryboard({ brief: r.brief, storyboard: r.storyboard, facts, expect: { durationSec: p.durationSec, format: p.format } }).errors).toEqual([]);
      expect(r.usage.calls).toBeLessThanOrEqual(3);
    });
  }
});
