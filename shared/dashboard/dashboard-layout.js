import { initializeAuthenticatedShell } from "./app-shell.js";
import "./header.js";
import "./sidebar.js";

const mobileBreakpoint = 1024;

function initializeDashboardLayout() {
  const header = document.querySelector("netbime-header");
  const sidebar = document.querySelector("netbime-sidebar");
  const layout = document.querySelector(".dashboard-layout");
  if (!header || !sidebar || !layout) return;

  initializeAuthenticatedShell();

  const content = document.querySelector(".dashboard-content");

  const overlay = document.querySelector(".dashboard-sidebar-overlay");
  if (!overlay) return;

  const setOpen = (open, { restoreFocus = false } = {}) => {
    const shouldOpen = Boolean(open) && window.innerWidth <= mobileBreakpoint;
    document.body.classList.toggle("is-sidebar-open", shouldOpen);
    sidebar.classList.toggle("is-open", shouldOpen);
    overlay.hidden = !shouldOpen;
    header.setSidebarExpanded?.(shouldOpen);
    sidebar.inert = window.innerWidth <= mobileBreakpoint && !shouldOpen;
    if (content) content.inert = shouldOpen;
    if (shouldOpen) sidebar.querySelector(".sidebar-link")?.focus();
    if (!shouldOpen && restoreFocus) {
      header.querySelector(".app-header__menu-trigger")?.focus();
    }
  };

  header.addEventListener("netbime:toggle-sidebar", () => {
    setOpen(!document.body.classList.contains("is-sidebar-open"), { restoreFocus: true });
  });

  overlay.addEventListener("click", () => setOpen(false, { restoreFocus: true }));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && document.body.classList.contains("is-sidebar-open")) {
      const focusable = [header.querySelector(".app-header__menu-trigger"), ...sidebar.querySelectorAll("a.sidebar-link, button.sidebar-link, a.sidebar-sublink")].filter(Boolean);
      event.preventDefault();
      const index = focusable.indexOf(document.activeElement);
      const next = index < 0 ? 0 : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      focusable[next]?.focus();
    }
    if (event.key === "Escape" && document.body.classList.contains("is-sidebar-open")) {
      setOpen(false, { restoreFocus: true });
    }
  });

  sidebar.addEventListener("click", (event) => {
    if (window.innerWidth <= mobileBreakpoint && event.target.closest("a.sidebar-link, button.sidebar-link, a.sidebar-sublink")) setOpen(false);
  });

  setOpen(false);

  window.addEventListener("resize", () => {
    setOpen(window.innerWidth <= mobileBreakpoint && document.body.classList.contains("is-sidebar-open"));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDashboardLayout, { once: true });
} else {
  initializeDashboardLayout();
}
