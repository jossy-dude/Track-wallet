// @ts-nocheck
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { MaterialSymbol } from "./MaterialSymbol";

const knownMarkup = renderToStaticMarkup(
  <MaterialSymbol className="text-[18px]" name="add" />,
);

assert.match(knownMarkup, /<svg/);
assert.match(knownMarkup, /data-icon="add"/);
assert.doesNotMatch(knownMarkup, /material-symbols-outlined/);
assert.doesNotMatch(knownMarkup, />add</);

const fallbackMarkup = renderToStaticMarkup(
  <MaterialSymbol name="future_icon_name" />,
);

assert.match(fallbackMarkup, /<svg/);
assert.match(fallbackMarkup, /data-fallback="true"/);
assert.match(fallbackMarkup, /data-icon="future_icon_name"/);
