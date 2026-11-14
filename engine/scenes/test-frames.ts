import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import puppeteer, { type Page } from "puppeteer-core";
import { findChrome } from "../cli/doctor.ts";
import { startPreview } from "../cli/preview.ts";
import { EngineError } from "../utils/errors.ts";
import { fontFaceCss, FONT_FAMILIES } from "../theme/fonts.ts";
import { hexesOutsideTokens, pureBlackInSource } from "../theme/render-test.ts";
import { FORMAT_IDS, safeArea, type FormatId } from "../theme/safe-area.ts";
import { ROOT } from "../theme/tokens.ts";
import { SCENES, hostHtml, makeCtx, prepareProps, renderFrame, type AnyScene } from "./index.ts";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
export interface FrameResult {
  scene: string;
  format: FormatId;
  t: number;
  dur: number;
  png: string;
  checks: Check[];
}
export interface SceneTestResult {
  frames: FrameResult[];
  sheets: string[];
  ok: boolean;
}

const OUT_DIR = path.join(ROOT, "out", "_test", "scenes");
const SHEET_DIR = path.join(ROOT, "out", "_test");
const slug = (f: FormatId) => f.replace(":", "x");
const MIN_FONT: Record<FormatId, number> = { "9:16": 36, "16:9": 28 };

/** Pixel #000000 in un PNG (decodifica con ffmpeg). */
function blackPixels(png: string): number {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", png, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 512 * 1024 * 1024, windowsHide: true });
  if (r.status !== 0) throw new EngineError("E_ENV", `ffmpeg non legge ${png}: ${r.stderr?.toString()}`);
  const b = r.stdout;
  let n = 0;
  for (let i = 0; i < b.length; i += 3) if (b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 0) n++;
  return n;
}

interface DomReport {
  fonts: string[];
  small: string[];
  outside: string[];
  texts: number;
}

