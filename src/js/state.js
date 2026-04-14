import { DEFAULT_SETTINGS, DEFAULT_TEXT, EXAMPLE_TEXT } from "./constants.js";

export function createInitialState() {
  return {
    fontAsset: null,
    text: DEFAULT_TEXT,
    settings: { ...DEFAULT_SETTINGS },
    notice: {
      tone: "info",
      message: "Chargez une police locale `.ttf` ou `.otf` pour commencer.",
    },
    renderResult: null,
  };
}

export function getExampleState() {
  return {
    text: EXAMPLE_TEXT,
    settings: {
      ...DEFAULT_SETTINGS,
      fontSize: 128,
      letterSpacing: 1,
      lineHeight: 1.14,
      padding: 36,
      align: "center",
      bold: false,
      slantStyle: "normal",
      fill: "#111218",
      stroke: "#2b4d96",
      strokeEnabled: false,
      strokeWidth: 1.5,
      previewBackground: true,
      showBounds: false,
    },
  };
}
