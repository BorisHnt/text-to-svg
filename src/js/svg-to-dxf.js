import { formatNumber, uniqueStrings } from "./utils.js";

const SUPPORTED_TAGS = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const UNSUPPORTED_TAGS = new Set(["text", "image", "use", "foreignObject"]);
const IGNORED_ANCESTOR_SELECTOR = "defs, clipPath, mask, marker, pattern, symbol";

export const DXF_PRECISION_OPTIONS = {
  low: {
    label: "Faible",
    maxSegmentLength: 24,
    minClosedSegments: 20,
    pointTolerance: 0.3,
  },
  medium: {
    label: "Moyenne",
    maxSegmentLength: 12,
    minClosedSegments: 40,
    pointTolerance: 0.15,
  },
  high: {
    label: "Élevée",
    maxSegmentLength: 6,
    minClosedSegments: 72,
    pointTolerance: 0.08,
  },
};

function isSvgFile(file) {
  return file instanceof File && /\.svg$/i.test(file.name);
}

function removeUnsafeNodes(root) {
  for (const node of root.querySelectorAll("script")) {
    node.remove();
  }
}

function isRenderableElement(element) {
  return !element.closest(IGNORED_ANCESTOR_SELECTOR);
}

function getViewBoxMetrics(svgRoot) {
  const viewBox = svgRoot.getAttribute("viewBox");

  if (!viewBox) {
    return null;
  }

  const values = viewBox
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number.parseFloat(value));

  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [x, y, width, height] = values;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { x, y, width, height };
}

