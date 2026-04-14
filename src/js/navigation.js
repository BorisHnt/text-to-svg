const DEFAULT_VIEW = "text-to-svg";

function getRouteFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || DEFAULT_VIEW;
}

function isKnownView(view, views) {
  return views.some((section) => section.dataset.view === view);
}

export function createNavigation() {
  const buttons = [...document.querySelectorAll("[data-view-button]")];
  const views = [...document.querySelectorAll(".view")];

  function applyView(view) {
    const resolvedView = isKnownView(view, views) ? view : DEFAULT_VIEW;

    for (const button of buttons) {
      button.classList.toggle("is-active", button.dataset.view === resolvedView);
      button.setAttribute("aria-pressed", String(button.dataset.view === resolvedView));
    }

    for (const section of views) {
      section.hidden = section.dataset.view !== resolvedView;
    }

    document.body.dataset.activeView = resolvedView;
  }

  function syncFromHash() {
    applyView(getRouteFromHash());
  }

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const nextView = button.dataset.view;

      if (window.location.hash.replace(/^#/, "") === nextView) {
        applyView(nextView);
        return;
      }

      window.location.hash = nextView;
    });
  }

  window.addEventListener("hashchange", syncFromHash);

  if (!window.location.hash) {
    history.replaceState(null, "", `#${DEFAULT_VIEW}`);
  }

  syncFromHash();
}