/** Lint DOM sul fotogramma corrente: font usati, testo troppo piccolo, testo fuori dalla safe area. Il testo dei mockup è escluso da dimensione e safe area. */
async function domLint(page: Page, format: FormatId): Promise<DomReport> {
  const sa = safeArea(format);
  return page.evaluate(
    (safe, minFont) => {
      const root = document.getElementById("root")!;
      const opacity = (el: Element) => {
        let o = 1;
        for (let e: Element | null = el; e && e !== root.parentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
        return o;
      };
      const rep = { fonts: new Set<string>(), small: [] as string[], outside: [] as string[], texts: 0 };
      for (const el of root.querySelectorAll("*")) {
        const own = [...el.childNodes].filter((n) => n.nodeType === 3 && (n.textContent ?? "").trim()).map((n) => n.textContent!.trim()).join(" ");
        if (!own) continue;
        const cs = getComputedStyle(el);
        rep.fonts.add(cs.fontFamily.split(",")[0].trim().replace(/"/g, ""));
        if (opacity(el) < 0.5 || cs.display === "none") continue;
        rep.texts++;
        if (el.closest("[data-mock]")) continue;
        const size = parseFloat(cs.fontSize);
        if (size < minFont) rep.small.push(`"${own.slice(0, 30)}" ${size}px`);
        const r = el.getBoundingClientRect();
        if (r.left < safe.x - 1 || r.top < safe.y - 1 || r.right > safe.x + safe.width + 1 || r.bottom > safe.y + safe.height + 1) {
          rep.outside.push(`"${own.slice(0, 30)}" [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}]`);
        }
      }
      return { ...rep, fonts: [...rep.fonts] };
    },
    { x: sa.x, y: sa.y, width: sa.width, height: sa.height },
    MIN_FONT[format],
  );
}

async function setFrame(page: Page, html: string): Promise<void> {
  await page.evaluate(async (h) => {
    document.getElementById("root")!.innerHTML = h;
    await document.fonts.ready;
  }, html);
}

async function shot(page: Page, file: string, w: number, h: number): Promise<Buffer> {
  const buf = (await page.screenshot({ path: file as `${string}.png`, type: "png", clip: { x: 0, y: 0, width: w, height: h } })) as Uint8Array;
  return Buffer.from(buf);
}

function sheetHtml(format: FormatId, rows: FrameResult[]): string {
  const portrait = format === "9:16";
  const sa = safeArea(format);
  const thumbW = portrait ? 300 : 520;
  const thumbH = Math.round((thumbW * sa.h) / sa.w);
  const cols = portrait ? 7 : 4;
  const cells = rows
    .map((r) => {
      const bad = r.checks.filter((c) => !c.ok).length;
      return `<figure><div class="img" style="width:${thumbW}px;height:${thumbH}px"><img src="/out/_test/scenes/${path.basename(r.png)}" width="${thumbW}" height="${thumbH}"></div><figcaption><b>${r.scene}</b><br>${r.format} · t ${r.t} s · shot ${r.dur} s${bad ? ` · <span class="bad">${bad} controlli falliti</span>` : ""}</figcaption></figure>`;
    })
    .join("");
  const width = cols * thumbW + (cols - 1) * 28 + 96;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss("/")}
body{margin:0;background:#F3ECE8;font-family:"Inter",sans-serif;color:#1E1E1E}
.sheet{width:${width}px;padding:40px 48px 48px;box-sizing:border-box}
h1{font:600 28px "Inter";margin:0 0 6px}p{font:400 15px "Inter";color:#4A4A4A;margin:0 0 28px}
.grid{display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:32px 28px}
figure{margin:0}.img{border:1px solid #EFEAE7;box-shadow:0 2px 16px rgba(30,30,30,.08);overflow:hidden;background:#FFFFFF}img{display:block}
figcaption{font:400 14px/1.4 "Inter";margin-top:8px;color:#4A4A4A}figcaption b{color:#1E1E1E;font-weight:600}.bad{color:#B3261E;font-weight:600}
</style></head><body><div class="sheet"><h1>Catalogo scene · ${format}</h1><p>Un fotogramma di prova per scena, props d'esempio (CATALOGO.md). Safe area ${sa.left}/${sa.top}/${sa.bottom}/${sa.right} px.</p><div class="grid">${cells}</div></div></body></html>`;
}

/**
 * Renderizza un fotogramma di prova per ogni scena e formato in out/_test/scenes/, esegue i controlli
 * (nero puro, font, dimensioni, safe area, determinismo, token) e costruisce i contact sheet.
 */
export async function renderSceneFrames(only?: string[]): Promise<SceneTestResult> {
  const cfg = JSON.parse(readFileSync(path.join(ROOT, "engine", "engine.config.json"), "utf8"));
  const chrome = findChrome(cfg.chromePath);
  if (!chrome) throw new EngineError("E_ENV", "Chrome non trovato.");
  mkdirSync(OUT_DIR, { recursive: true });

  const scenes: AnyScene[] = only?.length ? SCENES.filter((s) => only.includes(s.name)) : SCENES;
  const srv = await startPreview(ROOT);
  const port = (srv.address() as { port: number }).port;
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  const frames: FrameResult[] = [];
  const sheets: string[] = [];
  try {
    for (const format of FORMAT_IDS) {
      const sa = safeArea(format);
      const hostFile = path.join(OUT_DIR, `host-${slug(format)}.html`);
      writeFileSync(hostFile, hostHtml(format, "/"));
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("requestfailed", (r) => errors.push(`richiesta fallita: ${r.url()}`));
      await page.setViewport({ width: sa.w, height: sa.h, deviceScaleFactor: 1 });
      await page.goto(`http://127.0.0.1:${port}/out/_test/scenes/host-${slug(format)}.html`, { waitUntil: "networkidle0" });
      await page.evaluate(async () => {
        await Promise.all([
          document.fonts.load('700 88px "Playfair Display"'), document.fonts.load('italic 400 56px "Playfair Display"'),
          document.fonts.load('600 40px "Playfair Display"'), document.fonts.load('400 16px "Inter"'), document.fonts.load('600 14px "Inter"'),
        ]);
        await document.fonts.ready;
      });

      for (const scene of scenes) {
        const props = await prepareProps(scene, scene.preview.props);
        const dur = scene.duration(props).recommended;
        const ctx = makeCtx(format, dur);
        const t = scene.preview.t;
        const html = renderFrame(scene, props, t, ctx);
        const png = path.join(OUT_DIR, `${scene.name}-${slug(format)}.png`);
        const checks: Check[] = [];
        const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

        add("istante di prova dentro lo shot", t > 0 && t <= dur, `t = ${t} s, shot ${dur} s`);
        const black = pureBlackInSource(html);
        add("nessun nero puro nel sorgente", black.length === 0, black.length ? black.join(", ") : "0 occorrenze");
        const stray = hexesOutsideTokens(html);
        add("ogni hex esiste in tokens.json", stray.length === 0, stray.length ? stray.join(", ") : "tutti presenti");

        await setFrame(page, html);
        const a = await shot(page, png, sa.w, sa.h);
        const dom = await domLint(page, format);
        add("al massimo 2 famiglie di font", dom.fonts.length <= 2 && dom.fonts.every((f) => FONT_FAMILIES.includes(f)), dom.fonts.join(", ") || "nessun testo");
        add(`testo reale ≥ ${MIN_FONT[format]} px (mockup esclusi)`, dom.small.length === 0, dom.small.join("; ") || `${dom.texts} testi visibili`);
        add("testo reale dentro la safe area", dom.outside.length === 0, dom.outside.join("; ") || "ok");
        const bp = blackPixels(png);
        add("nessun pixel #000000 nell'immagine", bp === 0, `${bp} pixel`);

        // Determinismo: stesso t, stessi pixel.
        await setFrame(page, "");
        await setFrame(page, renderFrame(scene, props, t, ctx));
        const b = await shot(page, path.join(OUT_DIR, "_again.png"), sa.w, sa.h);
        add("determinismo (stesso t, stessi pixel)", a.equals(b), a.equals(b) ? "identico" : "i pixel cambiano tra due render");

        frames.push({ scene: scene.name, format, t, dur, png, checks });
      }
      add_page_errors(frames, format, errors);
      await page.close();

      // Contact sheet del formato
      const rows = frames.filter((f) => f.format === format);
      const sheetHtmlFile = path.join(OUT_DIR, `sheet-${slug(format)}.html`);
      writeFileSync(sheetHtmlFile, sheetHtml(format, rows));
      const sp = await browser.newPage();
      await sp.setViewport({ width: 2400, height: 1200, deviceScaleFactor: 1 });
      await sp.goto(`http://127.0.0.1:${port}/out/_test/scenes/sheet-${slug(format)}.html`, { waitUntil: "networkidle0" });
      const h = await sp.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
      const w = await sp.evaluate(() => Math.ceil((document.querySelector(".sheet") as HTMLElement).getBoundingClientRect().width));
      const sheetPng = path.join(SHEET_DIR, `scenes-contact-sheet-${slug(format)}.png`);
      await sp.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await sp.screenshot({ path: sheetPng as `${string}.png`, type: "png", clip: { x: 0, y: 0, width: w, height: h } });
      await sp.close();
      sheets.push(sheetPng);
    }
  } finally {
    await browser.close();
    srv.close();
  }
  return { frames, sheets, ok: frames.every((f) => f.checks.every((c) => c.ok)) };
}

function add_page_errors(frames: FrameResult[], format: FormatId, errors: string[]): void {
  const last = [...frames].reverse().find((f) => f.format === format);
  if (last) last.checks.push({ name: `nessun errore di pagina o di rete (${format})`, ok: errors.length === 0, detail: errors.join("; ") || "0 errori" });
}
