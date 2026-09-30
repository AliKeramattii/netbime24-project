import { cloneTemplate, safeHref } from "../../js/html.js";
import { formatNotificationTimestamp } from "../notifications/notification-format.js";

let headerInstance = 0;
const faDigits = value => String(value).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);

function copyText(root, key) {
  return root.querySelector(`[data-header-copy="${key}"]`)?.textContent?.trim() || "";
}

export class NetbimeHeader extends HTMLElement {
  constructor() {
    super();
    this.instanceId = `netbime-header-${++headerInstance}`;
    this.onDocumentClick = this.onDocumentClick.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
  }

  connectedCallback() {
    this.classList.add("app-header-host");
    if (this.dataset.ready !== "true") {
      this.dataset.ready = "true";
      this.replaceChildren(cloneTemplate("netbime-header-template", this.ownerDocument));
      this.initializeStaticMarkup();
    }
    this.syncContextMarkup();
    this.bindEvents();
  }

  disconnectedCallback() {
    this.listeners?.abort();
  }

  initializeStaticMarkup() {
    const profileMenu = this.querySelector(".profile-menu");
    const notificationPopover = this.querySelector(".notification-popover");
    const profileButton = this.querySelector(".header-user-button");
    const notificationButton = this.querySelector(".header-bell-button");
    if (profileMenu) profileMenu.id = `${this.instanceId}-profile-menu`;
    if (notificationPopover) notificationPopover.id = `${this.instanceId}-notifications`;
    if (profileButton && profileMenu) profileButton.setAttribute("aria-controls", profileMenu.id);
    if (notificationButton && notificationPopover) notificationButton.setAttribute("aria-controls", notificationPopover.id);
  }

  setContext({ user, notifications }) {
    this.setAttribute("user-name", user?.displayName || user?.firstName || "");
    this.setAttribute("notification-count", notifications?.unreadCount || 0);
    this.syncContextMarkup();
  }

  syncContextMarkup() {
    const home = this.querySelector(".app-header__logo");
    if (home) home.href = safeHref(this.getAttribute("home-href") || "#");
    this.setUserName(this.getAttribute("user-name")?.trim());
    this.setNotificationCount(this.notificationCount);
  }

  setUserName(value) {
    const target = this.querySelector("[data-user-name]");
    const name = value || target?.dataset.defaultName || target?.textContent?.trim() || "";
    if (target) target.textContent = name;
    const button = this.querySelector(".header-user-button");
    if (button) {
      const prefix = button.dataset.labelPrefix || button.getAttribute("aria-label") || "";
      button.setAttribute("aria-label", [prefix, name].filter(Boolean).join(" "));
    }
  }

  setNotificationCount(value) {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    this.setAttribute("notification-count", String(count));
    const badge = this.querySelector(".header-notification-badge");
    const bell = this.querySelector(".header-bell-button");
    if (badge) {
      badge.hidden = count === 0;
      badge.textContent = count > 99 ? copyText(this, "notification-count-overflow") : faDigits(count);
    }
    if (bell) {
      const prefix = bell.dataset.labelPrefix || bell.getAttribute("aria-label") || "";
      const suffixTemplate = copyText(this, "unread-notification-label");
      const suffix = count ? suffixTemplate.replace("{count}", faDigits(count)) : "";
      bell.setAttribute("aria-label", [prefix, suffix].filter(Boolean).join("، "));
    }
  }

  get notificationCount() {
    const parsed = Number(this.getAttribute("notification-count") || 0);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  }

  get notificationsOpen() {
    return this.querySelector(".notification-popover")?.hidden === false;
  }

  setNotificationState(name) {
    this.querySelectorAll("[data-notification-state]").forEach(node => {
      node.hidden = node.dataset.notificationState !== name;
    });
  }

  renderNotifications({ state = "loaded", notifications = [], message = "", unreadCount = this.notificationCount, comingSoon = false } = {}) {
    this.setNotificationCount(unreadCount);
    const listElement = this.querySelector("[data-notification-list]");
    const markAll = this.querySelector("[data-notifications-mark-all]");
    const allLink = this.querySelector("[data-notifications-all-link]");
    const allDisabled = this.querySelector("[data-notifications-all-disabled]");
    if (!listElement) return;

    if (state === "loading") {
      this.setNotificationState("loading");
      return;
    }
    if (state === "error") {
      const errorMessage = this.querySelector("[data-notification-error-message]");
      if (errorMessage && message) errorMessage.textContent = message;
      this.setNotificationState("error");
      return;
    }
    if (comingSoon) {
      this.setNotificationState("coming-soon");
      return;
    }

    const list = Array.isArray(notifications) ? notifications : [];
    this.notificationItems = list;
    listElement.replaceChildren();
    const template = this.querySelector("template[data-notification-item-template]");
    for (const item of list) {
      if (!(template instanceof HTMLTemplateElement)) break;
      const fragment = template.content.cloneNode(true);
      const row = fragment.querySelector(".notification-preview");
      const button = fragment.querySelector("[data-notification-id]");
      row?.classList.toggle("is-read", Boolean(item.isRead));
      row?.classList.toggle("is-unread", !item.isRead);
      if (button) {
        button.dataset.notificationId = String(item.id ?? "");
        button.dataset.notificationRoute = String(item.action?.route || "");
      }
      const title = fragment.querySelector("[data-notification-title]");
      const date = fragment.querySelector("[data-notification-date]");
      if (title) title.textContent = item.title || "";
      if (date) date.textContent = formatNotificationTimestamp(item.createdAt);
      const readState = fragment.querySelector("[data-notification-read-state]");
      if (readState) readState.textContent = copyText(this, item.isRead ? "notification-read" : "notification-unread");
      listElement.append(fragment);
    }

    if (markAll) markAll.hidden = !list.some(item => !item.isRead);
    const notificationsHref = this.getAttribute("notifications-href");
    if (allLink) {
      allLink.hidden = !notificationsHref;
      if (notificationsHref) allLink.href = safeHref(notificationsHref);
    }
    if (allDisabled) allDisabled.hidden = Boolean(notificationsHref);
    this.setNotificationState(list.length ? "list" : "empty");
  }

