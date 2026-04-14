import { TAB_REPLACEMENT } from "./constants.js";

export function pickLocalizedName(record) {
  if (!record) {
    return "";
  }

  if (typeof record === "string") {
    return record;
  }

  const keys = ["en", "en-US", "fr", "fr-FR"];

  for (const key of keys) {
    if (record[key]) {
      return record[key];
    }
  }

  return Object.values(record).find(Boolean) || "";
}

export function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function normalizeMultilineText(value) {
  return String(value || "").replace(/\r\n?/g, "\n").replace(/\t/g, TAB_REPLACEMENT);
}

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function escapeCssString(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function formatNumber(value) {
  const rounded = Number.parseFloat(Number(value).toFixed(4));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function uniqueStrings(values) {
  const seen = new Set();
  const unique = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      unique.push(value);
    }
  }

  return unique;
}

export function slugifyFilename(value) {
  const slug = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "text-to-svg-export";
}

export function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}
