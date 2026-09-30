export const failure = (code, message) => ({ success: false, code, message });

const STATUS_CODES = new Map([
  [400, "VALIDATION_ERROR"],
  [401, "UNAUTHORIZED"],
  [403, "FORBIDDEN"],
  [404, "NOT_FOUND"],
  [422, "VALIDATION_ERROR"],
  [429, "RATE_LIMITED"],
]);

const DEFAULT_MESSAGES = {
  NETWORK_ERROR: "ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.",
  UNAUTHORIZED: "دسترسی شما معتبر نیست. لطفاً دوباره وارد شوید.",
  SERVER_ERROR: "خطایی در سرور رخ داد. لطفاً بعداً تلاش کنید.",
  HTTP_ERROR: "درخواست با خطا مواجه شد.",
};

const statusCode = (status) =>
  STATUS_CODES.get(status) || (status >= 500 ? "SERVER_ERROR" : "HTTP_ERROR");

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : "");

// Field-level validation errors as [{ field, message }]. Accepts ProblemDetails
// errors { "Identity.NationalId": ["..."] } and a list of { field|name|key, message }.
function readFieldErrors(errors) {
  if (Array.isArray(errors)) {
    return errors
      .map((item) => ({ field: text(item?.field || item?.name || item?.key), message: text(item?.message) }))
      .filter((item) => item.message);
  }
  if (!errors || typeof errors !== "object") return [];
  return Object.entries(errors).flatMap(([field, messages]) =>
    (Array.isArray(messages) ? messages : [messages]).map((message) => ({ field, message: text(message) })),
  ).filter((item) => item.message);
}

// Backend returns { success, code, message } at runtime while Swagger documents
// ProblemDetails { title, detail, status, errors }; both are accepted. The backend
// code always wins over the status-derived one, and the raw body is kept in details.
// Field messages are preferred over the generic ProblemDetails title.
export function httpFailure(status, body) {
  const data = body && typeof body === "object" ? body : null;
  const code = typeof data?.code === "string" && data.code ? data.code : statusCode(status);
  const fieldErrors = readFieldErrors(data?.errors);
  const message =
    text(data?.message) ||
    text(data?.detail) ||
    fieldErrors.map((item) => item.message).join("، ") ||
    text(data?.title) ||
    DEFAULT_MESSAGES[code] ||
    DEFAULT_MESSAGES.HTTP_ERROR;
  return { ...failure(code, message), status, details: data, fieldErrors };
}

export const networkFailure = () => ({
  ...failure("NETWORK_ERROR", DEFAULT_MESSAGES.NETWORK_ERROR),
  status: 0,
  details: null,
});
