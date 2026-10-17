import { describe, expect, test } from "bun:test";
import { BATCH_URL, getBatchNavigation } from "./device-navigation";

describe("direct device navigation", () => {
  test("ordinary browsers open the exact study URL in the same tab", () => {
    expect(getBatchNavigation("Mozilla/5.0 Chrome/130", false)).toEqual({ href: "https://pwthor.live/study/batches", target: "_self" });
  });
  test("frames open the exact URL outside the frame", () => {
    expect(getBatchNavigation("Mozilla/5.0 Safari", true)).toEqual({ href: BATCH_URL, target: "_blank" });
  });
  test("Android WebViews hand off to Chrome even when framed", () => {
    const result = getBatchNavigation("Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) Chrome/130", true);
    expect(result.target).toBe("_top");
    expect(result.href).toBe(`intent://pwthor.live/study/batches#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(BATCH_URL)};end`);
  });
  test("ordinary Android Chrome does not receive an app intent", () => {
    expect(getBatchNavigation("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130 Mobile", false).href).toBe(BATCH_URL);
  });
});