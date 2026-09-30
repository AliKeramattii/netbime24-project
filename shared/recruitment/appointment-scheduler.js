import { appointmentView, calendarDayView, getTehranDateKey } from "../../js/appointment-data.js";
import { cloneTemplate, readTextTemplate } from "../../js/html.js";
import {
  PERSIAN_MONTHS,
  getJalaliMonthLength,
  getPersianWeekdayOffset,
  jalaliToIso,
} from "../../js/jalali.js";
import { prepareIranOfficialHolidays } from "../../js/iran-holidays.js";
import { toPersianDigits } from "../../js/validation.js";

const SUGGESTION_COUNT = 3;

function appointmentCopy(key, values = {}) {
  if (typeof document === "undefined") return "";
  return readTextTemplate(`[data-appointment-copy="${key}"]`, document, values);
}

export function formatAppointmentDate(appointment) {
  if (!appointment) return "";
  const monthName = PERSIAN_MONTHS[Number(appointment.month) - 1] || "";
  return `${appointment.weekday || ""} ${toPersianDigits(appointment.day)} ${monthName} ${toPersianDigits(appointment.year)}`.trim();
}

export function formatAppointmentTimeRange(appointment) {
  if (!appointment) return "";
  const start = toPersianDigits(appointment.startTime);
  const end = toPersianDigits(appointment.endTime);
  return appointmentCopy("time-range", { start, end }) || `${start} - ${end}`;
}

function formatDayDate(day) {
  const monthName = PERSIAN_MONTHS[Number(day?.month) - 1] || "";
  return `${toPersianDigits(day?.day)} ${monthName}`.trim();
}

function statusLabel(slot, selectable) {
  if (selectable) return "";
  if (slot?.isHoliday) return appointmentCopy("status-holiday");
  if (slot?.isPast) return appointmentCopy("status-past");
  if (slot?.status === "taken") return appointmentCopy("status-taken");
  return appointmentCopy("status-inactive");
}

/** Shared dynamic slot controller. Static scheduler and dialog markup live in page HTML. */
export class AppointmentScheduler {
  constructor({ root, dialog, state, appointments = [], days = [], config = {}, onBack, onChange, onSubmit, announce, onRetry } = {}) {
    if (!(root instanceof HTMLElement)) throw new TypeError("AppointmentScheduler requires a root HTMLElement.");
    if (!(dialog instanceof HTMLDialogElement)) throw new TypeError("AppointmentScheduler requires a native dialog element.");
    if (!state || typeof state !== "object") throw new TypeError("AppointmentScheduler requires a mutable scheduling state object.");
    if (!config.templateId) throw new TypeError("AppointmentScheduler requires config.templateId for static HTML markup.");

    this.root = root;
    this.dialog = dialog;
    this.state = state;
    this.config = { idPrefix: "appointment", ...config };
    this.appointments = [];
    this.days = [];
    this.rawAppointments = [];
    this.rawDays = [];
    this.months = [];
    this.onRetry = onRetry;
    this.loadState = "loading";
    this.message = "";
    this.onBack = typeof onBack === "function" ? onBack : () => {};
    this.onChange = typeof onChange === "function" ? onChange : () => {};
    this.onSubmit = typeof onSubmit === "function" ? onSubmit : async () => ({ success: true });
    this.announce = typeof announce === "function" ? announce : () => {};
    this.isSubmitting = false;
    this.draftCustomDateKey = "";
    this.draftCustomSlotId = "";
    this.lastFocusedCustomButton = null;
    this.modalYear = 0;
    this.modalMonth = 0;

    this.setAvailability(appointments, days, false);
    prepareIranOfficialHolidays().then(loaded => {
      if (!loaded) return;
      this.setAvailability(this.rawAppointments, this.rawDays, true);
      // Holidays load asynchronously; never replace a view the page has switched to meanwhile.
      if (this.root.isConnected && this.root.querySelector(".appointment-scheduler")) this.render();
      if (this.dialog.open) this.renderDialog();
    });
    this.handleDialogClose = this.handleDialogClose.bind(this);
    this.handleDialogCancel = this.handleDialogCancel.bind(this);
    this.dialog.addEventListener("close", this.handleDialogClose);
    this.dialog.addEventListener("cancel", this.handleDialogCancel);
  }

