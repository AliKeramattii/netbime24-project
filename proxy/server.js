// NetBime24 backend proxy (BFF).
//
// The browser only ever talks to this server:
//   /api/*      -> forwarded to the backend with a server-side Bearer token
//   other paths -> the frontend files (allow-listed; can be disabled with STATIC_ROOT="")
//
// The privateKey lives only in the environment (NETBIME_PRIVATE_KEY, or a git-ignored proxy/.env).
// The backend accepts each token for exactly one request, so a fresh token is issued per call.
// Tokens and the key are never sent to the browser and never logged.
// Logs contain method, path and status only — never headers, bodies, cookies or tokens.
import http from "node:http";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROXY_DIR = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(PROXY_DIR, ".env"));

const PRIVATE_KEY = (process.env.NETBIME_PRIVATE_KEY || "").trim();
const BACKEND_URL = (process.env.BACKEND_URL || "https://api.ramatest.ir").replace(/\/+$/, "");
const HOST = process.env.HOST || "127.0.0.1";
// A number (standalone) or a named pipe path (IIS/iisnode on Plesk Windows sets PORT to a pipe).
const PORT = process.env.PORT || "5510";
const STATIC_ROOT = process.env.STATIC_ROOT === undefined
  ? path.resolve(PROXY_DIR, "..")
  : process.env.STATIC_ROOT && path.resolve(PROXY_DIR, process.env.STATIC_ROOT);
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 15000;
const MAX_BODY_BYTES = 1024 * 1024;

if (!PRIVATE_KEY) {
  console.error("NETBIME_PRIVATE_KEY is not set (environment or proxy/.env). Refusing to start.");
  process.exit(1);
}

// Minimal .env loader (KEY=VALUE lines); real environment variables take precedence.
function loadEnvFile(file) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith("#")) continue;
    const value = match[2].replace(/^(["'])(.*)\1$/, "$2");
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

// ---------- API proxy ----------

const FORWARDED_REQUEST_HEADERS = ["accept", "content-type", "cookie", "accept-language"];
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control", "www-authenticate", "retry-after"];

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
  return status;
}

async function issueBackendToken() {
  const response = await fetch(`${BACKEND_URL}/api/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ privateKey: PRIVATE_KEY }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.token !== "string" || !data.token) {
    throw new Error(`token request failed with status ${response.status}`);
  }
  return data.token;
}

// TLS here, or HTTPS terminated in front: X-Forwarded-Proto (Nginx/ARR) or x-iisnode-https
// (iisnode with promoteServerVars="HTTPS").
const isHttpsRequest = (request) =>
  Boolean(request.socket.encrypted) ||
  String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https" ||
  String(request.headers["x-iisnode-https"] || "").toLowerCase() === "on";

// The backend cookie must belong to this host. On plain http (local development) Secure cookies
// would be dropped by the browser, so Secure and SameSite=None are relaxed there only.
function rewriteSetCookie(cookie, https) {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => !/^domain=/i.test(part) && (https || !/^secure$/i.test(part)))
    .map((part) => (!https && /^samesite=none$/i.test(part) ? "SameSite=Lax" : part))
    .join("; ");
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("body too large"), { status: 413 });
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyApi(request, response, url) {
  // The token endpoint is server-side only.
  if (url.pathname === "/api/auth/token" || url.pathname.startsWith("/api/auth/token/")) {
    return sendJson(response, 404, { success: false, code: "NOT_FOUND", message: "Not found" });
  }

  let body;
  try {
    body = ["GET", "HEAD"].includes(request.method) ? undefined : await readRequestBody(request);
  } catch (error) {
    return sendJson(response, error.status || 400, { success: false, code: "BAD_REQUEST", message: "Invalid request body" });
  }

  let token;
  try {
    token = await issueBackendToken();
  } catch {
    return sendJson(response, 502, {
      success: false,
      code: "AUTH_TOKEN_UNAVAILABLE",
      message: "اتصال امن با سرور برقرار نشد. لطفاً دوباره تلاش کنید.",
    });
  }

  const headers = { authorization: `Bearer ${token}` };
  for (const name of FORWARDED_REQUEST_HEADERS) {
    if (request.headers[name]) headers[name] = request.headers[name];
  }

  let upstream;
  try {
    upstream = await fetch(`${BACKEND_URL}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError";
    return sendJson(response, timedOut ? 504 : 502, {
      success: false,
      code: timedOut ? "GATEWAY_TIMEOUT" : "BAD_GATEWAY",
      message: "ارتباط با سرور برقرار نشد. لطفاً بعداً تلاش کنید.",
    });
  }

  const outHeaders = {};
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) outHeaders[name] = value;
  }
  const cookies = upstream.headers.getSetCookie?.() || [];
  if (cookies.length) {
    const https = isHttpsRequest(request);
    outHeaders["set-cookie"] = cookies.map((cookie) => rewriteSetCookie(cookie, https));
  }
  response.writeHead(upstream.status, outHeaders);
  response.end(Buffer.from(await upstream.arrayBuffer()));
  return upstream.status;
}

// ---------- Static frontend ----------

// Only the runtime frontend is served; everything else (proxy/, docs, design/, qa/, dotfiles) is not.
const PUBLIC_FILES = new Set(["index.html"]);
const PUBLIC_DIRS = ["assets/", "css/", "js/", "pages/", "shared/"];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
const CODE_TYPES = new Set([".html", ".js", ".css", ".json"]);

async function serveStatic(response, url) {
  let relative;
  try {
    relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    return sendJson(response, 400, { success: false, code: "BAD_REQUEST", message: "Bad path" });
  }
  if (relative === "" || relative.endsWith("/")) relative += "index.html";
  const allowed =
    !relative.split("/").some((part) => part.startsWith(".") || part === "") &&
    (PUBLIC_FILES.has(relative) || PUBLIC_DIRS.some((dir) => relative.startsWith(dir)));
  const file = path.resolve(STATIC_ROOT, relative);
  if (!allowed || !file.startsWith(STATIC_ROOT + path.sep)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    return 404;
  }
  let content;
  try {
    content = await fs.readFile(file);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    return 404;
  }
  const extension = path.extname(file).toLowerCase();
  response.writeHead(200, {
    "content-type": TYPES[extension] || "application/octet-stream",
    // Code files are not versioned: always revalidate. Images and fonts may be cached.
    "cache-control": CODE_TYPES.has(extension) ? "no-cache" : "public, max-age=604800",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
  response.end(content);
  return 200;
}

// ---------- Server ----------

http
  .createServer(async (request, response) => {
    let url;
    try {
      url = new URL(request.url, "http://proxy.local");
    } catch {
      response.writeHead(400).end();
      return;
    }
    let status;
    try {
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) status = await proxyApi(request, response, url);
      else if (STATIC_ROOT) status = await serveStatic(response, url);
      else status = sendJson(response, 404, { success: false, code: "NOT_FOUND", message: "Not found" });
    } catch {
      status = response.headersSent ? 500 : sendJson(response, 500, { success: false, code: "PROXY_ERROR", message: "Proxy error" });
    }
    console.log(`${request.method} ${url.pathname} ${status}`);
  })
  .listen(...(/^\d+$/.test(String(PORT)) ? [Number(PORT), HOST] : [PORT]), () => {
    const address = /^\d+$/.test(String(PORT)) ? `http://${HOST}:${PORT}` : "iisnode pipe";
    console.log(`NetBime24 proxy: ${address}  (/api/* -> ${BACKEND_URL}${STATIC_ROOT ? ", static files on" : ", API only"})`);
  });
