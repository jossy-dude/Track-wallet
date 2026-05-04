import { registerPlugin } from "@capacitor/core";

import type { SmsCapturePlugin } from "./definitions";

const MobileSmsCapture = registerPlugin<SmsCapturePlugin>("MobileSmsCapture");

export * from "./definitions";
export { MobileSmsCapture };
