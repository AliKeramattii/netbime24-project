import { API_MODE, MOCK_APPOINTMENT_FLOW, MOCK_REGISTRATION_SUBMIT, MOCK_SESSION } from "./api/config.js";

// Lazy loading keeps development datasets out of real mode.
async function createRealApi() {
  let api = (await import("./api/real-api.js")).realApi;
  // TEMPORARY: steps whose backend endpoints are not usable yet run in the browser.
  if (MOCK_REGISTRATION_SUBMIT) {
    api = (await import("./api/temporary-registration.js")).withTemporaryRegistration(api);
  }
  if (MOCK_SESSION) {
    api = (await import("./api/temporary-session.js")).withTemporarySession(api);
  }
  if (MOCK_APPOINTMENT_FLOW) {
    api = (await import("./api/temporary-appointments.js")).withTemporaryAppointments(api);
  }
  return api;
}

export const api = API_MODE === "mock"
  ? (await import("./api/mock-api.js")).mockApi
  : await createRealApi();
