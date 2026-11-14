import type { Brief } from "../schemas/brief.ts";
import type { Storyboard } from "../schemas/storyboard.ts";

const clean = (s: string) => s.replace(/\*/g, "").replace(/\\n|\n/g, " ").replace(/\s+/g, " ").trim();
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const t = (n: number) => n.toFixed(1).padStart(4);

/** Il piano da leggere prima del render: tabella con timecode, testi a schermo, cose da fornire, avvisi. */
export function formatPlan(brief: Brief, sb: Storyboard, o: { warnings: string[]; blockers: string[] }): string {
  const L: string[] = [];
  L.push(`PIANO  ${brief.slug} — ${sb.durationSec} s, ${sb.format} (${sb.size.w}x${sb.size.h}, ${sb.fps} fps), palette ${sb.theme.palette}, audio ${brief.audio}`);
  L.push(`Obiettivo: ${brief.goal}`);
  L.push(`Messaggio: ${brief.message}`);
  L.push(`CTA: ${brief.cta.label} — ${brief.cta.url}${brief.cta.approved ? "" : "  (NON approvata)"}`);
  L.push("");
  for (const s of sb.shots) {
    const texts = s.onScreenText.filter((x) => x.role !== "mock").slice(0, 3).map((x) => `“${cut(clean(x.text), 60)}”`);
    L.push(`  ${s.id.padEnd(3)} ${t(s.start)}–${t(s.end)} s  ${s.scene.padEnd(18)} ${texts.join("  ")}`);
  }
  if (sb.music) L.push(`  Musica: ${sb.music.mood}${sb.music.bpm ? `, ${sb.music.bpm} bpm` : ""}, fade ${sb.music.fadeIn}/${sb.music.fadeOut} s`);
  if (brief.needsFromUser.length) {
    L.push("", "Da fornire:");
    for (const n of brief.needsFromUser) L.push(`  - ${n.field}: ${n.reason}`);
  }
  if (brief.assumptions.length) {
    L.push("", "Ipotesi del regista:");
    for (const a of brief.assumptions) L.push(`  - ${a}`);
  }
  if (o.warnings.length) {
    L.push("", "Avvisi del lint:");
    for (const w of o.warnings) L.push(`  - ${w}`);
  }
  if (o.blockers.length) {
    L.push("", "Niente approvazione automatica:");
    for (const b of o.blockers) L.push(`  - ${b}`);
  }
  return L.join("\n");
}
