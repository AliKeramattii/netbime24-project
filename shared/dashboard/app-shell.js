import { api } from "../../js/api.js";
import { APP_ROUTES } from "./app-routes.js";
import { STORAGE_KEYS } from "../../js/storage-keys.js";
import { readTextTemplate } from "../../js/html.js";
import {
  getDashboardContext,
  refreshDashboardContext,
  invalidateDashboardContext,
  redirectToAuth,
} from "./dashboard-context.js";

let shellPromise = null;
let shellListeners = null;

function ensureStatusRegion() {
  return document.querySelector("#authenticated-shell-status");
}

function announce(message) {
  const region = ensureStatusRegion();
  if (!region) return;
  region.textContent = "";
  requestAnimationFrame(() => { region.textContent = message || ""; });
}

function shellCopy(key) {
  return readTextTemplate(`[data-shell-copy="${key}"]`, document);
}

function setWelcome(context) {
  const welcome = document.querySelector("[data-user-welcome]");
  const suffix = document.querySelector("[data-user-welcome-suffix]");
  const name = context?.user?.firstName || context?.user?.displayName;
  if (welcome && name) welcome.textContent = name;
  if (suffix && name) {
    suffix.textContent = readTextTemplate(`[data-welcome-suffix="${name.endsWith("ا") ? "ye" : "default"}"]`, document);
  }
}

function applyContext(context) {
  const header = document.querySelector("netbime-header");
  const sidebar = document.querySelector("netbime-sidebar");
  if (!header || !sidebar) return;
  header.setAttribute("home-href", APP_ROUTES.moarefe);
  header.removeAttribute("notifications-href");
  header.setContext?.({ ...context, notifications: { unreadCount: 0 } });
  sidebar.setContext?.(context);
  setWelcome(context);
}

function showComingSoonNotifications(header) {
  if (header.notificationsOpen) {
    header.closeNotificationsMenu?.();
    return;
  }
  header.openNotificationsMenu?.();
  header.renderNotifications?.({ state: "loaded", notifications: [], unreadCount: 0, comingSoon: true });
}

async function logout() {
  try {
    const result = await api.logout();
    if (!result?.success) throw new Error(result?.message || shellCopy("logout-failed"));
    invalidateDashboardContext();
    shellPromise = null;
    try { sessionStorage.removeItem(STORAGE_KEYS.registration); } catch { /* storage is optional */ }
    if (typeof window !== "undefined") window.location.replace(APP_ROUTES.auth);
  } catch (error) {
    announce(error.message || shellCopy("logout-failed-retry"));
  }
}

function bindShellEvents(header, sidebar) {
  shellListeners?.abort();
  shellListeners = new AbortController();
  const options = { signal: shellListeners.signal };

  header.addEventListener("netbime:profile", () => header.toggleProfileMenu?.(), options);
  header.addEventListener("netbime:notifications", () => showComingSoonNotifications(header), options);
  header.addEventListener("netbime:profile-action", event => {
    if (event.detail?.action === "logout") logout();
    else if (event.detail?.action === "account") announce(shellCopy("profile-coming-soon"));
    else if (event.detail?.action === "notifications") announce(shellCopy("notifications-coming-soon"));
  }, options);
  sidebar.addEventListener("netbime:sidebar-action", event => {
    if (event.detail?.action === "logout") logout();
  }, options);
}

export function initializeAuthenticatedShell() {
  if (shellPromise) return shellPromise;
  const header = document.querySelector("netbime-header");
  const sidebar = document.querySelector("netbime-sidebar");
  if (!header || !sidebar) return Promise.resolve({ success: false, code: "SHELL_MISSING" });

  header.setAttribute("home-href", APP_ROUTES.moarefe);
  header.removeAttribute("notifications-href");
  bindShellEvents(header, sidebar);

  shellPromise = getDashboardContext().then((context) => {
    if (!context?.success) {
      announce(context?.message || shellCopy("context-load-failed"));
      return context;
    }
    if (context.authenticated === false || !context.user) {
      redirectToAuth();
      return { ...context, redirected: true };
    }
    applyContext(context);
    return context;
  });
  return shellPromise;
}

export async function refreshAuthenticatedShell() {
  const context = await refreshDashboardContext();
  if (!context?.success) return context;
  if (context.authenticated === false || !context.user) {
    redirectToAuth();
    return { ...context, redirected: true };
  }
  applyContext(context);
  return context;
}

export { logout as logoutAuthenticatedUser };
