import { cloneTemplate } from "../../js/html.js";

export class NetbimeSidebar extends HTMLElement {
  static get observedAttributes() { return ["active-item", "account-status"]; }

  connectedCallback() {
    this.classList.add("app-sidebar-host");
    if (this.dataset.ready !== "true") {
      this.dataset.ready = "true";
      this.replaceChildren(cloneTemplate("netbime-sidebar-template", this.ownerDocument));
      this.bindInteractions();
    }
    this.applyActiveState();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.isConnected && name === "active-item") this.applyActiveState();
  }

  setContext(context) {
    this.setAttribute("account-status", context?.account?.status || "registration");
  }

  get activeItem() { return this.getAttribute("active-item") || "moarefe"; }

  applyActiveState() {
    const active = this.activeItem;
    this.querySelectorAll("[data-sidebar-id]").forEach(item => {
      const direct = item.dataset.sidebarId === active;
      const childActive = Boolean(item.querySelector(`[data-sidebar-id="${active}"]`));
      const isActive = direct || childActive;
      item.classList.toggle("is-active", isActive);
      const link = item.querySelector(":scope > .sidebar-link, :scope > .sidebar-sublink");
      if (link && !link.matches("[aria-disabled='true']")) {
        if (direct) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
      if (item.classList.contains("sidebar-item--parent") && childActive) {
        const toggle = item.querySelector(":scope > .sidebar-parent-toggle");
        const submenu = item.querySelector(":scope > .sidebar-submenu");
        item.classList.add("is-expanded");
        toggle?.setAttribute("aria-expanded", "true");
        if (submenu) submenu.hidden = false;
      }
    });
  }

  bindInteractions() {
    this.querySelectorAll(".sidebar-parent-toggle").forEach(button => {
      button.addEventListener("click", () => {
        const item = button.closest(".sidebar-item--parent");
        const submenu = item?.querySelector(".sidebar-submenu");
        const nextExpanded = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(nextExpanded));
        item?.classList.toggle("is-expanded", nextExpanded);
        if (submenu) submenu.hidden = !nextExpanded;
      });
    });
    this.querySelectorAll("[data-sidebar-action]").forEach(button => {
      button.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("netbime:sidebar-action", {
          bubbles: true,
          detail: { action: button.dataset.sidebarAction },
        }));
      });
    });
  }
}

if (!customElements.get("netbime-sidebar")) customElements.define("netbime-sidebar", NetbimeSidebar);
