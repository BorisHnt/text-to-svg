export function renderPreview(target, markup) {
  target.innerHTML = markup.replace(/^<\?xml[\s\S]*?\?>\s*/i, "");
}

export function clearPreview(target) {
  target.textContent = "";
}
