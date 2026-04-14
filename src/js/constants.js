export const ACCEPTED_EXTENSIONS = [".ttf", ".otf"];
export const APP_FILE_NAME = "text-to-svg-export";
export const MAX_MISSING_PREVIEW = 8;
export const TAB_REPLACEMENT = "    ";
export const OBLIQUE_ANGLE_DEGREES = 7;
export const ITALIC_ANGLE_DEGREES = 12;
export const FAUX_BOLD_RATIO = 0.022;
export const FAUX_BOLD_MIN_WIDTH = 1.25;

export const DEFAULT_SETTINGS = {
  fontSize: 120,
  letterSpacing: 0,
  lineHeight: 1.2,
  padding: 28,
  align: "left",
  bold: false,
  slantStyle: "normal",
  fill: "#f6f2e8",
  stroke: "#101114",
  strokeEnabled: false,
  strokeWidth: 1.5,
  previewBackground: true,
  showBounds: false,
};

export const DEFAULT_TEXT = "";

export const EXAMPLE_TEXT = `Bonjour SVG
À bientôt, 2026 !
12345 & signes : !?€`;

export function getSlantAngleDegrees(slantStyle) {
  if (slantStyle === "italic") {
    return ITALIC_ANGLE_DEGREES;
  }

  if (slantStyle === "oblique") {
    return OBLIQUE_ANGLE_DEGREES;
  }

  return 0;
}
