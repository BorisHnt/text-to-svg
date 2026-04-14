import { downloadTextFile, slugifyFilename } from "./utils.js";
import { convertSvgMarkupToDxf, loadSvgFromFile } from "./svg-to-dxf.js";

function getElements() {
  return {
    convertButton: document.getElementById("dxf-convert-button"),
    details: document.getElementById("dxf-details"),
    downloadButton: document.getElementById("dxf-download-button"),
    dropzone: document.getElementById("svg-dropzone"),
    fileButton: document.getElementById("svg-file-button"),
    fileInput: document.getElementById("svg-file-input"),
    fileMeta: document.getElementById("svg-file-meta"),
    fileName: document.getElementById("svg-file-name"),
    precisionInput: document.getElementById("dxf-precision-input"),
    previewDimensions: document.getElementById("dxf-preview-dimensions"),
    previewPlaceholder: document.getElementById("dxf-preview-placeholder"),
    previewTarget: document.getElementById("dxf-preview-target"),
    resetButton: document.getElementById("dxf-reset-button"),
    statusBanner: document.getElementById("dxf-status-banner"),
    supportedCount: document.getElementById("dxf-supported-count"),
    unsupportedCount: document.getElementById("dxf-unsupported-count"),
    polylineCount: document.getElementById("dxf-polyline-count"),
    segmentCount: document.getElementById("dxf-segment-count"),
    unsupportedDetails: document.getElementById("dxf-unsupported-details"),
    warningBanner: document.getElementById("dxf-warning-banner"),
  };
}

function createInitialState() {
  return {
    conversion: null,
    loadedSvg: null,
    previewUrl: null,
  };
}

function setBanner(element, tone, message) {
  element.textContent = message;
  element.className = `notice notice-${tone}`;
}

function resetMetrics(elements) {
  elements.supportedCount.textContent = "0";
  elements.unsupportedCount.textContent = "0";
  elements.polylineCount.textContent = "0";
  elements.segmentCount.textContent = "0";
}

function clearPreview(state, elements) {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }

  elements.previewTarget.textContent = "";
  elements.previewPlaceholder.hidden = false;
  elements.previewDimensions.textContent = "SVG en attente";
}

function renderPreview(state, elements) {
  clearPreview(state, elements);

  if (!state.loadedSvg) {
    return;
  }

  state.previewUrl = URL.createObjectURL(state.loadedSvg.file);
  const image = document.createElement("img");
  image.src = state.previewUrl;
  image.alt = `Aperçu du fichier ${state.loadedSvg.fileName}`;
  elements.previewTarget.appendChild(image);
  elements.previewPlaceholder.hidden = true;
  elements.previewDimensions.textContent = state.loadedSvg.metrics.label;
}

function updateUnsupportedMessages(elements, unsupportedTags) {
  if (!unsupportedTags.length) {
    elements.warningBanner.hidden = true;
    elements.warningBanner.textContent = "";
    elements.unsupportedDetails.hidden = true;
    elements.unsupportedDetails.textContent = "";
    return;
  }

  const message = `Éléments non supportés détectés : ${unsupportedTags.join(", ")}. Ils seront ignorés si aucune conversion fiable n’est possible.`;
  elements.warningBanner.hidden = false;
  elements.warningBanner.textContent = message;
  elements.unsupportedDetails.hidden = false;
  elements.unsupportedDetails.textContent = message;
}

function updateSummary(elements, state) {
  if (!state.loadedSvg) {
    resetMetrics(elements);
    return;
  }

  elements.supportedCount.textContent = String(state.loadedSvg.supportedCount);
  elements.unsupportedCount.textContent = String(state.loadedSvg.unsupportedCount);

  if (state.conversion) {
    elements.polylineCount.textContent = String(state.conversion.summary.polylineCount);
    elements.segmentCount.textContent = String(state.conversion.summary.segmentCount);
  } else {
    elements.polylineCount.textContent = "0";
    elements.segmentCount.textContent = "0";
  }
}

function updateFileMeta(elements, state) {
  if (!state.loadedSvg) {
    elements.fileName.textContent = "Aucun SVG chargé";
    elements.fileMeta.textContent = "Le fichier reste traité localement dans le navigateur.";
    return;
  }

  elements.fileName.textContent = state.loadedSvg.fileName;
  elements.fileMeta.textContent = `${Math.round(state.loadedSvg.fileSize / 1024)} Ko · ${state.loadedSvg.metrics.label}`;
}

