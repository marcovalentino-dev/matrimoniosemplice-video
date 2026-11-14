import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { brandTestHtml } from "../theme/brand-test.ts";
import { hexesOutsideTokens, pureBlackInSource, renderBrandTest } from "../theme/render-test.ts";
import { insideSafeArea, safeArea } from "../theme/safe-area.ts";
import { TOKENS_PATH, color, forbiddenColors, loadTokens } from "../theme/tokens.ts";
import { missingFontFiles } from "../theme/fonts.ts";

describe("theme", () => {
  it("i colori coincidono con tokens.json", () => {
    const raw = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
    for (const [k, v] of Object.entries(raw.color) as [string, { value: string }][]) {
      expect(color[k as keyof typeof color]).toBe(v.value.toUpperCase());
    }
    expect(Object.keys(color).length).toBe(Object.keys(raw.color).length);
  });
  it("nero puro vietato e assente; ink è #1E1E1E", () => {
    expect(forbiddenColors).toContain("#000000");
    expect(Object.values(color)).not.toContain("#000000");
    expect(color.ink).toBe("#1E1E1E");
  });
  it("i token incompleti vengono rifiutati", () => {
    expect(() => loadTokens(new URL("../package.json", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"))).toThrow();
  });
  it("font locali presenti", () => expect(missingFontFiles()).toEqual([]));
  it("safe area 9:16 e 16:9", () => {
    const v = safeArea("9:16");
    expect([v.w, v.h, v.x, v.y, v.width, v.height]).toEqual([1080, 1920, 64, 220, 952, 1360]);
    const h = safeArea("16:9");
    expect([h.x, h.y, h.width, h.height]).toEqual([96, 54, 1728, 972]);
    expect(insideSafeArea(v, { x: 64, y: 220, width: 952, height: 1360 })).toBe(true);
    expect(insideSafeArea(v, { x: 0, y: 220, width: 100, height: 100 })).toBe(false);
  });
  it("il rilevatore di nero puro funziona e l'HTML è pulito", () => {
    expect(pureBlackInSource("a{color:#000000}")).toHaveLength(1);
    expect(pureBlackInSource("a{color:black}")).toHaveLength(1);
    expect(pureBlackInSource(brandTestHtml())).toEqual([]);
    expect(hexesOutsideTokens("#123456")).toEqual(["#123456"]);
    expect(hexesOutsideTokens(brandTestHtml())).toEqual([]);
  });
  it("renderizza out/_test/brand.png e supera tutti i controlli", async () => {
    const r = await renderBrandTest();
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
  }, 90000);
});
