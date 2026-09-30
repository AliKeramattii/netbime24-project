/** Escape text before interpolating it into HTML templates or quoted attributes. */
export function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function safeHref(value) {
  try {
    const url = new URL(value, globalThis.location?.href || "https://invalid.local/");
    return ["http:", "https:"].includes(url.protocol) ? value : "#";
  } catch { return "#"; }
}

/** Clone a static HTML <template> so page copy and structure can live in HTML. */
export function cloneTemplate(id, ownerDocument = document) {
  const template = ownerDocument.getElementById(id);
  if (!(template instanceof HTMLTemplateElement)) {
    throw new Error(`Missing HTML template: #${id}`);
  }
  return template.content.cloneNode(true);
}

/** Replace a dynamic mount point with a cloned static HTML <template>. */
export function mountTemplate(container, id) {
  if (!(container instanceof Element)) throw new TypeError("mountTemplate requires a DOM Element.");
  container.replaceChildren(cloneTemplate(id, container.ownerDocument));
  return container;
}

/** Read static UI copy from HTML and interpolate explicit runtime placeholders. */
export function readTextTemplate(selector, ownerDocument = document, values = {}) {
  const source = ownerDocument.querySelector(selector);
  let text = source?.textContent?.trim() || "";
  for (const [key, value] of Object.entries(values)) {
    text = text.replaceAll(`{${key}}`, String(value ?? ""));
  }
  return text;
}