  destroy() {
    this.dialog.removeEventListener("close", this.handleDialogClose);
    this.dialog.removeEventListener("cancel", this.handleDialogCancel);
  }

  setAvailability(appointments = [], days = [], reconcile = true) {
    this.rawAppointments = (appointments || []).map(item => ({ ...item }));
    this.rawDays = (days || []).map(item => ({ ...item }));
    this.appointments = this.rawAppointments.map(appointmentView).filter(Boolean);
    const dayMap = new Map(this.rawDays.map(calendarDayView).filter(Boolean).map(day => [day.dateKey, day]));
    this.appointments.forEach(slot => {
      if (!dayMap.has(slot.dateKey)) dayMap.set(slot.dateKey, calendarDayView({ date: slot.dateKey, isHoliday: slot.isHoliday }));
    });
    this.days = [...dayMap.values()].filter(Boolean).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    this.rebuildMonths();

    if (!reconcile) return;
    if (this.state.selectedSlotId && !this.getSelectedAppointment()) this.clearSelection();
    if (this.state.customAppointment) {
      const fresh = this.appointments.find(slot => slot.id === this.state.customAppointment.id);
      this.state.customAppointment = fresh && this.isSelectableSlot(fresh) ? fresh : null;
    }
  }

  setAppointments(appointments, reconcile = true) {
    this.setAvailability(appointments, this.rawDays, reconcile);
  }

  rebuildMonths() {
    const today = getTehranDateKey();
    const monthKeys = new Set();
    this.days.filter(day => day.dateKey >= today).forEach(day => monthKeys.add(day.year * 12 + day.month - 1));
    this.appointments.filter(slot => slot.dateKey >= today).forEach(slot => monthKeys.add(slot.year * 12 + slot.month - 1));
    this.months = [...monthKeys].sort((a, b) => a - b);
    const currentMonth = this.modalYear * 12 + this.modalMonth - 1;
    if (this.months.length && !this.months.includes(currentMonth)) {
      const first = this.months[0];
      this.modalYear = Math.floor(first / 12);
      this.modalMonth = first % 12 + 1;
    }
  }

  getDay(dateKey) {
    return this.days.find(day => day.dateKey === dateKey) || calendarDayView({ date: dateKey });
  }

  isSelectableSlot(slot) {
    if (!slot || slot.status !== "available" || slot.isPast || slot.isHoliday) return false;
    const day = this.getDay(slot.dateKey);
    return Boolean(day && !day.isHoliday && !day.isPast);
  }

  isSelectableDay(day) {
    if (!day || day.isHoliday || day.isPast) return false;
    return this.appointments.some(slot => slot.dateKey === day.dateKey && this.isSelectableSlot(slot));
  }

  clearSelection() {
    this.state.selectedSlotId = "";
    this.state.customAppointment = null;
    this.draftCustomDateKey = "";
    this.draftCustomSlotId = "";
    this.onChange?.(this.state);
  }

  setLoadState(state, message = "") {
    this.loadState = state;
    this.message = message;
  }

  showMessage(message) {
    this.message = message;
    this.render();
    this.announce(message);
  }

  getSelectedAppointment() {
    const slot = this.appointments.find(item => item.id === this.state.selectedSlotId) || null;
    return this.isSelectableSlot(slot) ? slot : null;
  }

  getSuggestedAppointments() {
    const ordered = [...this.appointments].sort((a, b) => a.startAt.localeCompare(b.startAt));
    const suggestions = [];
    for (const slot of ordered) {
      if (!this.isSelectableSlot(slot)) continue;
      suggestions.push(slot);
      if (suggestions.length === SUGGESTION_COUNT) break;
    }
    return suggestions;
  }

