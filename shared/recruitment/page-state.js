/** Persist only UI drafts; recruitment is replaced by each authoritative API response. */
export function createRecruitmentPageState(storageKey) {
  const initial = () => ({
    view: "process", recruitment: {}, request: {},
    scheduling: { selectedSlotId: "", customAppointment: null, termsAccepted: false },
  });
  const state = initial();
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (["process", "scheduling"].includes(saved?.view)) state.view = saved.view;
    if (typeof saved?.scheduling?.selectedSlotId === "string") state.scheduling.selectedSlotId = saved.scheduling.selectedSlotId;
    const cached = saved?.scheduling?.customAppointment;
    state.scheduling.customAppointment = cached && typeof cached === "object" ? cached : null;
    state.scheduling.termsAccepted = saved?.scheduling?.termsAccepted === true;
  } catch { /* Invalid or unavailable storage must not prevent rendering. */ }
  function save() {
    const { view, scheduling } = state;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ view, scheduling })); } catch { /* Keep the live draft. */ }
  }
  function reset() { Object.assign(state, initial()); save(); }
  return { state, save, reset };
}
