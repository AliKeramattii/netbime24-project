import {
  PERSIAN_MONTHS,
  formatJalaliDate,
  getCurrentJalaliYear,
  getJalaliMonthLength,
  getPersianWeekdayOffset,
  jalaliToIso,
  parseJalaliDate,
} from "./jalali.js";
import { cloneTemplate } from "./html.js";
import { toPersianDigits } from "./validation.js";

export class PersianDatePicker {
  constructor({ input, button, value = "", onSelect = () => {}, minYear = 1200, maxYear = getCurrentJalaliYear() }) {
    this.input = input;
    this.button = button;
    this.onSelect = onSelect;
    this.minYear = minYear;
    this.maxYear = maxYear;
    this.selected = parseJalaliDate(value);
    const initial = this.selected || { year: Math.max(minYear, maxYear - 30), month: 1, day: 1 };
    this.viewYear = initial.year;
    this.viewMonth = initial.month;
    this.isOpen = false;
    this.lastFocused = null;
    this.dialog = this.createDialog();
    this.boundOutside = (event) => {
      if (!this.dialog.contains(event.target) && event.target !== this.input && event.target !== this.button) this.close(false);
    };
    this.bind();
    this.syncInput();
  }

  createDialog() {
    const fragment = cloneTemplate("persian-date-picker-template", this.input.ownerDocument);
    const dialog = fragment.querySelector(".persian-calendar");
    if (!dialog) throw new Error("Persian date picker template is incomplete.");
    dialog.id = `${this.input.id}-calendar`;
    this.input.closest(".birth-date-control")?.append(dialog);
    this.input.setAttribute("aria-controls", dialog.id);
    this.input.setAttribute("aria-haspopup", "dialog");
    this.input.setAttribute("aria-expanded", "false");
    this.button?.setAttribute("aria-controls", dialog.id);
    this.button?.setAttribute("aria-expanded", "false");

    const yearSelect = dialog.querySelector("[data-calendar-year]");
    for (let year = this.maxYear; year >= this.minYear; year -= 1) {
      const option = new Option(toPersianDigits(year), String(year));
      yearSelect?.add(option);
    }
    dialog.querySelector("[data-calendar-next]")?.addEventListener("click", () => this.changeMonth(1));
    dialog.querySelector("[data-calendar-previous]")?.addEventListener("click", () => this.changeMonth(-1));
    dialog.querySelector("[data-calendar-month]")?.addEventListener("change", event => {
      this.viewMonth = Number(event.currentTarget.value);
      this.render();
    });
    yearSelect?.addEventListener("change", event => {
      this.viewYear = Number(event.currentTarget.value);
      this.render();
    });
    return dialog;
  }

  bind() {
    const openFromControl = (event) => {
      if (event.type === "keydown" && !["Enter", " ", "ArrowDown"].includes(event.key)) return;
      if (event.type === "keydown") event.preventDefault();
      this.open();
    };
    this.input.addEventListener("click", openFromControl);
    this.input.addEventListener("keydown", openFromControl);
    this.button?.addEventListener("click", openFromControl);
    this.button?.addEventListener("keydown", openFromControl);
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.lastFocused = document.activeElement;
    this.dialog.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    this.button?.setAttribute("aria-expanded", "true");
    this.render();
    document.addEventListener("pointerdown", this.boundOutside, true);
    document.addEventListener("keydown", this.onDocumentKeyDown);
    queueMicrotask(() => this.dialog.querySelector(".calendar-day.is-selected, .calendar-day:not(:disabled)")?.focus());
  }

  close(restoreFocus = true) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.dialog.hidden = true;
    this.input.setAttribute("aria-expanded", "false");
    this.button?.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", this.boundOutside, true);
    document.removeEventListener("keydown", this.onDocumentKeyDown);
    if (restoreFocus) (this.lastFocused || this.input).focus();
  }

  onDocumentKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
    }
  };

  render() {
    const nextButton = this.dialog.querySelector("[data-calendar-next]");
    const previousButton = this.dialog.querySelector("[data-calendar-previous]");
    const monthSelect = this.dialog.querySelector("[data-calendar-month]");
    const yearSelect = this.dialog.querySelector("[data-calendar-year]");
    const grid = this.dialog.querySelector("[data-calendar-grid]");
    if (!nextButton || !previousButton || !monthSelect || !yearSelect || !grid) return;

    nextButton.disabled = this.viewYear === this.maxYear && this.viewMonth === 12;
    previousButton.disabled = this.viewYear === this.minYear && this.viewMonth === 1;
    monthSelect.value = String(this.viewMonth);
    yearSelect.value = String(this.viewYear);
    grid.setAttribute("aria-label", `${PERSIAN_MONTHS[this.viewMonth - 1]} ${toPersianDigits(this.viewYear)}`);
    grid.querySelectorAll("[data-calendar-dynamic]").forEach(node => node.remove());

    const offset = getPersianWeekdayOffset(this.viewYear, this.viewMonth);
    for (let i = 0; i < offset; i += 1) grid.append(cloneTemplate("persian-calendar-empty-template", this.input.ownerDocument));

    const length = getJalaliMonthLength(this.viewYear, this.viewMonth);
    for (let day = 1; day <= length; day += 1) {
      const fragment = cloneTemplate("persian-calendar-day-template", this.input.ownerDocument);
      const dayButton = fragment.querySelector(".calendar-day");
      if (!dayButton) continue;
      dayButton.dataset.day = String(day);
      dayButton.textContent = toPersianDigits(day);
      const selected = this.selected && this.selected.year === this.viewYear && this.selected.month === this.viewMonth && this.selected.day === day;
      dayButton.classList.toggle("is-selected", Boolean(selected));
      dayButton.setAttribute("aria-selected", String(Boolean(selected)));
      dayButton.setAttribute("aria-label", `${toPersianDigits(day)} ${PERSIAN_MONTHS[this.viewMonth - 1]} ${toPersianDigits(this.viewYear)}`);
      dayButton.addEventListener("click", () => this.selectDay(day));
      dayButton.addEventListener("keydown", (event) => this.handleDayKey(event, day));
      grid.append(fragment);
    }
  }

  changeMonth(delta) {
    let month = this.viewMonth + delta;
    let year = this.viewYear;
    if (month > 12) { month = 1; year += 1; }
    if (month < 1) { month = 12; year -= 1; }
    if (year < this.minYear || year > this.maxYear) return;
    this.viewYear = year;
    this.viewMonth = month;
    this.render();
    queueMicrotask(() => this.dialog.querySelector(".calendar-day")?.focus());
  }

  selectDay(day) {
    const jalali = formatJalaliDate(this.viewYear, this.viewMonth, day);
    const iso = jalaliToIso(this.viewYear, this.viewMonth, day);
    if (!iso) return;
    this.selected = { year: this.viewYear, month: this.viewMonth, day };
    this.syncInput();
    this.onSelect({ jalali, year: this.viewYear, month: this.viewMonth, day, iso });
    this.close();
  }

  handleDayKey(event, day) {
    const stepByKey = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in stepByKey)) return;
    event.preventDefault();
    const target = day + stepByKey[event.key];
    if (target >= 1 && target <= getJalaliMonthLength(this.viewYear, this.viewMonth)) {
      this.dialog.querySelector(`[data-day="${target}"]`)?.focus();
    }
  }

  syncInput() {
    this.input.value = this.selected
      ? toPersianDigits(formatJalaliDate(this.selected.year, this.selected.month, this.selected.day))
      : "";
  }
}
