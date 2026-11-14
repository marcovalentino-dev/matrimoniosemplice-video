import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { findChrome } from "../cli/doctor.ts";
import { startPreview } from "../cli/preview.ts";
import { EngineError } from "../utils/errors.ts";
import { BOARD_WIDTH, brandTestHtml } from "./brand-test.ts";
import { FONT_FAMILIES, missingFontFiles } from "./fonts.ts";
import { FORMAT_IDS, safeArea } from "./safe-area.ts";
import { ROOT, allTokenHexes, color, forbiddenColors } from "./tokens.ts";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface BrandTestResult {
  png: string;
  width: number;
  height: number;
  checks: Check[];
  ok: boolean;
}

const OUT_DIR = path.join(ROOT, "out", "_test");

/** Hex presenti nell'HTML che non compaiono in tokens.json. */
export function hexesOutsideTokens(html: string, tokenHexes = allTokenHexes()): string[] {
  const used = new Set((html.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toUpperCase()));
  return [...used].filter((h) => !tokenHexes.has(h));
}

/** Riferimenti a nero puro nel sorgente (hex, rgb() pieno, keyword). Le ombre rgba(0,0,0,α) dei token sono ammesse. */
export function pureBlackInSource(html: string): string[] {
  const hits: string[] = [];
  for (const re of [/#000(?:000)?\b/gi, /\brgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/gi, /(?<![-\w])black(?![-\w])/gi]) {
    for (const m of html.matchAll(re)) hits.push(m[0]);
  }
  return hits;
}

function pngSize(buf: Buffer): { w: number; h: number } {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Decodifica il PNG in RGB24 con ffmpeg. */
function decodeRgb(png: string): Buffer {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", png, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], {
    maxBuffer: 512 * 1024 * 1024, windowsHide: true,
  });
  if (r.status !== 0) throw new EngineError("E_ENV", `ffmpeg non riesce a leggere ${png}: ${r.stderr?.toString()}`);
  return r.stdout;
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

export async function renderBrandTest(): Promise<BrandTestResult> {
  const cfg = JSON.parse(readFileSync(path.join(ROOT, "engine", "engine.config.json"), "utf8"));
  const chrome = findChrome(cfg.chromePath);
  if (!chrome) throw new EngineError("E_ENV", "Chrome non trovato.");

  mkdirSync(OUT_DIR, { recursive: true });
  const html = brandTestHtml("/");
  const htmlPath = path.join(OUT_DIR, "brand.html");
  const pngPath = path.join(OUT_DIR, "brand.png");
  writeFileSync(htmlPath, html);

  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  // --- controlli sul sorgente ---
  const missing = missingFontFiles();
  add("file dei font presenti in assets/fonts", missing.length === 0, missing.length ? `mancano: ${missing.join(", ")}` : "3 file");
  const black = pureBlackInSource(html);
  add("nessun nero puro (#000000) nel sorgente", black.length === 0, black.length ? `trovati: ${black.join(", ")}` : "0 occorrenze");
  const stray = hexesOutsideTokens(html);
  add("ogni hex usato esiste in tokens.json", stray.length === 0, stray.length ? `fuori token: ${stray.join(", ")}` : "tutti presenti");

  const srv = await startPreview(ROOT);
  const port = (srv.address() as { port: number }).port;
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("requestfailed", (r) => errors.push(`richiesta fallita: ${r.url()}`));
    await page.setViewport({ width: BOARD_WIDTH, height: 1200, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/out/_test/brand.html`, { waitUntil: "networkidle0" });

    const faces = await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('700 88px "Playfair Display"'),
        document.fonts.load('italic 600 56px "Playfair Display"'),
        document.fonts.load('400 16px "Inter"'),
        document.fonts.load('600 14px "Inter"'),
      ]);
      await document.fonts.ready;
      return [...document.fonts].map((f) => ({ family: f.family.replace(/"/g, ""), style: f.style, status: f.status }));
    });
    const loaded = faces.filter((f) => f.status === "loaded");
    add("font caricati dai file locali", loaded.length === 3 && faces.length === 3, faces.map((f) => `${f.family} ${f.style}: ${f.status}`).join("; "));

    const used = await page.evaluate(() => {
      const fams = new Set<string>();
      for (const el of document.body.querySelectorAll("*")) {
        if (!(el.textContent ?? "").trim() || [...el.children].some((c) => (c.textContent ?? "").trim() === (el.textContent ?? "").trim())) continue;
        fams.add(getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/"/g, ""));
      }
      return [...fams];
    });
    add("al massimo 2 famiglie nella composizione", used.length <= 2 && used.every((f) => FONT_FAMILIES.includes(f)), used.join(", "));

    const geo = await page.evaluate((expected) => {
      const chips = [...document.querySelectorAll<HTMLElement>(".chip")].map((el) => {
        const r = el.getBoundingClientRect();
        return { token: el.dataset.token!, hex: el.dataset.hex!, x: Math.floor(r.left + r.width / 2), y: Math.floor(r.top + r.height / 2 + window.scrollY) };
      });
      const safes = [...document.querySelectorAll<HTMLElement>("[data-safe]")].map((el) => {
        const r = el.getBoundingClientRect();
        const inner = [...el.querySelectorAll("*")].map((c) => c.getBoundingClientRect());
        const outside = inner.filter((c) => c.left < r.left - 0.5 || c.top < r.top - 0.5 || c.right > r.right + 0.5 || c.bottom > r.bottom + 0.5).length;
        return { format: el.dataset.safe!, w: r.width, h: r.height, outside };
      });
      return { chips, safes, height: Math.ceil(document.documentElement.scrollHeight), expected };
    }, null);

    await page.setViewport({ width: BOARD_WIDTH, height: geo.height, deviceScaleFactor: 1 });
    await page.screenshot({ path: pngPath, type: "png", clip: { x: 0, y: 0, width: BOARD_WIDTH, height: geo.height } });
    add("nessun errore di pagina o di rete", errors.length === 0, errors.join("; ") || "0 errori");

    // --- controlli sull'immagine ---
    const buf = readFileSync(pngPath);
    const { w, h } = pngSize(buf);
    const rgb = decodeRgb(pngPath);
    add("dimensioni immagine", w === BOARD_WIDTH && rgb.length === w * h * 3, `${w}×${h}`);

    const bad: string[] = [];
    for (const c of geo.chips) {
      const i = (c.y * w + c.x) * 3;
      const got = "#" + hex2(rgb[i]) + hex2(rgb[i + 1]) + hex2(rgb[i + 2]);
      if (got.toUpperCase() !== c.hex.toUpperCase()) bad.push(`${c.token}: atteso ${c.hex}, letto ${got.toUpperCase()}`);
    }
    add(`i ${geo.chips.length} colori renderizzati coincidono con tokens.json`, bad.length === 0 && geo.chips.length === Object.keys(color).length, bad.join("; ") || "pixel identici");

    let blackPx = 0;
    for (let i = 0; i < rgb.length; i += 3) if (rgb[i] === 0 && rgb[i + 1] === 0 && rgb[i + 2] === 0) blackPx++;
    add("nessun pixel #000000 nell'immagine", blackPx === 0 && forbiddenColors.includes("#000000"), `${blackPx} pixel`);

    for (const sa of FORMAT_IDS.map(safeArea)) {
      const g = geo.safes.find((s) => s.format === sa.format);
      const scale = g ? g.w / sa.width : 0;
      const dimsOk = !!g && Math.abs(g.h / scale - sa.height) < 1;
      add(`safe area ${sa.format}: misure e contenuto interno`, dimsOk && g!.outside === 0, g ? `${sa.width}×${sa.height} px, elementi fuori: ${g.outside}` : "frame non trovato");
    }

    await page.close();
    return { png: pngPath, width: w, height: h, checks, ok: checks.every((c) => c.ok) };
  } finally {
    await browser.close();
    srv.close();
  }
}
