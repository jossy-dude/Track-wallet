import type { Config } from "tailwindcss";
import omniSyncPreset from "@omni-sync/ui/tailwind-preset";

const config: Config = {
  presets: [omniSyncPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx,css}",
  ],
};

export default config;