  render() {
    this.root.replaceChildren(cloneTemplate(this.config.templateId));
    const card = this.root.querySelector(".appointment-scheduler");
    const feedback = card.querySelector("[data-scheduler-feedback]");
    const loadingText = card.querySelector("[data-feedback-loading]");
    const emptyText = card.querySelector("[data-feedback-empty]");
    const messageText = card.querySelector("[data-feedback-message]");
    const retry = card.querySelector("[data-scheduler-retry]");
    const fieldset = card.querySelector("[data-scheduler-fieldset]");
    const notes = card.querySelector("[data-scheduler-notes]");
    const actions = card.querySelector("[data-scheduler-actions]");

    card.querySelector("[data-scheduler-back]")?.addEventListener("click", () => this.onBack());

    const noAvailabilityData = this.appointments.length === 0 && this.days.length === 0;
    const showFeedback = this.loadState !== "loaded" || noAvailabilityData || Boolean(this.message);
    feedback.hidden = !showFeedback;
    loadingText.hidden = this.loadState !== "loading";
    emptyText.hidden = !(this.loadState === "loaded" && noAvailabilityData && !this.message);
    messageText.hidden = !this.message;
    messageText.textContent = this.message || "";
    retry.hidden = !(this.loadState === "error" || (noAvailabilityData && this.loadState === "loaded"));
    retry.onclick = () => this.onRetry?.();

    const contentUnavailable = this.loadState !== "loaded";
    fieldset.hidden = contentUnavailable;
    notes.hidden = contentUnavailable;
    actions.hidden = contentUnavailable;
    card.toggleAttribute("aria-busy", this.loadState === "loading");
    if (contentUnavailable) return card;

    this.renderSuggestedAppointments(card.querySelector("[data-appointment-days]"));
    this.configureCustomAppointmentCard(card.querySelector(".custom-appointment-button"));

    const checkbox = card.querySelector("[data-scheduler-terms]");
    checkbox.checked = this.state.termsAccepted === true;
    checkbox.addEventListener("change", () => {
      this.state.termsAccepted = checkbox.checked;
      this.onChange(this.state);
      this.updateSubmitState();
    });
    card.querySelector("[data-scheduler-submit]")?.addEventListener("click", () => this.submit());
    this.updateSubmitState();
    return card;
  }

  renderSuggestedAppointments(container) {
    if (!container) throw new Error("Missing appointment suggestion container.");
    const suggestions = this.getSuggestedAppointments();
    const cards = [...container.querySelectorAll("[data-suggestion-index]")];
    cards.forEach((wrapper, index) => {
      const slot = suggestions[index] || null;
      const input = wrapper.querySelector(".appointment-radio");
      const label = wrapper.querySelector(".appointment-card");
      const date = wrapper.querySelector("[data-appointment-date]");
      const time = wrapper.querySelector("[data-time-range]");
      const state = wrapper.querySelector("[data-time-status]");
      if (!input || !label || !date || !time || !state) return;
      if (!slot) return;

      input.disabled = false;
      input.name = `${this.config.idPrefix}-choice`;
      input.id = `${this.config.idPrefix}-${slot.id}`;
      input.value = slot.id;
      input.checked = this.state.selectedSlotId === slot.id && !this.state.customAppointment;
      input.addEventListener("change", () => {
        this.state.selectedSlotId = slot.id;
        this.state.customAppointment = null;
        this.onChange(this.state);
        this.render();
      });
      label.classList.remove("is-unavailable");
      label.htmlFor = input.id;
      date.textContent = formatAppointmentDate(slot);
      time.textContent = appointmentCopy("time-range-short", {
        start: toPersianDigits(slot.startTime),
        end: toPersianDigits(slot.endTime),
      });
      state.hidden = true;
      wrapper.dataset.slotId = slot.id;
    });
  }

  configureCustomAppointmentCard(button) {
    if (!button) return;
    const custom = appointmentView(this.state.customAppointment);
    const selectedCustom = Boolean(custom && this.state.selectedSlotId === custom.id && this.isSelectableSlot(custom));
    button.classList.toggle("is-selected", selectedCustom);
    button.setAttribute("aria-pressed", String(selectedCustom));
    const date = button.querySelector("[data-custom-date]");
    const hint = button.querySelector("[data-custom-hint]");
    if (custom) {
      date.textContent = formatAppointmentDate(custom);
      hint.textContent = formatAppointmentTimeRange(custom);
      hint.className = "custom-appointment-button__time";
    }
    button.disabled = !this.getDialogDays().some(day => this.isSelectableDay(day));
    button.addEventListener("click", () => {
      this.lastFocusedCustomButton = button;
      this.openDialog();
    });
  }

