import { APP_FILE_NAME, DEFAULT_SETTINGS, MAX_MISSING_PREVIEW } from "./constants.js";
import { loadFontFromFile } from "./font-loader.js";
import { buildTextLayout } from "./layout.js";
import { clearPreview, renderPreview } from "./preview.js";
import { createInitialState, getExampleState } from "./state.js";
import { buildTextSvgMarkup, buildVectorSvgMarkup } from "./svg.js";
import { clampNumber, downloadTextFile, formatNumber, slugifyFilename } from "./utils.js";

function getElements() {
  return {
    alignButtons: [...document.querySelectorAll("[data-align]")],
    exampleButton: document.getElementById("example-button"),
    exportTextButton: document.getElementById("export-text-button"),
    exportVectorButton: document.getElementById("export-vector-button"),
    fillInput: document.getElementById("fill-input"),
    fontButton: document.getElementById("font-button"),
    fontInput: document.getElementById("font-input"),
    fontMeta: document.getElementById("font-meta"),
    fontName: document.getElementById("font-name"),
    fontSizeInput: document.getElementById("font-size-input"),
    lineHeightInput: document.getElementById("line-height-input"),
    missingGlyphs: document.getElementById("missing-glyphs"),
    paddingInput: document.getElementById("padding-input"),
    previewBackgroundInput: document.getElementById("preview-background-input"),
    previewDimensions: document.getElementById("preview-dimensions"),
    previewPlaceholder: document.getElementById("preview-placeholder"),
    previewStage: document.getElementById("preview-stage"),
    previewTarget: document.getElementById("preview-target"),
    resetButton: document.getElementById("reset-button"),
    showBoundsInput: document.getElementById("show-bounds-input"),
    statusBanner: document.getElementById("status-banner"),
    strokeEnabledInput: document.getElementById("stroke-enabled-input"),
    strokeInput: document.getElementById("stroke-input"),
    strokeWidthInput: document.getElementById("stroke-width-input"),
    textInput: document.getElementById("text-input"),
    warningBanner: document.getElementById("warning-banner"),
    dropzone: document.getElementById("font-dropzone"),
    letterSpacingInput: document.getElementById("letter-spacing-input"),
  };
}

function setNotice(state, tone, message) {
  state.notice = { tone, message };
}

function syncControls(elements, state) {
  elements.textInput.value = state.text;
  elements.fontSizeInput.value = state.settings.fontSize;
  elements.letterSpacingInput.value = state.settings.letterSpacing;
  elements.lineHeightInput.value = state.settings.lineHeight;
  elements.paddingInput.value = state.settings.padding;
  elements.fillInput.value = state.settings.fill;
  elements.strokeInput.value = state.settings.stroke;
  elements.strokeEnabledInput.checked = state.settings.strokeEnabled;
  elements.strokeWidthInput.value = state.settings.strokeWidth;
  elements.previewBackgroundInput.checked = state.settings.previewBackground;
  elements.showBoundsInput.checked = state.settings.showBounds;

  for (const button of elements.alignButtons) {
    button.classList.toggle("is-active", button.dataset.align === state.settings.align);
  }
}

function setStatusBanner(element, tone, message) {
  element.textContent = message;
  element.className = `notice notice-${tone}`;
}

function setPlaceholder(elements, message) {
  clearPreview(elements.previewTarget);
  elements.previewPlaceholder.hidden = false;
  elements.previewPlaceholder.innerHTML = `<p>${message}</p>`;
  elements.previewDimensions.textContent = "SVG en attente";
}

function hidePlaceholder(elements) {
  elements.previewPlaceholder.hidden = true;
}

function setExportAvailability(elements, isEnabled) {
  elements.exportVectorButton.disabled = !isEnabled;
  elements.exportTextButton.disabled = !isEnabled;
}

function getFriendlyMissingGlyphs(missingGlyphs) {
  const preview = missingGlyphs.slice(0, MAX_MISSING_PREVIEW).join(" ");
  const suffix = missingGlyphs.length > MAX_MISSING_PREVIEW ? " ..." : "";
  return `${preview}${suffix}`.trim();
}

