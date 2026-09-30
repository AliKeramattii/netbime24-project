// Bearer tokens for DIRECT MODE (config: BROWSER_TOKEN). In proxy mode this file is not used.
// Swagger: POST /api/auth/token { privateKey } -> { token, expiresInSeconds }.
// The backend accepts each token for exactly ONE request, so a fresh token is issued for every
// call. Tokens are never cached, stored (no sessionStorage/localStorage) or logged.
import { REQUEST_TIMEOUT_MS, apiUrl } from "./config.js";
import { failure, httpFailure, networkFailure } from "./errors.js";

const TOKEN_UNAVAILABLE = "اتصال امن با سرور برقرار نشد. لطفاً دوباره تلاش کنید.";

async function loadPrivateKey() {
  try {
    const { API_PRIVATE_KEY } = await import("./private-key.js");
    return typeof API_PRIVATE_KEY === "string" && API_PRIVATE_KEY.trim() ? API_PRIVATE_KEY.trim() : null;
  } catch {
    return null;
  }
}

// Resolves to { success: true, token } or a normalized failure; never throws.
export async function issueAccessToken() {
  const privateKey = await loadPrivateKey();
  if (!privateKey) return failure("AUTH_TOKEN_UNAVAILABLE", TOKEN_UNAVAILABLE);

  let response;
  try {
    response = await fetch(apiUrl("/auth/token"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ privateKey }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return networkFailure();
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) return httpFailure(response.status, data);
  const token = typeof data?.token === "string" ? data.token.trim() : "";
  return token ? { success: true, token } : failure("AUTH_TOKEN_UNAVAILABLE", TOKEN_UNAVAILABLE);
}