  updateSubmitState() {
    const button = this.root.querySelector("[data-scheduler-submit]");
    if (!button) return;
    const valid = Boolean(this.getSelectedAppointment() && this.state.termsAccepted && !this.isSubmitting);
    button.disabled = !valid;
    button.setAttribute("aria-disabled", String(!valid));
  }

  setSubmittingMarkup(busy) {
    const button = this.root.querySelector("[data-scheduler-submit]");
    if (!button) return;
    button.querySelector("[data-submit-idle]").hidden = busy;
    button.querySelector("[data-submit-busy]").hidden = !busy;
  }

  async submit() {
    if (this.isSubmitting) return;
    const selected = this.getSelectedAppointment();
    if (!selected || !this.state.termsAccepted) {
      this.announce(appointmentCopy("selection-required"));
      return;
    }
    this.isSubmitting = true;
    this.setSubmittingMarkup(true);
    this.updateSubmitState();
    try {
      await this.onSubmit(selected, { termsAccepted: true });
    } finally {
      this.isSubmitting = false;
      this.setSubmittingMarkup(false);
      this.updateSubmitState();
    }
  }

  getDraftCustomAppointment() {
    const slot = this.appointments.find(item => item.id === this.draftCustomSlotId) || null;
    if (!slot || slot.dateKey !== this.draftCustomDateKey) return null;
    return this.isSelectableSlot(slot) ? slot : null;
  }

