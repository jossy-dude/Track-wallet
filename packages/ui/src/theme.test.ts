import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "vitest";

const themeCss = readFileSync(resolve(__dirname, "./theme.css"), "utf8");

test("theme fonts resolve from bundled local packages only", () => {
  assert.match(themeCss, /@import "@fontsource-variable\/nunito-sans\/full.css";/);
  assert.match(themeCss, /@import "@fontsource\/literata\/400.css";/);
  assert.match(themeCss, /@import "@fontsource\/literata\/700.css";/);
  assert.doesNotMatch(themeCss, /fonts\.googleapis\.com/i);
  assert.doesNotMatch(themeCss, /fonts\.gstatic\.com/i);
});
