import { normalizeDigits, toPersianDigits } from "./validation.js";

let instanceCounter = 0;

function normalizeSearchText(value) {
  return normalizeDigits(String(value || ""))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200e\u200f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

export class SearchableCombobox {
  constructor(root, {
    options = [],
    value = "",
    placeholder = null,
    searchPlaceholder = null,
    allowCustom = false,
    customValidator = null,
    formatValue = (valueToFormat) => toPersianDigits(valueToFormat),
    onChange = () => {},
    onInvalidCustom = () => {},
  } = {}) {
    if (!root) throw new Error("SearchableCombobox requires a root element");
    this.root = root;
    this.id = root.dataset.searchableRoot || `combobox-${++instanceCounter}`;
    this.trigger = root.querySelector(".searchable-combobox__trigger");
    this.popup = root.querySelector("[data-combobox-popup]");
    this.search = root.querySelector(".searchable-combobox__search");
    this.list = root.querySelector(".searchable-combobox__list");
    this.empty = root.querySelector("[data-combobox-empty]");
    this.options = options.map(String);
    this.value = String(value || "");
    this.placeholder = placeholder ?? root.dataset.placeholder ?? this.trigger.querySelector(".searchable-combobox__value")?.textContent ?? "";
    this.searchPlaceholder = searchPlaceholder ?? this.search.getAttribute("placeholder") ?? "";
    this.allowCustom = allowCustom;
    this.customValidator = customValidator;
    this.formatValue = formatValue;
    this.onChange = onChange;
    this.onInvalidCustom = onInvalidCustom;
    this.activeIndex = -1;
    this.filtered = [];
    this.isOpen = false;
    this.search.placeholder = this.searchPlaceholder;
    this.boundOutside = (event) => {
      if (!this.root.contains(event.target)) this.close(false);
    };
    this.bind();
    this.renderOptions();
    this.syncTrigger();
  }

  bind() {
    this.trigger.addEventListener("click", () => this.toggle());
    this.trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        this.open();
      }
    });
    this.search.addEventListener("input", () => this.renderOptions());
    this.search.addEventListener("keydown", (event) => this.onKeyDown(event));
  }

  updateOptions(options, { value = this.value, disabled = this.trigger.disabled } = {}) {
    this.options = options.map(String);
    this.value = String(value || "");
    this.trigger.disabled = Boolean(disabled);
    this.root.querySelector(".searchable-combobox")?.classList.toggle("is-disabled", Boolean(disabled));
    this.renderOptions();
    this.syncTrigger();
  }

  setValue(value) {
    this.value = String(value || "");
    this.syncTrigger();
  }

  setError(message = "") {
    const error = this.root.querySelector(".registration-field-error");
    this.trigger.setAttribute("aria-invalid", String(Boolean(message)));
    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.trigger.disabled || this.isOpen) return;
    this.isOpen = true;
    this.popup.hidden = false;
    this.trigger.setAttribute("aria-expanded", "true");
    this.search.value = "";
    this.renderOptions();
    const selectedIndex = this.filtered.findIndex((item) => item.value === this.value);
    this.activeIndex = selectedIndex >= 0 ? selectedIndex : (this.filtered.length ? 0 : -1);
    this.syncActiveOption();
    document.addEventListener("pointerdown", this.boundOutside, true);
    queueMicrotask(() => this.search.focus());
  }

  close(restoreFocus = true) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.popup.hidden = true;
    this.trigger.setAttribute("aria-expanded", "false");
    this.search.removeAttribute("aria-activedescendant");
    document.removeEventListener("pointerdown", this.boundOutside, true);
    if (restoreFocus) this.trigger.focus();
  }

  renderOptions() {
    const query = normalizeSearchText(this.search.value);
    const regular = this.options
      .filter((option) => normalizeSearchText(option).includes(query))
      .map((value) => ({ value, label: this.formatValue(value), custom: false }));

    const rawCustom = normalizeDigits(this.search.value).trim();
    const hasExact = this.options.includes(rawCustom);
    let custom = null;
    if (this.allowCustom && rawCustom && !hasExact) {
      const accepted = this.customValidator ? this.customValidator(rawCustom) : true;
      if (accepted) {
        const template = this.root.dataset.customOptionLabel || "{value}";
        custom = { value: rawCustom, label: template.replace("{value}", this.formatValue(rawCustom)), custom: true };
      }
    }

    this.filtered = custom ? [custom, ...regular] : regular;
    this.list.replaceChildren();
    this.filtered.forEach((item, index) => {
      const option = document.createElement("div");
      option.id = `${this.id}-option-${index}`;
      option.className = "searchable-combobox__option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(item.value === this.value));
      option.dataset.optionIndex = String(index);
      option.textContent = item.label;
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => this.selectIndex(index));
      this.list.append(option);
    });
    this.empty.hidden = this.filtered.length > 0;
    this.activeIndex = this.filtered.length ? Math.min(Math.max(this.activeIndex, 0), this.filtered.length - 1) : -1;
    this.syncActiveOption();
  }

  syncActiveOption() {
    const options = this.list.querySelectorAll('[role="option"]');
    options.forEach((option, index) => option.classList.toggle("is-active", index === this.activeIndex));
    if (this.activeIndex >= 0 && options[this.activeIndex]) {
      const active = options[this.activeIndex];
      this.search.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    } else {
      this.search.removeAttribute("aria-activedescendant");
    }
  }

  onKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.filtered.length) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      this.activeIndex = (this.activeIndex + delta + this.filtered.length) % this.filtered.length;
      this.syncActiveOption();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (this.activeIndex >= 0) {
        this.selectIndex(this.activeIndex);
        return;
      }
      if (this.allowCustom) this.onInvalidCustom(normalizeDigits(this.search.value).trim());
    }
  }

  selectIndex(index) {
    const item = this.filtered[index];
    if (!item) return;
    this.value = item.value;
    this.syncTrigger();
    this.close();
    this.onChange(item.value, { custom: item.custom });
  }

  syncTrigger() {
    const display = this.trigger.querySelector(".searchable-combobox__value");
    if (!display) return;
    display.textContent = this.value ? this.formatValue(this.value) : this.placeholder;
    display.classList.toggle("is-placeholder", !this.value);
  }
}
