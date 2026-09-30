import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
let checks = 0;
const failures = [];
const check = (name, condition, detail = "") => {
  checks += 1;
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};
const read = (relative) => fs.readFile(path.join(root, relative), "utf8");

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    has: (key) => items.has(key),
  };
}

globalThis.sessionStorage = memoryStorage();
globalThis.localStorage = memoryStorage();
let networkCalls = 0;
globalThis.fetch = async () => {
  networkCalls += 1;
  throw new Error("logout must not call the network");
};

const { STORAGE_KEYS } = await import("../js/storage-keys.js");
const { LOCAL_SESSION_KEYS, localLogout } = await import("../js/local-session.js");

const sessionKeys = [
  STORAGE_KEYS.temporarySession,
  STORAGE_KEYS.temporaryAppointments,
  STORAGE_KEYS.registration,
  STORAGE_KEYS.moarefe,
  STORAGE_KEYS.interview,
];
for (const key of sessionKeys) {
  check(`local session keys include ${key}`, LOCAL_SESSION_KEYS.includes(key));
  sessionStorage.setItem(key, "{}");
}
check("OTP limit is not a session key", !LOCAL_SESSION_KEYS.includes(STORAGE_KEYS.otpLimit));
localStorage.setItem(STORAGE_KEYS.otpLimit, "[]");
sessionStorage.setItem("unrelated.key", "kept");

const result = await localLogout();
check("local logout resolves success", result?.success === true);
for (const key of sessionKeys) {
  check(`local logout removes ${key}`, !sessionStorage.has(key));
}
check("local logout keeps the OTP send limit", localStorage.getItem(STORAGE_KEYS.otpLimit) === "[]");
check("local logout keeps unrelated keys", sessionStorage.getItem("unrelated.key") === "kept");
check("local logout makes no network request", networkCalls === 0);

const { CROSS_ORIGIN_COOKIES } = await import("../js/api/config.js");
const { withTemporarySession } = await import("../js/api/temporary-session.js");
let contextCalls = 0;
const sessionApi = withTemporarySession({
  getDashboardContext: async () => {
    contextCalls += 1;
    return { success: false, code: "NETWORK_ERROR", message: "" };
  },
  logout: localLogout,
});
sessionStorage.setItem(
  STORAGE_KEYS.temporarySession,
  JSON.stringify({ user: { id: "qa", firstName: "QA", mobile: "09120000000" } }),
);
const signedIn = await sessionApi.getDashboardContext();
check("dashboard shows the session user before logout", signedIn?.user?.firstName === "QA");
await sessionApi.logout();
const signedOut = await sessionApi.getDashboardContext();
check("dashboard context after logout has no previous user", !signedOut?.user);
if (!CROSS_ORIGIN_COOKIES) {
  check(
    "dashboard context after logout is signed out (login redirect) without a request",
    signedOut?.success === true && signedOut.authenticated === false && contextCalls === 0,
  );
}

globalThis.sessionStorage = {
  removeItem: () => { throw new Error("storage blocked"); },
};
check("local logout survives blocked storage", (await localLogout())?.success === true);

const [localSession, realApi, temporarySession, appShell, app, dashboardContext] = await Promise.all([
  read("js/local-session.js"),
  read("js/api/real-api.js"),
  read("js/api/temporary-session.js"),
  read("shared/dashboard/app-shell.js"),
  read("js/app.js"),
  read("shared/dashboard/dashboard-context.js"),
]);

check("local-session.js is marked TEMPORARY", localSession.includes("TEMPORARY"));
check(
  "local-session.js uses no API transport",
  !/apiRequest|fetch\(|XMLHttpRequest|localStorage/.test(localSession.replace(/^\/\/.*$/gm, "")),
);
check("real-api logout is the local logout", /logout:\s*localLogout/.test(realApi));
check("real-api logout is not unconfigured", !/logout:\s*unconfigured/.test(realApi));
check(
  "real-api local logout is marked TEMPORARY",
  /TEMPORARY[^\n]*\n\s*logout:\s*localLogout/.test(realApi),
);
check(
  "temporary session inherits the real-api logout",
  !/logout/.test(temporarySession.replace(/^\/\/.*$/gm, "")),
);

for (const [name, source] of [["dashboard shell", appShell], ["registration success menu", app]]) {
  check(`${name} clears the local session`, source.includes("clearLocalSession()"));
  check(`${name} invalidates the dashboard context`, source.includes("invalidateDashboardContext()"));
  check(
    `${name} leaves with location.replace to login`,
    /location\.replace\(APP_ROUTES\.auth\)/.test(source),
  );
}
check(
  "dashboard shell handles header and sidebar logout",
  /netbime:profile-action[\s\S]*?"logout"[\s\S]*?netbime:sidebar-action[\s\S]*?"logout"/.test(appShell),
);
check(
  "registration success menu handles logout",
  /netbime:profile-action[\s\S]*?"logout"/.test(app),
);

for (const page of ["moarefe", "interview"]) {
  const source = await read(`pages/${page}/${page}.js`);
  check(`${page} page checks the session before rendering`, source.includes("ensureDashboardAccess("));
}
check(
  "missing session redirects to login",
  /UNAUTHORIZED[\s\S]*?redirectToAuth\(\)/.test(dashboardContext) &&
    /authenticated === false \|\| !context\.user\)\s*\{\s*redirectToAuth\(\)/.test(dashboardContext),
);
check(
  "back-forward cache restores are re-checked",
  /pageshow[\s\S]*?event\.persisted[\s\S]*?reload\(\)/.test(dashboardContext),
);

if (failures.length) {
  console.error(`FAIL: ${failures.length}/${checks} local logout checks failed`);
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`PASS: ${checks} local logout checks.`);
