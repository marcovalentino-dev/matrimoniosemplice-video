import { readFileSync } from "node:fs";

export interface Fact {
  id: string;
  /** Testo della riga (promessa di valore o nome della funzione). */
  text: string;
  /** Cosa è verificabile (solo per le funzionalità). */
  detail: string;
  /** "Gratuito", "Premium", "—"... come scritto nel file. */
  plan: string;
  kind: "promessa" | "funzione";
}

const clean = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "").trim();

export function slugify(s: string, max = 64): string {
  const base = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= max) return base;
  const cut = base.slice(0, max);
  const i = cut.lastIndexOf("-");
  return i > 10 ? cut.slice(0, i) : cut;
}

function tableRows(md: string, heading: string): string[][] {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("## ") && l.toLowerCase().includes(heading.toLowerCase()));
  if (start < 0) return [];
  const rows: string[][] = [];
  for (const l of lines.slice(start + 1)) {
    if (l.startsWith("## ")) break;
    if (!l.trim().startsWith("|")) continue;
    const cells = l.trim().replace(/^\||\|$/g, "").split("|").map(clean);
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separatore
    rows.push(cells);
  }
  return rows.slice(1); // via l'intestazione
}

/** Estrae da PRODOTTO_FATTI.md i fatti citabili, con un id stabile (slug della prima colonna). */
export function parseFacts(md: string): Fact[] {
  const facts: Fact[] = [];
  for (const r of tableRows(md, "Promesse di valore")) {
    facts.push({ id: slugify(r[0]!), text: r[0]!, detail: "", plan: "—", kind: "promessa" });
  }
  for (const r of tableRows(md, "Funzionalità")) {
    facts.push({ id: slugify(r[0]!), text: r[0]!, detail: r[1] ?? "", plan: r[2] ?? "—", kind: "funzione" });
  }
  const ids = new Set<string>();
  for (const f of facts) {
    if (ids.has(f.id)) throw new Error(`Id fatto duplicato in PRODOTTO_FATTI: ${f.id}`);
    ids.add(f.id);
  }
  return facts;
}

export function loadFacts(file: string): { md: string; facts: Fact[] } {
  const md = readFileSync(file, "utf8");
  return { md, facts: parseFacts(md) };
}