function getDimensionValue(svgRoot, attributeName) {
  const rawValue = svgRoot.getAttribute(attributeName);

  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseFloat(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getDocumentMetrics(svgRoot) {
  const viewBox = getViewBoxMetrics(svgRoot);

  if (viewBox) {
    return {
      width: viewBox.width,
      height: viewBox.height,
      label: `${formatNumber(viewBox.width)} × ${formatNumber(viewBox.height)} viewBox`,
      bounds: {
        minX: viewBox.x,
        minY: viewBox.y,
        maxX: viewBox.x + viewBox.width,
        maxY: viewBox.y + viewBox.height,
      },
    };
  }

  const width = getDimensionValue(svgRoot, "width");
  const height = getDimensionValue(svgRoot, "height");

  if (width && height) {
    return {
      width,
      height,
      label: `${formatNumber(width)} × ${formatNumber(height)} px`,
      bounds: {
        minX: 0,
        minY: 0,
        maxX: width,
        maxY: height,
      },
    };
  }

  return {
    width: null,
    height: null,
    label: "Dimensions non déclarées",
    bounds: null,
  };
}

function collectElementCounts(svgRoot) {
  const counts = {};

  for (const element of svgRoot.querySelectorAll("*")) {
    const tag = element.tagName.toLowerCase();

    if (!isRenderableElement(element)) {
      continue;
    }

    counts[tag] = (counts[tag] || 0) + 1;
  }

  return counts;
}

function getSupportedCount(elementCounts) {
  return Object.entries(elementCounts).reduce((count, [tag, value]) => {
    return count + (SUPPORTED_TAGS.has(tag) ? value : 0);
  }, 0);
}

function getUnsupportedTags(svgRoot) {
  const unsupported = [];

  for (const element of svgRoot.querySelectorAll("*")) {
    const tag = element.tagName.toLowerCase();

    if (UNSUPPORTED_TAGS.has(tag) && isRenderableElement(element)) {
      unsupported.push(tag);
    }
  }

  return uniqueStrings(unsupported);
}

function getUnsupportedElementCount(svgRoot) {
  let count = 0;

  for (const element of svgRoot.querySelectorAll("*")) {
    const tag = element.tagName.toLowerCase();

    if (UNSUPPORTED_TAGS.has(tag) && isRenderableElement(element)) {
      count += 1;
    }
  }

  return count;
}

export async function loadSvgFromFile(file) {
  if (!(file instanceof File)) {
    throw new Error("Aucun fichier SVG n’a été fourni.");
  }

  if (!isSvgFile(file) && file.type !== "image/svg+xml") {
    throw new Error("Fichier invalide. Chargez un fichier .svg.");
  }

  let markup;

  try {
    markup = await file.text();
  } catch (error) {
    throw new Error("Impossible de lire ce fichier SVG.");
  }

  if (!markup.trim()) {
    throw new Error("Le fichier SVG est vide.");
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(markup, "image/svg+xml");

  if (documentNode.querySelector("parsererror")) {
    throw new Error("SVG mal formé. Impossible de parser ce fichier.");
  }

  const svgRoot = documentNode.documentElement;

  if (!svgRoot || svgRoot.tagName.toLowerCase() !== "svg") {
    throw new Error("Ce fichier ne contient pas de racine SVG valide.");
  }

  removeUnsafeNodes(svgRoot);

  const elementCounts = collectElementCounts(svgRoot);
  const supportedCount = getSupportedCount(elementCounts);
  const unsupportedTags = getUnsupportedTags(svgRoot);
  const unsupportedCount = getUnsupportedElementCount(svgRoot);
  const metrics = getDocumentMetrics(svgRoot);

  return {
    documentNode,
    elementCounts,
    file,
    fileName: file.name,
    fileSize: file.size,
    markup: new XMLSerializer().serializeToString(svgRoot),
    metrics,
    supportedCount,
    unsupportedCount,
    unsupportedTags,
  };
}

function createSandboxSvg(markup) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(markup, "image/svg+xml");
  const svgRoot = documentNode.documentElement;

  removeUnsafeNodes(svgRoot);

  const sandbox = document.createElement("div");
  sandbox.style.position = "fixed";
  sandbox.style.left = "-99999px";
  sandbox.style.top = "0";
  sandbox.style.width = "1px";
  sandbox.style.height = "1px";
  sandbox.style.opacity = "0";
  sandbox.style.pointerEvents = "none";
  sandbox.style.overflow = "hidden";

  const viewBox = getViewBoxMetrics(svgRoot);

  if (viewBox) {
    svgRoot.setAttribute("width", String(viewBox.width));
    svgRoot.setAttribute("height", String(viewBox.height));
  }

  svgRoot.setAttribute("overflow", "visible");
  sandbox.appendChild(svgRoot);
  document.body.appendChild(sandbox);

  return {
    cleanup() {
      sandbox.remove();
    },
    svgRoot,
  };
}

function distanceBetween(pointA, pointB) {
  return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
}

function dedupePoints(points, tolerance) {
  const deduped = [];

  for (const point of points) {
    const previous = deduped[deduped.length - 1];

    if (!previous || distanceBetween(previous, point) > tolerance) {
      deduped.push(point);
    }
  }

  return deduped;
}

function transformPoint(point, matrix) {
  return new DOMPoint(point.x, point.y).matrixTransform(matrix);
}

function parsePointsAttribute(value) {
  const numbers = String(value || "")
    .trim()
    .split(/[\s,]+/)
    .map((entry) => Number.parseFloat(entry))
    .filter((entry) => Number.isFinite(entry));
  const points = [];

  for (let index = 0; index < numbers.length - 1; index += 2) {
    points.push({ x: numbers[index], y: numbers[index + 1] });
  }

  return points;
}

function sampleEllipsePoints(cx, cy, rx, ry, segments) {
  const points = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  }

  return points;
}

function sampleElementFallback(element, precision) {
  const tag = element.tagName.toLowerCase();

  switch (tag) {
    case "line":
      return {
        closed: false,
        points: [
          { x: Number.parseFloat(element.getAttribute("x1") || "0"), y: Number.parseFloat(element.getAttribute("y1") || "0") },
          { x: Number.parseFloat(element.getAttribute("x2") || "0"), y: Number.parseFloat(element.getAttribute("y2") || "0") },
        ],
      };
    case "polyline":
      return {
        closed: false,
        points: parsePointsAttribute(element.getAttribute("points")),
      };
    case "polygon":
      return {
        closed: true,
        points: parsePointsAttribute(element.getAttribute("points")),
      };
    case "rect": {
      const x = Number.parseFloat(element.getAttribute("x") || "0");
      const y = Number.parseFloat(element.getAttribute("y") || "0");
      const width = Number.parseFloat(element.getAttribute("width") || "0");
      const height = Number.parseFloat(element.getAttribute("height") || "0");
      const rx = Number.parseFloat(element.getAttribute("rx") || "0");
      const ry = Number.parseFloat(element.getAttribute("ry") || "0");

      if ((rx > 0 || ry > 0) || width <= 0 || height <= 0) {
        return null;
      }

      return {
        closed: true,
        points: [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ],
      };
    }
    case "circle": {
      const cx = Number.parseFloat(element.getAttribute("cx") || "0");
      const cy = Number.parseFloat(element.getAttribute("cy") || "0");
      const r = Number.parseFloat(element.getAttribute("r") || "0");
      const segments = Math.max(precision.minClosedSegments, Math.ceil((2 * Math.PI * r) / precision.maxSegmentLength));
      return {
        closed: true,
        points: sampleEllipsePoints(cx, cy, r, r, segments),
      };
    }
    case "ellipse": {
      const cx = Number.parseFloat(element.getAttribute("cx") || "0");
      const cy = Number.parseFloat(element.getAttribute("cy") || "0");
      const rx = Number.parseFloat(element.getAttribute("rx") || "0");
      const ry = Number.parseFloat(element.getAttribute("ry") || "0");
      const perimeterEstimate = 2 * Math.PI * Math.max(rx, ry);
      const segments = Math.max(precision.minClosedSegments, Math.ceil(perimeterEstimate / precision.maxSegmentLength));
      return {
        closed: true,
        points: sampleEllipsePoints(cx, cy, rx, ry, segments),
      };
    }
    default:
      return null;
  }
}

function isClosedElement(element) {
  const tag = element.tagName.toLowerCase();

  if (tag === "path") {
    return /[zZ]/.test(element.getAttribute("d") || "");
  }

  return tag === "rect" || tag === "circle" || tag === "ellipse" || tag === "polygon";
}

function sampleGeometryElement(element, precision) {
  const matrix = element.getCTM();

  if (!matrix) {
    return null;
  }

  const closed = isClosedElement(element);
  let points = [];

  if (typeof element.getTotalLength === "function" && typeof element.getPointAtLength === "function") {
    try {
      const length = element.getTotalLength();

      if (Number.isFinite(length) && length > 0) {
        const segmentCount = Math.max(
          closed ? precision.minClosedSegments : 1,
          Math.ceil(length / precision.maxSegmentLength)
        );
        const sampleCount = closed ? segmentCount : segmentCount + 1;

        for (let index = 0; index < sampleCount; index += 1) {
          const ratio = closed ? index / segmentCount : index / Math.max(1, sampleCount - 1);
          const point = element.getPointAtLength(Math.min(length, ratio * length));
          points.push(transformPoint(point, matrix));
        }
      }
    } catch (error) {
      points = [];
    }
  }

  if (points.length < 2) {
    const fallback = sampleElementFallback(element, precision);

    if (!fallback) {
      return null;
    }

    points = fallback.points.map((point) => transformPoint(point, matrix));
  }

  points = dedupePoints(points, precision.pointTolerance);

  if (closed && points.length > 2 && distanceBetween(points[0], points[points.length - 1]) <= precision.pointTolerance) {
    points.pop();
  }

  if (points.length < 2) {
    return null;
  }

  return {
    closed,
    points,
    tag: element.tagName.toLowerCase(),
  };
}

function computeBoundsFromPolylines(polylines) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  for (const polyline of polylines) {
    for (const point of polyline.points) {
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.maxY = Math.max(bounds.maxY, point.y);
    }
  }

  return bounds;
}

