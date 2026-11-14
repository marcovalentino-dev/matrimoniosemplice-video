import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DURATION_RULES, catalogMarkdown } from "../scenes/catalog.ts";
import { SCENES, SCENE_NAMES, getScene, makeCtx, prepareProps, renderFrame } from "../scenes/index.ts";
import { loadPrices } from "../scenes/_shared/prices.ts";
import { ROOT } from "../theme/tokens.ts";
import { hexesOutsideTokens, pureBlackInSource } from "../theme/render-test.ts";
import { FORMAT_IDS } from "../theme/safe-area.ts";

const EXPECTED = ["TitleCard", "HookText", "ChatChaos", "SpreadsheetChaos", "PhoneMockupSite", "RsvpFlow", "GuestDashboard", "GiftFundCard", "TableSeating", "PlanningChecklist", "PriceCard", "KineticList", "EndCard"];

describe("catalogo scene", () => {
  it("contiene le 13 scene richieste", () => expect(SCENE_NAMES).toEqual(EXPECTED));
  it("getScene rifiuta scene fuori catalogo con E_GAP", () => expect(() => getScene("Inventata")).toThrow(/E_GAP|catalogo/));
  it("ogni scena ha regola di durata e schema che accetta le props d'esempio", () => {
    expect(Object.keys(DURATION_RULES).sort()).toEqual([...EXPECTED].sort());
    for (const s of SCENES) expect(() => s.schema.parse(s.preview.props), s.name).not.toThrow();
  });
  it("durata minima <= consigliata e istante di prova dentro lo shot", () => {
    for (const s of SCENES) {
      const d = s.duration(s.schema.parse(s.preview.props));
      expect(d.min, s.name).toBeGreaterThan(0);
      expect(d.min, s.name).toBeLessThanOrEqual(d.recommended);
      expect(s.preview.t, s.name).toBeLessThanOrEqual(d.recommended);
    }
  });
  it("CATALOGO.md è aggiornato (esegui `npm run catalog`)", () => {
    const file = readFileSync(path.join(import.meta.dirname, "..", "scenes", "CATALOGO.md"), "utf8");
    expect(file).toBe(catalogMarkdown());
  });
});

describe("render delle scene (puro)", () => {
  it("HTML senza nero puro né colori fuori dai token, in entrambi i formati e a più istanti", async () => {
    for (const s of SCENES) {
      const props = await prepareProps(s, s.preview.props);
      const dur = s.duration(props).recommended;
      for (const f of FORMAT_IDS) {
        const ctx = makeCtx(f, dur);
        for (const t of [0, s.preview.t, dur]) {
          const html = renderFrame(s, props, t, ctx);
          expect(pureBlackInSource(html), `${s.name} ${f} t=${t}`).toEqual([]);
          expect(hexesOutsideTokens(html), `${s.name} ${f} t=${t}`).toEqual([]);
          expect(html).not.toMatch(/NaN|undefined/);
        }
      }
    }
  });
  it("deterministico: stesso t, stessa stringa", async () => {
    for (const s of SCENES) {
      const props = await prepareProps(s, s.preview.props);
      const ctx = makeCtx("9:16", s.duration(props).recommended);
      expect(renderFrame(s, props, s.preview.t, ctx), s.name).toBe(renderFrame(s, props, s.preview.t, ctx));
    }
  });
  it("il sorgente delle scene non usa Date.now né Math.random", () => {
    const dir = path.join(import.meta.dirname, "..", "scenes");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(d, e.name));
        else if (e.name.endsWith(".ts") && !/test-frames|catalog/.test(e.name)) files.push(path.join(d, e.name));
      }
    };
    walk(dir);
    for (const f of files) expect(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""), f).not.toMatch(/Date\.now|Math\.random|performance\.now/);
  });
  it("cue dentro la durata dello shot", async () => {
    for (const s of SCENES) {
      if (!s.cues) continue;
      const props = await prepareProps(s, s.preview.props);
      const dur = s.duration(props).min;
      for (const c of s.cues(props, makeCtx("9:16", dur))) expect(c.t, s.name).toBeLessThanOrEqual(dur);
    }
  });
  it("planning e tavoli mostrano sempre l'etichetta Premium", async () => {
    for (const name of ["PlanningChecklist", "TableSeating"]) {
      const s = getScene(name);
      const props = await prepareProps(s, s.preview.props);
      expect(renderFrame(s, props, 3, makeCtx("9:16", 8))).toContain(">Premium<");
    }
  });
  it("RsvpFlow non ha campi di login o password", async () => {
    const s = getScene("RsvpFlow");
    const html = renderFrame(s, await prepareProps(s, {}), 3, makeCtx("9:16", 9));
    expect(html).not.toMatch(/password|accedi|login|registrati/i);
  });
  it("la scena GiftFundCard mostra solo puntini al posto dell'IBAN", async () => {
    const s = getScene("GiftFundCard");
    const html = renderFrame(s, await prepareProps(s, {}), 3, makeCtx("9:16", 6));
    expect(html).not.toMatch(/IT\d{2}/);
  });
});

describe("PriceCard e prezzi", () => {
  it("legge i prezzi da brand/prezzi.json", async () => {
    const r = await loadPrices();
    expect(r.prices).toMatchObject({ mensile: 12, unaTantum: 79, valuta: "EUR", source: "brand/prezzi.json" });
    const s = getScene("PriceCard");
    const props = await prepareProps(s, {});
    const html = renderFrame(s, props, 3, makeCtx("9:16", 6));
    expect(html).toContain(">12<");
    expect(html).toContain(">79<");
    expect(html).not.toContain("[PREZZO]");
  });
  it("senza file mostra il segnaposto [PREZZO] e nessuna cifra", async () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), "ms-prices-"));
    const r = await loadPrices(empty);
    expect(r.prices).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
    const s = getScene("PriceCard");
    const html = renderFrame(s, s.schema.parse({}), 3, makeCtx("9:16", 6));
    expect(html).toContain("[PREZZO]");
  });
  it("usa content/commercial.ts se esiste con la forma attesa", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ms-prices-"));
    mkdirSync(path.join(root, "content"));
    writeFileSync(path.join(root, "content", "commercial.ts"), "export const commercial = { mensile: 15, unaTantum: 99 };\n");
    const r = await loadPrices(root);
    expect(r.prices).toMatchObject({ mensile: 15, unaTantum: 99, source: "content/commercial.ts" });
  });
  it("commercial.ts con forma sconosciuta: avviso e ripiego su prezzi.json", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ms-prices-"));
    mkdirSync(path.join(root, "content"));
    mkdirSync(path.join(root, "brand"));
    writeFileSync(path.join(root, "content", "commercial.ts"), "export const plans = [];\n");
    writeFileSync(path.join(root, "brand", "prezzi.json"), readFileSync(path.join(ROOT, "brand", "prezzi.json")));
    const r = await loadPrices(root);
    expect(r.prices?.source).toBe("brand/prezzi.json");
    expect(r.warnings.join(" ")).toMatch(/commercial\.ts/);
  });
});