function updateMissingGlyphMessage(elements, renderResult) {
  if (!renderResult?.missingGlyphs?.length) {
    elements.missingGlyphs.hidden = true;
    elements.missingGlyphs.textContent = "";
    elements.warningBanner.hidden = true;
    elements.warningBanner.textContent = "";
    return;
  }

  const glyphPreview = getFriendlyMissingGlyphs(renderResult.missingGlyphs);
  const message = `Caractères absents de la police détectés : ${glyphPreview}`;

  elements.missingGlyphs.hidden = false;
  elements.missingGlyphs.textContent = message;
  elements.warningBanner.hidden = false;
  elements.warningBanner.textContent = message;
}

function getExportBaseName(state) {
  const familyName = state.fontAsset?.familyName || APP_FILE_NAME;
  const sample = state.text.split("\n").join(" ").slice(0, 28);
  return slugifyFilename(`${familyName}-${sample || APP_FILE_NAME}`);
}

function applyExample(state, elements) {
  const exampleState = getExampleState();
  state.text = exampleState.text;
  state.settings = { ...exampleState.settings };
  syncControls(elements, state);
  setNotice(state, "info", "Le texte et les réglages d’exemple ont été appliqués.");
}

function resetState(state, elements) {
  const initialState = createInitialState();

  state.fontAsset = initialState.fontAsset;
  state.text = initialState.text;
  state.settings = { ...initialState.settings };
  state.notice = initialState.notice;
  state.renderResult = null;

  elements.fontInput.value = "";
  syncControls(elements, state);
}

function parseNumberInput(value, min, max, fallback) {
  return clampNumber(value, min, max, fallback);
}

async function handleFontFile(file, state, elements) {
  if (!file) {
    return;
  }

  try {
    const fontAsset = await loadFontFromFile(file);
    state.fontAsset = fontAsset;
    setNotice(state, "success", `Police chargée : ${fontAsset.familyName}.`);
  } catch (error) {
    setNotice(state, "error", error.message);
  }

  renderApp(state, elements);
}

function exportVectorSvg(state) {
  if (!state.renderResult || !state.fontAsset) {
    return;
  }

  const markup = buildVectorSvgMarkup(state.renderResult, state.settings);
  downloadTextFile(`${getExportBaseName(state)}.svg`, markup, "image/svg+xml");
}

function exportTextSvg(state) {
  if (!state.renderResult || !state.fontAsset) {
    return;
  }

  const markup = buildTextSvgMarkup(state.renderResult, state.fontAsset, state.settings);
  downloadTextFile(`${getExportBaseName(state)}-text.svg`, markup, "image/svg+xml");
}

function updateFontMeta(elements, state) {
  if (!state.fontAsset) {
    elements.fontName.textContent = "Aucune police chargée";
    elements.fontMeta.textContent = "Glissez-déposez un fichier ici ou utilisez le bouton.";
    return;
  }

  elements.fontName.textContent = state.fontAsset.familyName;
  elements.fontMeta.textContent = `${state.fontAsset.fileName} · ${Math.round(state.fontAsset.fileSize / 1024)} Ko`;
}

function renderApp(state, elements) {
  syncControls(elements, state);
  updateFontMeta(elements, state);
  setStatusBanner(elements.statusBanner, state.notice.tone, state.notice.message);
  elements.previewStage.classList.toggle("preview-stage-solid", state.settings.previewBackground);
  elements.strokeWidthInput.disabled = !state.settings.strokeEnabled;
  elements.strokeInput.disabled = !state.settings.strokeEnabled;

  if (!state.fontAsset) {
    state.renderResult = null;
    setExportAvailability(elements, false);
    updateMissingGlyphMessage(elements, null);
    setPlaceholder(elements, "Chargez une police locale pour commencer.");
    return;
  }

  if (!state.text.length) {
    state.renderResult = null;
    setExportAvailability(elements, false);
    updateMissingGlyphMessage(elements, null);
    setPlaceholder(elements, "Saisissez un texte pour générer le SVG.");
    return;
  }

  try {
    const renderResult = buildTextLayout({
      font: state.fontAsset.font,
      settings: state.settings,
      text: state.text,
    });

    state.renderResult = renderResult;

    if (!renderResult.hasVisiblePaths) {
      setExportAvailability(elements, false);
      updateMissingGlyphMessage(elements, renderResult);
      setPlaceholder(elements, "Le texte ne contient aucun glyphe visible à exporter.");
      return;
    }

    const markup = buildVectorSvgMarkup(renderResult, state.settings, {
      includeBounds: state.settings.showBounds,
    });

    hidePlaceholder(elements);
    renderPreview(elements.previewTarget, markup);
    elements.previewDimensions.textContent = `${formatNumber(renderResult.width)} × ${formatNumber(renderResult.height)} px`;
    updateMissingGlyphMessage(elements, renderResult);
    setExportAvailability(elements, true);
  } catch (error) {
    state.renderResult = null;
    setExportAvailability(elements, false);
    updateMissingGlyphMessage(elements, null);
    setNotice(state, "error", "Échec de génération du SVG. Vérifiez la police et les réglages.");
    setStatusBanner(elements.statusBanner, state.notice.tone, state.notice.message);
    setPlaceholder(elements, "Une erreur est survenue pendant la génération du rendu.");
  }
}

