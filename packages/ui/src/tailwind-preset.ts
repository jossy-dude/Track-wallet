import type { Config } from "tailwindcss";

const omniSyncPreset: Partial<Config> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        outline: "#74796e",
        "tertiary-container": "#c4a66a",
        "tertiary-fixed-dim": "#dcc48e",
        "on-primary": "#ffffff",
        "inverse-primary": "#8ecf9e",
        secondary: "#6b6358",
        tertiary: "#705c30",
        "on-surface-variant": "#4a4e4a",
        "primary-container": "#78a886",
        "surface-container-low": "#f5f1ea",
        "surface-container-high": "#eae6de",
        "on-primary-container": "#d8f0de",
        "on-error-container": "#690005",
        "primary-fixed": "#c8e8d0",
        "on-tertiary-container": "#554020",
        "secondary-fixed-dim": "#d4ccbf",
        "error-container": "#ffdad8",
        "surface-container": "#f0ece4",
        "on-secondary-fixed-variant": "#4a4538",
        "on-tertiary-fixed": "#221a05",
        "on-tertiary-fixed-variant": "#554020",
        "surface-tint": "#4a7c59",
        "surface-bright": "#faf6f0",
        surface: "#faf6f0",
        "surface-variant": "#e4e0d8",
        "on-primary-fixed": "#002110",
        error: "#b83230",
        "primary-fixed-dim": "#8ecf9e",
        "on-secondary-container": "#5e5548",
        "surface-dim": "#dbd7cf",
        "on-surface": "#2e3230",
        "on-error": "#ffffff",
        "on-tertiary": "#ffffff",
        "surface-container-highest": "#e4e0d8",
        "secondary-fixed": "#f0e8db",
        "on-primary-fixed-variant": "#2a6038",
        "on-background": "#2e3230",
        "tertiary-fixed": "#f8e0a8",
        "surface-container-lowest": "#ffffff",
        "secondary-container": "#f0e8db",
        "on-secondary": "#ffffff",
        primary: "#4a7c59",
        "on-secondary-fixed": "#1e1a13",
        background: "#faf6f0",
        "inverse-surface": "#2e3230",
        "outline-variant": "#c4c8bc",
        "inverse-on-surface": "#f5f0e8"
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px"
      },
      fontFamily: {
        headline: ["Literata", "serif"],
        display: ["Literata", "serif"],
        body: ["Nunito Sans", "sans-serif"],
        label: ["Nunito Sans", "sans-serif"]
      }
    }
  }
};

export default omniSyncPreset;