  bindEvents() {
    this.listeners?.abort();
    this.listeners = new AbortController();
    const options = { signal: this.listeners.signal };

    this.querySelector(".app-header__menu-trigger")?.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("netbime:toggle-sidebar", { bubbles: true }));
    }, options);

    this.querySelector(".header-user-button")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.dispatchEvent(new CustomEvent("netbime:profile", { bubbles: true }));
    }, options);

    this.querySelector(".header-bell-button")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.dispatchEvent(new CustomEvent("netbime:notifications", { bubbles: true }));
    }, options);

    this.querySelector(".profile-menu")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-profile-action]");
      if (!button) return;
      this.closeProfileMenu();
      this.querySelector(".header-user-button")?.focus();
      this.dispatchEvent(new CustomEvent("netbime:profile-action", { bubbles: true, detail: { action: button.dataset.profileAction } }));
    }, options);

    this.querySelector(".notification-popover")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const retry = event.target.closest("[data-notifications-retry]");
      if (retry) {
        this.dispatchEvent(new CustomEvent("netbime:notifications-retry", { bubbles: true }));
        return;
      }
      const markAll = event.target.closest("[data-notifications-mark-all]");
      if (markAll) {
        this.dispatchEvent(new CustomEvent("netbime:notifications-mark-all", { bubbles: true }));
        return;
      }
      const item = event.target.closest("[data-notification-id]");
      if (item) {
        const notification = this.notificationItems?.find(entry => String(entry.id) === item.dataset.notificationId);
        this.dispatchEvent(new CustomEvent("netbime:notification-select", {
          bubbles: true,
          detail: { id: item.dataset.notificationId, action: notification?.action || null, actionUrl: notification?.actionUrl },
        }));
      }
    }, options);

    document.addEventListener("click", this.onDocumentClick, options);
    document.addEventListener("keydown", this.onKeydown, options);
  }

  onDocumentClick(event) {
    if (!this.contains(event.target)) {
      this.closeProfileMenu();
      this.closeNotificationsMenu();
    }
  }

  onKeydown(event) {
    const profile = this.querySelector(".profile-menu");
    const notifications = this.querySelector(".notification-popover");
    if (event.key === "Escape" && notifications && !notifications.hidden) {
      const restoreFocus = notifications.contains(document.activeElement);
      this.closeNotificationsMenu();
      if (restoreFocus) this.querySelector(".header-bell-button")?.focus();
      return;
    }
    if (!profile || profile.hidden) return;
    if (event.key === "Escape") {
      const restoreFocus = this.contains(document.activeElement);
      this.closeProfileMenu();
      if (restoreFocus) this.querySelector(".header-user-button")?.focus();
    } else if (profile.contains(event.target) && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = [...profile.querySelectorAll('[role="menuitem"]')];
      const index = items.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }

  openProfileMenu() {
    const menu = this.querySelector(".profile-menu");
    const button = this.querySelector(".header-user-button");
    if (!menu || !button) return;
    this.closeNotificationsMenu();
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    this.querySelector(".app-header")?.classList.add("is-profile-open");
  }

  closeProfileMenu() {
    const menu = this.querySelector(".profile-menu");
    const button = this.querySelector(".header-user-button");
    if (!menu || !button) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    this.querySelector(".app-header")?.classList.remove("is-profile-open");
  }

  toggleProfileMenu() {
    const menu = this.querySelector(".profile-menu");
    if (!menu || menu.hidden) {
      this.openProfileMenu();
      this.querySelector('[role="menuitem"]')?.focus();
    } else this.closeProfileMenu();
  }

  openNotificationsMenu() {
    const popover = this.querySelector(".notification-popover");
    const button = this.querySelector(".header-bell-button");
    if (!popover || !button) return;
    this.closeProfileMenu();
    popover.hidden = false;
    button.setAttribute("aria-expanded", "true");
    this.querySelector(".app-header")?.classList.add("is-notifications-open");
  }

  closeNotificationsMenu() {
    const popover = this.querySelector(".notification-popover");
    const button = this.querySelector(".header-bell-button");
    if (!popover || !button) return;
    popover.hidden = true;
    button.setAttribute("aria-expanded", "false");
    this.querySelector(".app-header")?.classList.remove("is-notifications-open");
  }

  setSidebarExpanded(isExpanded) {
    const button = this.querySelector(".app-header__menu-trigger");
    if (button) button.setAttribute("aria-expanded", String(Boolean(isExpanded)));
  }
}

if (!customElements.get("netbime-header")) customElements.define("netbime-header", NetbimeHeader);