  getDialogDays() {
    const today = getTehranDateKey();
    const map = new Map(this.days.filter(day => day.dateKey >= today).map(day => [day.dateKey, day]));
    this.appointments.filter(slot => slot.dateKey >= today).forEach(slot => {
      if (!map.has(slot.dateKey)) map.set(slot.dateKey, calendarDayView({ date: slot.dateKey, isHoliday: slot.isHoliday }));
    });
    return [...map.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  getJalaliMonthDays(year, month) {
    const length = getJalaliMonthLength(year, month);
    const apiDays = new Map(this.getDialogDays().map(day => [day.dateKey, day]));
    const result = [];
    for (let day = 1; day <= length; day += 1) {
      const dateKey = jalaliToIso(year, month, day);
      if (!dateKey) continue;
      result.push(apiDays.get(dateKey) || calendarDayView({ date: dateKey }));
    }
    return result.filter(Boolean);
  }

  getFirstSelectableDay() {
    return this.getDialogDays().find(day => this.isSelectableDay(day)) || null;
  }

  renderDialog() {
    const title = this.dialog.querySelector("[data-appointment-dialog-title]");
    const close = this.dialog.querySelector("[data-dialog-close]");
    const previous = this.dialog.querySelector("[data-month-previous]");
    const next = this.dialog.querySelector("[data-month-next]");
    const label = this.dialog.querySelector("[data-month-label]");
    const dateGrid = this.dialog.querySelector("[data-date-grid]");
    const times = this.dialog.querySelector("[data-dialog-times]");
    const timesEmpty = this.dialog.querySelector("[data-dialog-times-empty]");
    const selection = this.dialog.querySelector("[data-selection-value]");
    const confirm = this.dialog.querySelector("[data-confirm-selection]");
    if (!title || !close || !previous || !next || !label || !dateGrid || !times || !timesEmpty || !selection || !confirm) throw new Error("Appointment dialog static markup is incomplete.");

    close.onclick = () => this.dialog.close();
    label.textContent = `${PERSIAN_MONTHS[this.modalMonth - 1] || ""} ${toPersianDigits(this.modalYear)}`.trim();
    previous.disabled = !this.canChangeMonth(-1);
    next.disabled = !this.canChangeMonth(1);
    previous.onclick = () => this.changeMonth(-1);
    next.onclick = () => this.changeMonth(1);

    dateGrid.querySelectorAll("[data-calendar-dynamic]").forEach(node => node.remove());
    const offset = getPersianWeekdayOffset(this.modalYear, this.modalMonth);
    for (let index = 0; index < offset; index += 1) {
      dateGrid.append(cloneTemplate("appointment-calendar-empty-template", this.dialog.ownerDocument));
    }

    const monthDays = this.getJalaliMonthDays(this.modalYear, this.modalMonth);
    monthDays.forEach(day => {
      const selectable = this.isSelectableDay(day);
      const fragment = cloneTemplate("appointment-calendar-day-template", this.dialog.ownerDocument);
      const button = fragment.querySelector(".appointment-date-button");
      if (!button) return;
      button.dataset.dateKey = day.dateKey;
      button.disabled = !selectable;
      button.classList.toggle("is-friday", day.isFriday);
      button.classList.toggle("is-official-holiday", day.isOfficialHoliday);
      button.classList.toggle("is-backend-holiday", day.backendHoliday);
      button.classList.toggle("is-holiday", day.isHoliday);
      button.classList.toggle("is-unavailable", !selectable);
      button.classList.toggle("is-selected", day.dateKey === this.draftCustomDateKey);
      button.setAttribute("aria-pressed", String(day.dateKey === this.draftCustomDateKey));

      const holidaySuffix = day.holidayName ? `، ${day.holidayName}` : "";
      const holidayLabel = day.isFriday
        ? appointmentCopy("date-friday-aria")
        : day.isOfficialHoliday
          ? appointmentCopy("date-official-aria", { holidaySuffix })
          : day.backendHoliday
            ? appointmentCopy("date-backend-aria", { holidaySuffix })
            : selectable ? "" : appointmentCopy("date-unavailable-aria");
      button.setAttribute("aria-label", [day.weekday, formatDayDate(day), holidayLabel].filter(Boolean).join("، "));

      const weekday = fragment.querySelector("[data-calendar-weekday]");
      const date = fragment.querySelector("[data-calendar-date]");
      const state = fragment.querySelector("[data-calendar-state]");
      const holidayName = fragment.querySelector("[data-calendar-holiday]");
      if (weekday) weekday.textContent = day.weekday;
      if (date) date.textContent = toPersianDigits(day.day);
      if (day.isHoliday || !selectable) {
        if (state) {
          state.hidden = false;
          state.textContent = day.isFriday
            ? appointmentCopy("friday-holiday")
            : day.isOfficialHoliday
              ? appointmentCopy("official-holiday")
              : day.backendHoliday
                ? appointmentCopy("backend-holiday")
                : appointmentCopy("no-time");
        }
      }
      if (holidayName && day.isHoliday && day.holidayName && !day.isFriday) {
        holidayName.hidden = false;
        holidayName.textContent = day.holidayName;
        holidayName.title = day.holidayName;
      }

      button.addEventListener("click", () => {
        this.draftCustomDateKey = day.dateKey;
        if (this.getDraftCustomAppointment()?.dateKey !== day.dateKey) this.draftCustomSlotId = "";
        this.renderDialog();
        this.dialog.querySelector(`[data-date-key="${day.dateKey}"]`)?.focus();
      });
      dateGrid.append(fragment);
    });

    times.replaceChildren();
    const selectedDay = this.getDialogDays().find(day => day.dateKey === this.draftCustomDateKey) || null;
    const daySlots = selectedDay
      ? this.appointments.filter(slot => slot.dateKey === selectedDay.dateKey).sort((a, b) => a.startAt.localeCompare(b.startAt))
      : [];

    let emptyMessage = appointmentCopy("initial-time-empty");
    if (selectedDay?.isHoliday) {
      emptyMessage = selectedDay.holidayName
        ? appointmentCopy("holiday-named-time-empty", { holiday: selectedDay.holidayName })
        : appointmentCopy("holiday-time-empty");
    } else if (selectedDay && !daySlots.length) emptyMessage = appointmentCopy("date-no-slots");

    if (selectedDay && !selectedDay.isHoliday && daySlots.length) {
      daySlots.forEach(slot => {
        const selectable = this.isSelectableSlot(slot);
        const fragment = cloneTemplate("appointment-time-slot-template", this.dialog.ownerDocument);
        const button = fragment.querySelector(".appointment-dialog-time");
        if (!button) return;
        button.dataset.slotId = slot.id;
        button.dataset.status = selectable ? "available" : slot.status;
        button.disabled = !selectable;
        button.classList.toggle("is-selected", slot.id === this.draftCustomSlotId);
        button.setAttribute("aria-pressed", String(slot.id === this.draftCustomSlotId));
        button.setAttribute("aria-label", [formatAppointmentTimeRange(slot), selectable ? "" : statusLabel(slot, false)].filter(Boolean).join("، "));
        const range = fragment.querySelector("[data-dialog-time-range]");
        const state = fragment.querySelector("[data-dialog-time-state]");
        if (range) range.textContent = appointmentCopy("time-range-short", { start: toPersianDigits(slot.startTime), end: toPersianDigits(slot.endTime) });
        if (!selectable && state) {
          state.hidden = false;
          state.textContent = statusLabel(slot, false);
        }
        button.addEventListener("click", () => {
          this.draftCustomSlotId = slot.id;
          this.renderDialog();
          this.dialog.querySelector(`[data-slot-id="${slot.id}"]`)?.focus();
        });
        times.append(fragment);
      });
      emptyMessage = daySlots.some(slot => this.isSelectableSlot(slot)) ? "" : appointmentCopy("no-selectable-time");
    }

    timesEmpty.textContent = emptyMessage;
    timesEmpty.hidden = !emptyMessage;

    const selected = this.getDraftCustomAppointment();
    selection.textContent = selected
      ? `${formatAppointmentDate(selected)} - ${appointmentCopy("time-range-short", { start: toPersianDigits(selected.startTime), end: toPersianDigits(selected.endTime) })}`
      : "";
    confirm.disabled = !selected;
    confirm.onclick = () => this.confirmCustomAppointment();
  }

  canChangeMonth(delta) {
    const index = this.months.indexOf(this.modalYear * 12 + this.modalMonth - 1);
    return index >= 0 && index + delta >= 0 && index + delta < this.months.length;
  }

  changeMonth(delta) {
    if (!this.canChangeMonth(delta)) return;
    const month = this.months[this.months.indexOf(this.modalYear * 12 + this.modalMonth - 1) + delta];
    this.modalYear = Math.floor(month / 12);
    this.modalMonth = month % 12 + 1;
    this.draftCustomDateKey = "";
    this.draftCustomSlotId = "";
    this.renderDialog();
  }

  openDialog({ selectedSlotId = "" } = {}) {
    if (this.loadState !== "loaded" || !this.months.length) return;
    const requestedId = selectedSlotId || this.state.customAppointment?.id;
    const existing = this.appointments.find(slot => slot.id === requestedId && this.isSelectableSlot(slot));
    const firstDay = existing ? this.getDay(existing.dateKey) : this.getFirstSelectableDay();
    if (!firstDay) return;

    this.modalYear = firstDay.year;
    this.modalMonth = firstDay.month;
    this.draftCustomDateKey = firstDay.dateKey;
    this.draftCustomSlotId = existing?.id || "";
    this.renderDialog();
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector("[data-appointment-dialog-title]")?.focus();
  }

  confirmCustomAppointment() {
    const appointment = this.getDraftCustomAppointment();
    if (!appointment) return;
    this.state.customAppointment = appointment;
    this.state.selectedSlotId = appointment.id;
    this.onChange(this.state);
    this.dialog.close();
    this.render();
    this.announce(appointmentCopy("selection-confirmed"));
  }

  handleDialogClose() {
    this.draftCustomDateKey = "";
    this.draftCustomSlotId = "";
    const focusTarget = this.root.querySelector(".custom-appointment-button") || this.lastFocusedCustomButton;
    focusTarget?.focus();
  }

  handleDialogCancel() {
    this.draftCustomDateKey = "";
    this.draftCustomSlotId = "";
  }
}
