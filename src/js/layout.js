import { ITALIC_ANGLE_DEGREES } from "./constants.js";
import { formatNumber, getFauxBoldWidth, normalizeMultilineText, uniqueStrings } from "./utils.js";

function createEmptyBounds() {
  return {
    x1: Number.POSITIVE_INFINITY,
    y1: Number.POSITIVE_INFINITY,
    x2: Number.NEGATIVE_INFINITY,
    y2: Number.NEGATIVE_INFINITY,
  };
}

function hasBounds(bounds) {
  return Number.isFinite(bounds.x1) &&
    Number.isFinite(bounds.y1) &&
    Number.isFinite(bounds.x2) &&
    Number.isFinite(bounds.y2);
}

function normalizeBounds(bounds) {
  return hasBounds(bounds) ? bounds : null;
}

function includeBounds(target, source) {
  if (!source || !hasBounds(source)) {
    return;
  }

  target.x1 = Math.min(target.x1, source.x1);
  target.y1 = Math.min(target.y1, source.y1);
  target.x2 = Math.max(target.x2, source.x2);
  target.y2 = Math.max(target.y2, source.y2);
}

function translateBounds(bounds, x, y) {
  if (!bounds) {
    return null;
  }

  return {
    x1: bounds.x1 + x,
    y1: bounds.y1 + y,
    x2: bounds.x2 + x,
    y2: bounds.y2 + y,
  };
}

function skewPoint(x, y, baselineY, italicSlope) {
  return {
    x: x + italicSlope * (baselineY - y),
    y,
  };
}

function getTransformedBoundsFromOriginal(bounds, baselineY, italicSlope) {
  if (!bounds) {
    return null;
  }

  const corners = [
    skewPoint(bounds.x1, bounds.y1, baselineY, italicSlope),
    skewPoint(bounds.x2, bounds.y1, baselineY, italicSlope),
    skewPoint(bounds.x2, bounds.y2, baselineY, italicSlope),
    skewPoint(bounds.x1, bounds.y2, baselineY, italicSlope),
  ];

  return {
    x1: Math.min(...corners.map((corner) => corner.x)),
    y1: Math.min(...corners.map((corner) => corner.y)),
    x2: Math.max(...corners.map((corner) => corner.x)),
    y2: Math.max(...corners.map((corner) => corner.y)),
  };
}

function transformCommand(command, baselineY, italicSlope) {
  if (!italicSlope) {
    return { ...command };
  }

  switch (command.type) {
    case "M":
    case "L": {
      const point = skewPoint(command.x, command.y, baselineY, italicSlope);
      return { ...command, x: point.x, y: point.y };
    }
    case "Q": {
      const control = skewPoint(command.x1, command.y1, baselineY, italicSlope);
      const point = skewPoint(command.x, command.y, baselineY, italicSlope);
      return { ...command, x1: control.x, y1: control.y, x: point.x, y: point.y };
    }
    case "C": {
      const controlA = skewPoint(command.x1, command.y1, baselineY, italicSlope);
      const controlB = skewPoint(command.x2, command.y2, baselineY, italicSlope);
      const point = skewPoint(command.x, command.y, baselineY, italicSlope);
      return {
        ...command,
        x1: controlA.x,
        y1: controlA.y,
        x2: controlB.x,
        y2: controlB.y,
        x: point.x,
        y: point.y,
      };
    }
    default:
      return { ...command };
  }
}

