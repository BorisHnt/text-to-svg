import { escapeCssString, escapeXml, formatNumber } from "./utils.js";

function getStrokeAttributes(settings) {
  if (!settings.strokeEnabled || settings.strokeWidth <= 0) {
    return 'stroke="none"';
  }

  return [
    `stroke="${settings.stroke}"`,
    `stroke-width="${formatNumber(settings.strokeWidth)}"`,
    'stroke-linejoin="round"',
    'paint-order="stroke fill"',
  ].join(" ");
}

function renderPathMarkup(layout) {
  return layout.lines
    .flatMap((line) => line.pathEntries)
    .filter((entry) => entry.hasPath)
    .map((entry) => `<path d="${entry.pathData}" />`)
    .join("");
}

function renderBoundsMarkup(layout) {
  const frameWidth = Math.max(0, layout.width - 1);
  const frameHeight = Math.max(0, layout.height - 1);
  const overallBounds = layout.actualBounds
    ? `
      <rect
        x="${formatNumber(layout.shiftX + layout.actualBounds.x1)}"
        y="${formatNumber(layout.shiftY + layout.actualBounds.y1)}"
        width="${formatNumber(layout.actualBounds.x2 - layout.actualBounds.x1)}"
        height="${formatNumber(layout.actualBounds.y2 - layout.actualBounds.y1)}"
        fill="none"
        stroke="#2a77ff"
        stroke-width="1"
        stroke-dasharray="10 6"
      />
    `
    : "";

  const lineBounds = layout.lines
    .filter((line) => line.finalNominalBox)
    .map((line) => {
      const width = Math.max(0, line.finalNominalBox.x2 - line.finalNominalBox.x1);
      const height = Math.max(0, line.finalNominalBox.y2 - line.finalNominalBox.y1);

      return `
        <rect
          x="${formatNumber(line.finalNominalBox.x1)}"
          y="${formatNumber(line.finalNominalBox.y1)}"
          width="${formatNumber(width)}"
          height="${formatNumber(height)}"
          fill="none"
          stroke="#f06c3f"
          stroke-width="1"
          stroke-dasharray="5 4"
        />
      `;
    })
    .join("");

  return `
    <g opacity="0.9" pointer-events="none">
      <rect
        x="0.5"
        y="0.5"
        width="${formatNumber(frameWidth)}"
        height="${formatNumber(frameHeight)}"
        fill="none"
        stroke="#8b93a0"
        stroke-width="1"
      />
      ${overallBounds}
      ${lineBounds}
    </g>
  `;
}

export function buildVectorSvgMarkup(layout, settings, options = {}) {
  const { includeBounds = false } = options;
  const pathMarkup = renderPathMarkup(layout);
  const guideMarkup = includeBounds ? renderBoundsMarkup(layout) : "";
  const strokeAttributes = getStrokeAttributes(settings);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${formatNumber(layout.width)} ${formatNumber(layout.height)}" width="${formatNumber(layout.width)}" height="${formatNumber(layout.height)}">
  <g transform="translate(${formatNumber(layout.shiftX)} ${formatNumber(layout.shiftY)})" fill="${settings.fill}" ${strokeAttributes}>
    ${pathMarkup}
  </g>
  ${guideMarkup}
</svg>`;
}

export function buildTextSvgMarkup(layout, fontAsset, settings) {
  const strokeAttributes = getStrokeAttributes(settings);
  const fontFamily = escapeCssString(fontAsset.familyName || "EmbeddedFont");

  const textMarkup = layout.lines
    .map((line) => {
      return `<text xml:space="preserve" x="${formatNumber(line.finalStartX)}" y="${formatNumber(line.finalBaselineY)}">${escapeXml(line.text)}</text>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${formatNumber(layout.width)} ${formatNumber(layout.height)}" width="${formatNumber(layout.width)}" height="${formatNumber(layout.height)}">
  <defs>
    <style>
      @font-face {
        font-family: "${fontFamily}";
        src: url("data:${fontAsset.mimeType};base64,${fontAsset.base64}") format("${fontAsset.svgFormat}");
      }
      text {
        font-family: "${fontFamily}";
        font-size: ${formatNumber(settings.fontSize)}px;
        letter-spacing: ${formatNumber(settings.letterSpacing)}px;
      }
    </style>
  </defs>
  <g fill="${settings.fill}" ${strokeAttributes}>
    ${textMarkup}
  </g>
</svg>`;
}