function bindDropzone(elements, state) {
  const dragEvents = ["dragenter", "dragover"];

  for (const eventName of dragEvents) {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.add("is-dragging");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove("is-dragging");
    });
  }

  elements.dropzone.addEventListener("drop", (event) => {
    const [file] = [...event.dataTransfer.files];
    handleFontFile(file, state, elements);
  });
}

export function createApp() {
  const state = createInitialState();
  const elements = getElements();

  syncControls(elements, state);

  elements.fontButton.addEventListener("click", () => {
    elements.fontInput.click();
  });

  elements.fontInput.addEventListener("change", (event) => {
    const [file] = [...event.target.files];
    handleFontFile(file, state, elements);
  });

  elements.textInput.addEventListener("input", (event) => {
    state.text = event.target.value;
    renderApp(state, elements);
  });

  elements.fontSizeInput.addEventListener("input", (event) => {
    state.settings.fontSize = parseNumberInput(event.target.value, 8, 960, DEFAULT_SETTINGS.fontSize);
    renderApp(state, elements);
  });

  elements.letterSpacingInput.addEventListener("input", (event) => {
    state.settings.letterSpacing = parseNumberInput(event.target.value, -60, 300, DEFAULT_SETTINGS.letterSpacing);
    renderApp(state, elements);
  });

  elements.lineHeightInput.addEventListener("input", (event) => {
    state.settings.lineHeight = parseNumberInput(event.target.value, 0.8, 4, DEFAULT_SETTINGS.lineHeight);
    renderApp(state, elements);
  });

  elements.paddingInput.addEventListener("input", (event) => {
    state.settings.padding = parseNumberInput(event.target.value, 0, 300, DEFAULT_SETTINGS.padding);
    renderApp(state, elements);
  });

  elements.fillInput.addEventListener("input", (event) => {
    state.settings.fill = event.target.value;
    renderApp(state, elements);
  });

  elements.strokeInput.addEventListener("input", (event) => {
    state.settings.stroke = event.target.value;
    renderApp(state, elements);
  });

  elements.strokeEnabledInput.addEventListener("change", (event) => {
    state.settings.strokeEnabled = event.target.checked;
    renderApp(state, elements);
  });

  elements.strokeWidthInput.addEventListener("input", (event) => {
    state.settings.strokeWidth = parseNumberInput(event.target.value, 0, 80, DEFAULT_SETTINGS.strokeWidth);
    renderApp(state, elements);
  });

  elements.previewBackgroundInput.addEventListener("change", (event) => {
    state.settings.previewBackground = event.target.checked;
    renderApp(state, elements);
  });

  elements.showBoundsInput.addEventListener("change", (event) => {
    state.settings.showBounds = event.target.checked;
    renderApp(state, elements);
  });

  for (const button of elements.alignButtons) {
    button.addEventListener("click", () => {
      state.settings.align = button.dataset.align;
      renderApp(state, elements);
    });
  }

  elements.exampleButton.addEventListener("click", () => {
    applyExample(state, elements);
    renderApp(state, elements);
  });

  elements.resetButton.addEventListener("click", () => {
    resetState(state, elements);
    renderApp(state, elements);
  });

  elements.exportVectorButton.addEventListener("click", () => {
    exportVectorSvg(state);
  });

  elements.exportTextButton.addEventListener("click", () => {
    exportTextSvg(state);
  });

  bindDropzone(elements, state);
  renderApp(state, elements);
  document.body.dataset.appReady = "true";
}
