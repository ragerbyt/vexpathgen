type AppMode = "path" | "viewer";

function setActiveMode(mode: AppMode): void {
  document.body.dataset.activeMode = mode;

  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-app-mode]");
  buttons.forEach((button) => {
    const isActive = button.dataset.appMode === mode;
    button.dataset.active = String(isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  const pathPanel = document.getElementById("pathControls");
  const viewerPanel = document.getElementById("viewerControls");
  const pathWorkspace = document.getElementById("pathWorkspace");
  const viewerWorkspace = document.getElementById("viewerWorkspace");

  if (pathPanel) pathPanel.hidden = mode !== "path";
  if (viewerPanel) viewerPanel.hidden = mode !== "viewer";
  if (pathWorkspace) pathWorkspace.hidden = mode !== "path";
  if (viewerWorkspace) viewerWorkspace.hidden = mode !== "viewer";

  window.dispatchEvent(new Event("resize"));
  document.dispatchEvent(new CustomEvent("app-mode-change", { detail: { mode } }));
}

function initShell(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>("[data-app-mode]");
  tabs.forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.appMode as AppMode | undefined;
      if (nextMode) {
        setActiveMode(nextMode);
      }
    });
  });

  setActiveMode((document.body.dataset.activeMode as AppMode) || "path");
}

document.addEventListener("DOMContentLoaded", initShell);
