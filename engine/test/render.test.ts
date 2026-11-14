import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { StoryboardSchema } from "../schemas/storyboard.ts";
import { composeFrame, prepareShots, selectTrack, verifyProbe } from "../render/index.ts";
import fixture from "./fixtures/storyboard-10s.json" with { type: "json" };

const tmp = mkdtempSync(path.join(os.tmpdir(), "ms-audio-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
writeFileSync(path.join(tmp, "a.wav"), "x");
const track = (o: Record<string, unknown>) => ({ id: "t", file: "a.wav", titolo: "T", durata: 30, tag: ["caldo"], licenza: "CC0", fonte: "https://esempio.test", ...o });
const music = { mood: "caldo-minimale", bpm: 96, fadeIn: 1, fadeOut: 2 };

describe("selezione audio", () => {
  it("senza tracce esporta senza audio e dice perché", () => {
    const s = selectTrack({ tracks: [] }, music, 10, tmp);
    expect(s.track).toBeNull();
    expect(s.reason).toMatch(/vuoto/);
  });
  it("scarta le tracce senza licenza o fonte registrata, o col file mancante", () => {
    const idx = [track({ id: "a", licenza: "" }), track({ id: "b", fonte: "TODO" }), track({ id: "c", file: "manca.wav" })];
    const s = selectTrack(idx, music, 10, tmp);
    expect(s.track).toBeNull();
    expect(s.rejected.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(s.reason).toMatch(/licenza registrata/);
  });
  it("sceglie per tag, poi bpm; a parità vince l'id minore", () => {
    const idx = [track({ id: "z", tag: ["caldo", "minimale"], bpm: 96 }), track({ id: "b", tag: ["caldo", "minimale"], bpm: 96 }), track({ id: "x", tag: ["rock"] })];
    expect(selectTrack(idx, music, 10, tmp).track?.id).toBe("b");
  });
  it("richiede almeno un tag in comune", () => {
    const s = selectTrack([track({ tag: ["rock"] })], music, 10, tmp);
    expect(s.track).toBeNull();
    expect(s.reason).toMatch(/tag compatibili/);
  });
  it("segnala il loop se la traccia è più corta del video", () => {
    expect(selectTrack([track({ durata: 6 })], music, 10, tmp).looped).toBe(true);
  });
  it("senza `music` nello storyboard non sceglie nulla", () => {
    expect(selectTrack([track({})], undefined, 10, tmp).track).toBeNull();
  });
});

describe("compositore", () => {
  const sb = StoryboardSchema.parse(fixture);
  it("è puro: stesso t, stesso HTML", async () => {
    const shots = await prepareShots(sb);
    for (const t of [0, 0.3, 4.99, 5.2, 9.97]) expect(composeFrame(shots, t)).toBe(composeFrame(shots, t));
  });
  it("a inizio video il cream copre lo shot; a transizione finita c'è un solo strato", async () => {
    const shots = await prepareShots(sb);
    expect(composeFrame(shots, 0)).toContain("background:var(--c-cream);opacity:1");
    expect((composeFrame(shots, 3).match(/position:absolute;left:0;top:0/g) ?? []).length).toBe(1);
  });
  it("durante la dissolvenza ci sono due strati: shot uscente fermo e shot entrante in opacità", async () => {
    const shots = await prepareShots(sb);
    const html = composeFrame(shots, 5.3);
    expect((html.match(/position:absolute;left:0;top:0/g) ?? []).length).toBe(2);
    expect(html).toMatch(/opacity:0\.\d+/);
  });
  it("non usa nero puro", async () => {
    const shots = await prepareShots(sb);
    expect(composeFrame(shots, 5.3).toLowerCase()).not.toContain("#000000");
  });
});

describe("verifica ffprobe", () => {
  const sb = StoryboardSchema.parse(fixture);
  const ok = { durationSec: 10, w: 1080, h: 1920, fps: 30, vcodec: "h264", pixFmt: "yuv420p", acodec: "aac", sampleRate: 48000, audioDurationSec: 10, frames: 300 };
  it("accetta un file conforme", () => expect(verifyProbe(ok, sb, true)).toEqual([]));
  it("segnala durata, risoluzione, fps e audio sbagliati", () => {
    const bad = verifyProbe({ ...ok, durationSec: 9.5, w: 540, fps: 15, acodec: null, frames: 150 }, sb, true);
    expect(bad.length).toBe(5);
  });
  it("senza audio atteso, un'audio presente è un errore", () => expect(verifyProbe(ok, sb, false)).toHaveLength(1));
});

describe("musica sintetizzata", () => {
  it("produce un WAV della durata giusta, vicino a -14 LUFS e sotto -1 dBTP", async () => {
    const { synthMusic } = await import("../render/synth.ts");
    const { mixMusic } = await import("../render/audio.ts");
    const { spawnSync } = await import("node:child_process");
    const raw = path.join(tmp, "synth.wav");
    const mix = path.join(tmp, "synth-mix.wav");
    const log = () => {};
    synthMusic({ bpm: 96, duration: 6, out: raw, log });
    const l = mixMusic({ src: raw, out: mix, duration: 6, fadeIn: 1, fadeOut: 2, targetLUFS: -14, truePeakDb: -1, log });
    expect(Math.abs(l.integratedLUFS + 14)).toBeLessThan(1.5);
    expect(l.truePeakDb).toBeLessThan(-0.7);
    const d = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mix], { encoding: "utf8" });
    expect(Number(d.stdout.trim())).toBeCloseTo(6, 1);
  }, 60000);
});