function hasFiniteBounds(bounds) {
  return Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.maxY);
}

function toDxfCoordinate(point, bounds) {
  return {
    x: point.x - bounds.minX,
    y: bounds.maxY - point.y,
  };
}

function buildLwPolylineEntity(polyline, bounds) {
  const entityLines = [
    "0",
    "LWPOLYLINE",
    "8",
    "0",
    "90",
    String(polyline.points.length),
    "70",
    polyline.closed ? "1" : "0",
  ];

  for (const point of polyline.points) {
    const coordinate = toDxfCoordinate(point, bounds);
    entityLines.push("10", formatNumber(coordinate.x), "20", formatNumber(coordinate.y));
  }

  return entityLines.join("\n");
}

function buildDxfDocument(polylines, bounds) {
  const entities = polylines.map((polyline) => buildLwPolylineEntity(polyline, bounds)).join("\n");

  return [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1015",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    entities,
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ].join("\n");
}

export function convertSvgMarkupToDxf(markup, precisionKey = "medium") {
  const precision = DXF_PRECISION_OPTIONS[precisionKey] || DXF_PRECISION_OPTIONS.medium;
  const sandbox = createSandboxSvg(markup);

  try {
    const svgRoot = sandbox.svgRoot;
    const supportedElements = [...svgRoot.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon")]
      .filter((element) => isRenderableElement(element));
    const unsupportedTags = getUnsupportedTags(svgRoot);
    const unsupportedCount = getUnsupportedElementCount(svgRoot);
    const polylines = [];
    const skippedTags = [];

    for (const element of supportedElements) {
      const polyline = sampleGeometryElement(element, precision);

      if (!polyline) {
        skippedTags.push(element.tagName.toLowerCase());
        continue;
      }

      polylines.push(polyline);
    }

    if (!polylines.length) {
      throw new Error("Aucune géométrie exploitable n’a pu être convertie en DXF.");
    }

    const bounds = computeBoundsFromPolylines(polylines);

    if (!hasFiniteBounds(bounds)) {
      throw new Error("Impossible de calculer les limites du dessin DXF.");
    }

    const segmentCount = polylines.reduce((count, polyline) => {
      return count + Math.max(1, polyline.points.length - (polyline.closed ? 0 : 1));
    }, 0);

    return {
      content: buildDxfDocument(polylines, bounds),
      summary: {
        polylineCount: polylines.length,
        segmentCount,
        supportedCount: supportedElements.length,
        unsupportedCount,
        unsupportedTags,
        skippedTags: uniqueStrings(skippedTags),
      },
    };
  } finally {
    sandbox.cleanup();
  }
}