function updateButtons(elements, state) {
  const canConvert = Boolean(state.loadedSvg && state.loadedSvg.supportedCount > 0);
  elements.convertButton.disabled = !canConvert;
  elements.downloadButton.disabled = !state.conversion;
}

function renderState(state, elements) {
  updateFileMeta(elements, state);
  renderPreview(state, elements);
  updateSummary(elements, state);
  updateUnsupportedMessages(elements, state.loadedSvg?.unsupportedTags || []);
  updateButtons(elements, state);

  if (!state.loadedSvg) {
    setBanner(elements.statusBanner, "info", "Chargez un SVG local pour préparer la conversion.");
    elements.details.textContent = "Les éléments `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` et leurs transformations simples sont priorisés.";
    return;
  }

  if (state.loadedSvg.supportedCount <= 0) {
    setBanner(elements.statusBanner, "warning", "Le SVG est chargé, mais aucun élément supporté n’a été détecté pour la conversion.");
    elements.details.textContent = "Aucune géométrie compatible n’a été trouvée dans ce fichier.";
    return;
  }

  if (state.conversion) {
    setBanner(elements.statusBanner, "success", "Conversion DXF prête. Vous pouvez télécharger le fichier.");
    const skipped = state.conversion.summary.skippedTags.length
      ? ` Éléments ignorés pendant la conversion : ${state.conversion.summary.skippedTags.join(", ")}.`
      : "";
    elements.details.textContent = `${state.conversion.summary.polylineCount} polylignes DXF générées.${skipped}`;
    return;
  }

  setBanner(elements.statusBanner, "success", "SVG chargé. Lancez la conversion vers DXF quand vous êtes prêt.");
  elements.details.textContent = "Le SVG original est prêt à être converti en polylignes DXF ASCII.";
}

function resetState(state, elements) {
  state.loadedSvg = null;
  state.conversion = null;
  elements.fileInput.value = "";
  clearPreview(state, elements);
  renderState(state, elements);
}

async function handleSvgFile(file, state, elements) {
  if (!file) {
    return;
  }

  try {
    state.loadedSvg = await loadSvgFromFile(file);
    state.conversion = null;
  } catch (error) {
    state.loadedSvg = null;
    state.conversion = null;
    clearPreview(state, elements);
    resetMetrics(elements);
    updateButtons(elements, state);
    updateUnsupportedMessages(elements, []);
    setBanner(elements.statusBanner, "error", error.message);
    elements.details.textContent = "Import impossible. Vérifiez que le fichier est bien un SVG valide.";
    updateFileMeta(elements, state);
    return;
  }

  renderState(state, elements);
}

function getExportName(state) {
  const baseName = state.loadedSvg?.fileName?.replace(/\.svg$/i, "") || "svg-to-dxf-export";
  return `${slugifyFilename(baseName)}.dxf`;
}

function bindDropzone(elements, state) {
  for (const eventName of ["dragenter", "dragover"]) {
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
    handleSvgFile(file, state, elements);
  });
}

export function createSvgToDxfApp() {
  const state = createInitialState();
  const elements = getElements();

  elements.fileButton.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener("change", (event) => {
    const [file] = [...event.target.files];
    handleSvgFile(file, state, elements);
  });

  elements.convertButton.addEventListener("click", () => {
    if (!state.loadedSvg) {
      return;
    }

    try {
      state.conversion = convertSvgMarkupToDxf(state.loadedSvg.markup, elements.precisionInput.value);
      renderState(state, elements);
    } catch (error) {
      state.conversion = null;
      setBanner(elements.statusBanner, "error", error.message);
      elements.details.textContent = "La conversion a échoué. Essayez un autre SVG ou une précision différente.";
      updateButtons(elements, state);
    }
  });

  elements.downloadButton.addEventListener("click", () => {
    if (!state.conversion) {
      return;
    }

    downloadTextFile(getExportName(state), state.conversion.content, "application/dxf");
  });

  elements.resetButton.addEventListener("click", () => {
    resetState(state, elements);
  });

  bindDropzone(elements, state);
  renderState(state, elements);
}
