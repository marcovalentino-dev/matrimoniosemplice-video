// Interfaccia ricreata del sito matrimonio (schermo del telefono 518x968). Dati fittizi, nessuno screenshot.
import { esc } from "./html.ts";
import { icon, pill } from "./ui.ts";
import { color } from "../../theme/tokens.ts";

export const SECTION_KINDS = ["storia", "programma", "galleria", "fondoRegalo", "countdown", "viaggio", "rsvp"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Testata del sito: eyebrow, nomi, filetto champagne, data e luogo (fittizi). */
export function siteHero(names: [string, string], date: string, place: string): string {
  return `<div class="abs sans eb" style="left:0;top:150px;width:518px;text-align:center;font-size:22px">Ci sposiamo</div>
<div class="abs hd" style="left:0;top:184px;width:518px;text-align:center;font-size:94px;line-height:1.04;font-weight:400">${esc(names[0])}<br><i>&amp;</i> ${esc(names[1])}</div>
<div class="abs" style="left:229px;top:402px;width:60px;height:2px;background:var(--c-champagne)"></div>
<div class="abs sans" style="left:0;top:424px;width:518px;text-align:center;font-size:30px;font-weight:500">${esc(date)}</div>
<div class="abs sans" style="left:0;top:468px;width:518px;text-align:center;font-size:25px;color:var(--c-muted)">${esc(place)}</div>`;
}

const title = (text: string) => `<div class="abs hd" style="left:28px;top:28px;font-size:38px">${esc(text)}</div>`;
const skl = (x: number, y: number, w: number, h = 14) => `<div class="abs skl" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`;

/** Una sezione del sito come card bianca. Ritorna html e altezza. `pressed` = stato del bottone RSVP (0..1). */
export function siteSection(kind: SectionKind, y: number, pressed = 0): { html: string; h: number } {
  const wrap = (h: number, inner: string) => ({
    h,
    html: `<div class="card abs" style="left:28px;top:${y}px;width:462px;height:${h}px">${inner}</div>`,
  });
  switch (kind) {
    case "storia":
      return wrap(
        360,
        title("La nostra storia") +
          `<div class="abs" style="left:28px;top:96px;width:406px;height:130px;border-radius:12px;background:linear-gradient(135deg,${color.goldPale},${color.blushLight})"></div>` +
          skl(28, 252, 406) + skl(28, 284, 340) + skl(28, 316, 260),
      );
    case "programma":
      return wrap(
        340,
        title("Programma") +
          ["Cerimonia", "Aperitivo", "Cena"]
            .map(
              (l, i) =>
                `<div class="abs" style="left:28px;top:${108 + i * 70}px;width:14px;height:14px;border-radius:50%;background:var(--c-blush)"></div>` +
                `<div class="abs sans" style="left:60px;top:${96 + i * 70}px;font-size:28px;font-weight:500">${l}</div>` +
                skl(320, 106 + i * 70, 114, 14),
            )
            .join(""),
      );
    case "galleria":
      return wrap(
        300,
        title("Gallery") +
          [color.goldPale, color.blushLight, color.parchment]
            .map((c, i) => `<div class="abs" style="left:${28 + i * 140}px;top:100px;width:126px;height:160px;border-radius:12px;background:${c};border:1px solid var(--c-border)"></div>`)
            .join(""),
      );
    case "fondoRegalo":
      return wrap(
        300,
        title("Fondo regalo") +
          `<div class="abs sans" style="left:28px;top:84px;font-size:25px;color:var(--c-muted)">Lista nozze senza commissioni</div>` +
          `<div class="abs" style="left:28px;top:150px">${pill("Scopri", { fs: 26, w: 220, h: 84 })}</div>` +
          `<div class="abs" style="left:350px;top:150px;width:84px;height:84px;border-radius:50%;background:var(--c-blush-light);display:flex;align-items:center;justify-content:center">${icon("gift", 44)}</div>`,
      );
    case "countdown":
      return wrap(
        270,
        title("Mancano") +
          [["118", "giorni"], ["06", "ore"], ["42", "min"], ["10", "sec"]]
            .map(
              ([v, l], i) =>
                `<div class="abs" style="left:${28 + i * 104}px;top:104px;width:92px;height:120px;border-radius:12px;background:var(--c-blush-light);text-align:center">` +
                `<div class="serif" style="font-size:44px;font-weight:600;margin-top:22px;line-height:1.1">${v}</div><div class="sans" style="font-size:20px;color:var(--c-muted);margin-top:6px">${l}</div></div>`,
            )
            .join(""),
      );
    case "viaggio":
      return wrap(
        300,
        title("Viaggio di nozze") + skl(28, 100, 406) + skl(28, 132, 320) +
          `<div class="abs" style="left:28px;top:176px;width:84px;height:84px;border-radius:50%;background:var(--c-blush-light);display:flex;align-items:center;justify-content:center">${icon("heart", 44)}</div>`,
      );
    case "rsvp":
      return wrap(
        340,
        `<div class="abs hd" style="left:0;top:34px;width:462px;text-align:center;font-size:42px">Ci sarai?</div>` +
          `<div class="abs sans" style="left:0;top:100px;width:462px;text-align:center;font-size:25px;color:var(--c-muted)">Conferma la tua presenza.</div>` +
          `<div class="abs" style="left:36px;top:178px;transform:scale(${1 - 0.02 * pressed})">${pill("Conferma la presenza", { fs: 26, w: 390, h: 96, pressed })}</div>`,
      );
  }
}