function buildPathDataFromCommands(commands) {
  return commands
    .map((command) => {
      switch (command.type) {
        case "M":
        case "L":
          return `${command.type}${formatNumber(command.x)} ${formatNumber(command.y)}`;
        case "Q":
          return `Q${formatNumber(command.x1)} ${formatNumber(command.y1)} ${formatNumber(command.x)} ${formatNumber(command.y)}`;
        case "C":
          return `C${formatNumber(command.x1)} ${formatNumber(command.y1)} ${formatNumber(command.x2)} ${formatNumber(command.y2)} ${formatNumber(command.x)} ${formatNumber(command.y)}`;
        case "Z":
          return "Z";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("");
}

function getLineOffset(contentWidth, lineWidth, align) {
  if (align === "center") {
    return (contentWidth - lineWidth) / 2;
  }

  if (align === "right") {
    return contentWidth - lineWidth;
  }

  return 0;
}

function isMissingGlyph(glyph, character) {
  if (!glyph || character === " " || character === "\u00a0") {
    return false;
  }

  return glyph.name === ".notdef" || (glyph.index === 0 && character !== "\u0000");
}

function getAdvanceWidth(font, glyph, nextGlyph, fontScale, letterSpacing, isLastGlyph) {
  const advanceWidth = (glyph?.advanceWidth || font.unitsPerEm * 0.5) * fontScale;
  const kerning = glyph && nextGlyph ? font.getKerningValue(glyph, nextGlyph) * fontScale : 0;
  const spacing = isLastGlyph ? 0 : letterSpacing;

  return advanceWidth + kerning + spacing;
}

export function buildTextLayout({ font, text, settings }) {
  if (!font) {
    throw new Error("Aucune police chargée.");
  }

  const normalizedText = normalizeMultilineText(text);
  const hasTextContent = normalizedText.length > 0;

  if (!hasTextContent) {
    return {
      hasTextContent: false,
      hasVisiblePaths: false,
      lines: [],
      width: 0,
      height: 0,
      missingGlyphs: [],
    };
  }

  const lines = normalizedText.split("\n");
  const fontScale = settings.fontSize / font.unitsPerEm;
  const italicSlope = settings.italic ? Math.tan((ITALIC_ANGLE_DEGREES * Math.PI) / 180) : 0;
  const ascender = font.ascender * fontScale;
  const descender = Math.abs(font.descender * fontScale);
  const glyphBoxHeight = ascender + descender;
  const lineAdvance = Math.max(glyphBoxHeight, settings.fontSize * settings.lineHeight);
  const preparedLines = [];
  const missingGlyphs = [];
  let contentWidth = 0;

  for (const lineText of lines) {
    const characters = Array.from(lineText);
    const glyphs = characters.map((character) => font.charToGlyph(character));
    let width = 0;

    for (let index = 0; index < glyphs.length; index += 1) {
      const glyph = glyphs[index];
      const nextGlyph = glyphs[index + 1] || null;
      const character = characters[index];

      if (isMissingGlyph(glyph, character)) {
        missingGlyphs.push(character);
      }

      width += getAdvanceWidth(font, glyph, nextGlyph, fontScale, settings.letterSpacing, index === glyphs.length - 1);
    }

    preparedLines.push({
      characters,
      glyphs,
      text: lineText,
      width,
    });

    contentWidth = Math.max(contentWidth, width);
  }

  const nominalHeight = glyphBoxHeight + Math.max(0, preparedLines.length - 1) * lineAdvance;
  const rawActualBounds = createEmptyBounds();
  const resolvedLines = preparedLines.map((line, lineIndex) => {
    const baselineY = ascender + lineIndex * lineAdvance;
    const startX = getLineOffset(contentWidth, line.width, settings.align);
    const nominalBox = {
      x1: startX,
      y1: baselineY - ascender,
      x2: startX + line.width,
      y2: baselineY + descender,
    };
    const actualBounds = createEmptyBounds();
    const pathEntries = [];
    let cursorX = 0;

    for (let index = 0; index < line.glyphs.length; index += 1) {
      const glyph = line.glyphs[index];
      const nextGlyph = line.glyphs[index + 1] || null;
      const x = startX + cursorX;
      const path = glyph?.getPath(x, baselineY, settings.fontSize);
      const hasPath = Array.isArray(path?.commands) && path.commands.length > 0;
      let pathData = "";

      if (hasPath) {
        const transformedCommands = path.commands.map((command) => transformCommand(command, baselineY, italicSlope));
        pathData = buildPathDataFromCommands(transformedCommands);
        const transformedBounds = getTransformedBoundsFromOriginal(path.getBoundingBox(), baselineY, italicSlope);
        includeBounds(actualBounds, transformedBounds);
        includeBounds(rawActualBounds, transformedBounds);
      }

      pathEntries.push({
        character: line.characters[index],
        hasPath,
        pathData,
        x,
      });

      cursorX += getAdvanceWidth(font, glyph, nextGlyph, fontScale, settings.letterSpacing, index === line.glyphs.length - 1);
    }

    return {
      actualBounds: normalizeBounds(actualBounds),
      baselineY,
      finalActualBounds: null,
      finalBaselineY: 0,
      finalNominalBox: null,
      finalStartX: 0,
      nominalBox,
      pathEntries,
      startX,
      text: line.text,
      width: line.width,
    };
  });

  const actualBounds = normalizeBounds(rawActualBounds);
  const hasVisiblePaths = Boolean(actualBounds);
  const strokePadding = settings.strokeEnabled && settings.strokeWidth > 0 ? settings.strokeWidth / 2 : 0;
  const fauxBoldPadding = getFauxBoldWidth(settings) / 2;
  const outerPadding = settings.padding + Math.max(strokePadding, fauxBoldPadding);
  const shiftX = hasVisiblePaths ? outerPadding - actualBounds.x1 : outerPadding;
  const shiftY = hasVisiblePaths ? outerPadding - actualBounds.y1 : outerPadding;
  const width = hasVisiblePaths
    ? Math.max(1, actualBounds.x2 - actualBounds.x1 + outerPadding * 2)
    : Math.max(1, contentWidth + outerPadding * 2 || outerPadding * 2 + 1);
  const height = hasVisiblePaths
    ? Math.max(1, actualBounds.y2 - actualBounds.y1 + outerPadding * 2)
    : Math.max(1, nominalHeight + outerPadding * 2 || outerPadding * 2 + 1);

  for (const line of resolvedLines) {
    line.finalActualBounds = translateBounds(line.actualBounds, shiftX, shiftY);
    line.finalBaselineY = line.baselineY + shiftY;
    line.finalNominalBox = translateBounds(line.nominalBox, shiftX, shiftY);
    line.finalStartX = line.startX + shiftX;
  }

  return {
    actualBounds,
    ascender,
    contentWidth,
    descender,
    hasTextContent,
    hasVisiblePaths,
    height,
    lineAdvance,
    lines: resolvedLines,
    missingGlyphs: uniqueStrings(missingGlyphs),
    nominalBounds: {
      x1: shiftX,
      y1: shiftY,
      x2: shiftX + contentWidth,
      y2: shiftY + nominalHeight,
    },
    nominalHeight,
    shiftX,
    shiftY,
    width,
  };
}
