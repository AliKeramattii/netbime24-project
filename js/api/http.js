import { BROWSER_TOKEN, CROSS_ORIGIN_COOKIES, REQUEST_TIMEOUT_MS, apiUrl } from "./config.js";
import { issueAccessToken } from "./auth-token.js";
import { httpFailure, networkFailure } from "./errors.js";

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return null; }
}

// A browser blocks a cookie-carrying cross-origin request unless the backend answers with
// "Access-Control-Allow-Credentials: true" (checked 2026-09-30: it does not yet). The CORS
// preflight fails before anything reaches the backend, so such a request is retried once without
// cookies, and later requests on this page skip cookies. When the backend allows credentials,
// cookies work automatically (the next page load tries them again).
let cookiesBlocked = false;

async function send({ method, path, query, body }, useCookies) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (BROWSER_TOKEN) {
    const issued = await issueAccessToken();
    if (!issued.success) return issued;
    headers.Authorization = `Bearer ${issued.token}`;
  }

  let response;
  try {
    response = await fetch(apiUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: useCookies ? "include" : "same-origin",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Offline, blocked or timed out: retryable, never an endless wait.
    return { ...networkFailure(), timedOut: error?.name === "TimeoutError" };
  }

  const data = await readBody(response).catch(() => null);
  if (!response.ok || data?.success === false) return httpFailure(response.status, data);
  return { success: true, status: response.status, data };
}

// Shared transport for real-api.js. Resolves (never throws) to either
//   { success: true, status, data }
//   { success: false, code, message, status, details, fieldErrors }
// No retries except the cookie fallback above, and no refresh flow.
// BROWSER_TOKEN (direct mode): every call gets its own freshly issued Bearer token (single use).
// Proxy mode: the proxy adds the token and the browser sends none.
// withCredentials: send/accept the backend-managed session cookie (CROSS_ORIGIN_COOKIES). The
// browser handles the cookie; JavaScript never reads or copies it.
export async function apiRequest({ method = "GET", path, query, body, withCredentials = false }) {
  const request = { method, path, query, body };
  const useCookies = withCredentials && CROSS_ORIGIN_COOKIES && !cookiesBlocked;
  const result = await send(request, useCookies);
  if (useCookies && result.code === "NETWORK_ERROR" && !result.timedOut) {
    cookiesBlocked = true;
    return send(request, false);
  }
  return result;
}
