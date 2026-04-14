import { ACCEPTED_EXTENSIONS } from "./constants.js";
import { arrayBufferToBase64, pickLocalizedName } from "./utils.js";

function getFileExtension(fileName) {
  const normalized = String(fileName || "").toLowerCase();
  const lastDotIndex = normalized.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return "";
  }

  return normalized.slice(lastDotIndex);
}

function getFontMimeType(extension) {
  return extension === ".otf" ? "font/otf" : "font/ttf";
}

function getSvgFormat(extension) {
  return extension === ".otf" ? "opentype" : "truetype";
}

export function isSupportedFontFile(file) {
  return ACCEPTED_EXTENSIONS.includes(getFileExtension(file?.name));
}

export async function loadFontFromFile(file) {
  if (!(file instanceof File)) {
    throw new Error("Aucun fichier de police n’a été fourni.");
  }

  const extension = getFileExtension(file.name);

  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    throw new Error("Format non supporté. Chargez un fichier .ttf ou .otf.");
  }

  let arrayBuffer;

  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (error) {
    throw new Error("Impossible de lire ce fichier de police.");
  }

  let font;

  try {
    font = window.opentype.parse(arrayBuffer);
  } catch (error) {
    throw new Error("Police corrompue ou illisible. Impossible de charger ce fichier.");
  }

  if (!font?.unitsPerEm) {
    throw new Error("Cette police ne contient pas les métriques nécessaires.");
  }

  const familyName =
    pickLocalizedName(font.names?.fullName) ||
    pickLocalizedName(font.names?.fontFamily) ||
    file.name.replace(/\.[^.]+$/, "");

  return {
    base64: arrayBufferToBase64(arrayBuffer),
    extension,
    fileName: file.name,
    fileSize: file.size,
    font,
    familyName,
    mimeType: getFontMimeType(extension),
    svgFormat: getSvgFormat(extension),
  };
}
