import { writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { SCENES, makeCtx, type AnyScene } from "./index.ts";

/** Come scala la durata con le props. Valori in secondi; vedi `duration()` di ogni scena. */
export const DURATION_RULES: Record<string, string> = {
  TitleCard: "max(testo leggibile, ultima entrata + 1,5 s): con sottotitolo l'ultima entrata è a 1,7 s",
  HookText: "parole a 0,1 s l'una dal secondo 0,3; poi + 1,5 s di pausa. Con `sub`, +0,7 s",
  ChatChaos: "0,9 s + messaggi × passo (0,3 / 0,42 / 0,6 s per densità alta / media / bassa) + 1,5 s",
  SpreadsheetChaos: "minimo 3 s; con `caption` 3,1 s. Più lungo = scorrimento più lento (copre al massimo 1250 px)",
  PhoneMockupSite: "1,2 s + (altezza da scorrere ÷ 240 px/s) + 1,2 s; minimo 4 s. Ogni sezione in più allunga di circa 1,5 s",
  RsvpFlow: "fisso: tre tap a 1,5 / 3,0 / 4,3 s, conferma a 5,6 s + 1,5 s di pausa",
  GuestDashboard: "ultima conferma (1,4 s + 0,9 s × conferme) + 1,1 s di riordino + 1,5 s; minimo 4 s",
  GiftFundCard: "tap a 1,9 s, ringraziamento a 2,4 s + 0,7 s + 1,5 s",
  TableSeating: "1,0 s + invitati × 0,55 s + 0,6 s di trascinamento + 1,5 s; minimo 4 s",
  PlanningChecklist: "ultima voce tra spunte (1,0 s + 0,5 s a voce), barre e timeline (2,6 s + 0,35 s a punto) + 1,5 s; minimo 4 s",
  PriceCard: "minimo 4 s: la seconda card entra a 0,8 s e resta ferma almeno 1,5 s",
  KineticList: "minima 0,5 s + (voci − 1) × 1,4 s + 0,7 s + 1,5 s; consigliata con `step` (2 s di default) a voce",
  EndCard: "minimo 4 s: la pillola entra entro 1,0 s e resta ferma almeno 3 s (BRAND_VIDEO §6)",
};

type JS = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function ty(s: JS): string {
  if (s.enum) return s.enum.map((e: string) => `"${e}"`).join(" | ");
  if (s.const !== undefined) return JSON.stringify(s.const);
  switch (s.type) {
    case "string":
      return s.maxLength ? `testo (≤ ${s.maxLength} car.)` : "testo";
    case "integer":
    case "number": {
      const r = s.minimum !== undefined || s.maximum !== undefined ? ` ${s.minimum ?? ""}–${s.maximum ?? ""}` : "";
      return (s.type === "integer" ? "intero" : "numero") + r;
    }
    case "boolean":
      return "sì/no";
    case "array": {
      if (s.prefixItems) return `[${s.prefixItems.map(ty).join(", ")}]`;
      const range = s.minItems !== undefined || s.maxItems !== undefined ? ` (${s.minItems ?? 0}–${s.maxItems ?? "∞"})` : "";
      return `${ty(s.items ?? {})}[]${range}`;
    }
    case "object":
      return `{ ${Object.entries(s.properties ?? {}).map(([k, v]) => `${k}${s.required?.includes(k) ? "" : "?"}: ${ty(v as JS)}`).join("; ")} }`;
  }
  return "valore";
}

const short = (v: unknown, max = 70) => {
  const j = JSON.stringify(v);
  return j.length > max ? j.slice(0, max - 1) + "…" : j;
};

function propsRows(scene: AnyScene): { name: string; type: string; required: boolean; def: string; desc: string }[] {
  const js = z.toJSONSchema(scene.schema, { io: "input", unrepresentable: "any" }) as JS;
  const req: string[] = js.required ?? [];
  return Object.entries(js.properties ?? {}).map(([name, v]) => {
    const s = v as JS;
    return { name, type: ty(s), required: req.includes(name), def: s.default !== undefined ? short(s.default) : "", desc: s.description ?? "" };
  });
}

const secs = (x: number) => String(x).replace(".", ",") + " s";

export function catalogData() {
  return SCENES.map((scene) => {
    const props = scene.schema.parse(scene.preview.props);
    const dur = scene.duration(props);
    const cueTypes = scene.cues ? [...new Set(scene.cues(props, makeCtx("9:16", dur.recommended)).map((c) => c.type))] : [];
    return {
      name: scene.name,
      summary: scene.summary,
      mockup: scene.mockup,
      duration: dur,
      durationRule: DURATION_RULES[scene.name] ?? "",
      cues: cueTypes,
      props: propsRows(scene),
      jsonSchema: z.toJSONSchema(scene.schema, { io: "input", unrepresentable: "any" }),
      preview: scene.preview,
      notes: scene.notes ?? [],
    };
  });
}

export function catalogMarkdown(): string {
  const data = catalogData();
  const lines: string[] = [
    "# Catalogo scene",
    "",
    "Generato da `npm run catalog` a partire dagli schemi (zod) delle scene in `engine/scenes/`: non modificare a mano. La versione per il regista è `CATALOGO.json`.",
    "",
    "Contratto di ogni scena: funzione pura `render(props, t, ctx) → HTML` (nessuno stato, nessun `Date.now`/`Math.random`), tempo locale `t` in secondi, `ctx` con formato, safe area e durata dello shot. Funziona in 9:16 e 16:9. Testo ≥ 36 px (≥ 28 px in 16:9), dentro la safe area; solo token del brand (Playfair Display + Inter, mai `#000000`).",
    "",
    "Le **durate** qui sotto sono calcolate con le props d'esempio; con altre props cambiano (regola nella scheda). \"Minima\" = testo leggibile (1,2 s + 0,30 s a parola, minimo 2 s, fermo almeno 1,5 s) e animazioni completate; \"consigliata\" = respiro in più.",
    "",
    "| Scena | Mockup | Minima | Consigliata |",
    "|---|---|---|---|",
    ...data.map((d) => `| [${d.name}](#${d.name.toLowerCase()}) | ${d.mockup ? "sì" : "no"} | ${secs(d.duration.min)} | ${secs(d.duration.recommended)} |`),
    "",
  ];
  for (const d of data) {
    lines.push(
      `## ${d.name}`,
      "",
      d.summary,
      "",
      `- **Durata**: minima **${secs(d.duration.min)}**, consigliata **${secs(d.duration.recommended)}** (props d'esempio).`,
      `- **Come scala**: ${d.durationRule}.`,
      `- **Mockup**: ${d.mockup ? "sì, interfaccia ricreata in codice con dati fittizi (`mockup: true`, testi `source: mock`)" : "no"}.`,
      `- **Cue audio**: ${d.cues.length ? d.cues.join(", ") : "nessuno"}.`,
      `- **Fotogramma di prova**: \`out/_test/scenes/${d.name}-9x16.png\` e \`${d.name}-16x9.png\` (t = ${d.preview.t} s).`,
      "",
      "| Prop | Tipo | Obbligatoria | Default | Descrizione |",
      "|---|---|---|---|---|",
      ...d.props.map((r) => `| \`${r.name}\` | ${r.type.replace(/\|/g, "\\|")} | ${r.required ? "sì" : "no"} | ${r.def ? "`" + r.def.replace(/\|/g, "\\|") + "`" : "—"} | ${r.desc.replace(/\|/g, "\\|")} |`),
      "",
      "Props d'esempio:",
      "",
      "```json",
      JSON.stringify(d.preview.props, null, 2),
      "```",
      "",
    );
    if (d.notes.length) lines.push(...d.notes.map((x) => `> ${x}`), "");
  }
  return lines.join("\n");
}

export function writeCatalog(dir = import.meta.dirname): { md: string; json: string } {
  const md = path.join(dir, "CATALOGO.md");
  const json = path.join(dir, "CATALOGO.json");
  writeFileSync(md, catalogMarkdown());
  writeFileSync(json, JSON.stringify(catalogData().map(({ jsonSchema, ...rest }) => ({ ...rest, propsSchema: jsonSchema })), null, 2) + "\n");
  return { md, json };
}
