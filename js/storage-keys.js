// Existing keys are retained so cleanup does not invalidate current sessions.
export const STORAGE_KEYS = Object.freeze({
  registration: "netbime.registration.v1",
  moarefe: "netbime.moarefe.v1",
  interview: "netbime.interview.v1",
  mockServerPrefix: "netbime.mock.server.",
  otpLimit: "netbime.otp-limit.v1",
  temporaryAppointments: "netbime.temp-appointments.v1",
  temporarySession: "netbime.temp-session.v1",
});
