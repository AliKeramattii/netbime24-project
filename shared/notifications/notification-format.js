import { formatRelativeTime } from "../i18n/fa-format.js";

export function formatNotificationTimestamp(value, now = new Date()) {
  return formatRelativeTime(value, now);
}
