// spec.jev Phase 0 prototype controller.
// Theme: dark / light / auto (auto follows the OS). Screen: conversation / appearance / mobile.

const root = document.documentElement;
const systemLight = window.matchMedia("(prefers-color-scheme: light)");

const state = {
  mode: "auto",
  screen: "conversation",
};

function resolvedTheme(mode) {
  if (mode === "auto") return systemLight.matches ? "light" : "dark";
  return mode;
}

function applyTheme(mode, { remember = true } = {}) {
  state.mode = mode;
  const theme = resolvedTheme(mode);
  root.dataset.mode = mode;
  root.dataset.theme = theme;

  document.querySelectorAll(".lab-theme [data-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });

  document.querySelectorAll("[data-theme-card]").forEach((card) => {
    card.setAttribute("aria-pressed", String(card.dataset.themeCard === mode));
  });

  const status = document.querySelector("#auto-status");
  if (status) {
    status.textContent = `Following the system · ${systemLight.matches ? "light" : "dark"}`;
  }

  if (remember) {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    history.replaceState(null, "", url);
  }
}

function applyScreen(screen, { remember = true } = {}) {
  state.screen = screen;
  document.querySelectorAll("[data-screen-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.screenPanel !== screen;
  });
  document.querySelectorAll(".lab-screens [data-screen]").forEach((button) => {
    button.classList.toggle("on", button.dataset.screen === screen);
    button.setAttribute("aria-pressed", String(button.dataset.screen === screen));
  });
  if (remember) {
    const url = new URL(window.location.href);
    url.searchParams.set("screen", screen);
    history.replaceState(null, "", url);
  }
}

document.querySelectorAll(".lab-theme [data-mode]").forEach((button) => {
  button.addEventListener("click", () => applyTheme(button.dataset.mode));
});

document.querySelectorAll("[data-theme-card]").forEach((card) => {
  card.addEventListener("click", () => applyTheme(card.dataset.themeCard));
});

document.querySelectorAll(".lab-screens [data-screen]").forEach((button) => {
  button.addEventListener("click", () => applyScreen(button.dataset.screen));
});

systemLight.addEventListener("change", () => {
  applyTheme(state.mode, { remember: false });
});

const params = new URLSearchParams(window.location.search);
if (params.get("embed") === "1") document.body.classList.add("embed");
const initialMode = params.get("mode");
if (initialMode === "dark" || initialMode === "light" || initialMode === "auto") {
  applyTheme(initialMode, { remember: false });
} else {
  applyTheme("auto", { remember: false });
}

const initialScreen = params.get("screen");
if (initialScreen === "conversation" || initialScreen === "appearance" || initialScreen === "mobile") {
  applyScreen(initialScreen, { remember: false });
} else {
  applyScreen("conversation", { remember: false });
}
