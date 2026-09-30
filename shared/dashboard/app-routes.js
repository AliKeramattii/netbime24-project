export const APP_ROUTES = Object.freeze({
  auth: new URL("../../index.html", import.meta.url).href,
  moarefe: new URL("../../pages/moarefe/moarefe.html", import.meta.url).href,
  interview: new URL("../../pages/interview/interview.html", import.meta.url).href,
});

export const RECRUITMENT_ROUTES = Object.freeze({
  registration: null,
  referral: null,
  moarefe: "moarefe",
  interview: "interview",
  documents: null,
  contract: null,
  completed: null,
});

export function resolveAppRoute(routeName) {
  if (typeof routeName !== "string" || !Object.hasOwn(APP_ROUTES, routeName)) return null;
  return APP_ROUTES[routeName];
}

export function resolveAppAction(action) {
  if (!action || typeof action !== "object") return null;
  return resolveAppRoute(action.route);
}

export function resolveRecruitmentStageRoute(stageId) {
  const routeName = RECRUITMENT_ROUTES[stageId];
  return routeName ? resolveAppRoute(routeName) : null;
}

export function resolveNotificationAction(notification) {
  const routeName = notification?.action?.route;
  return routeName ? resolveAppRoute(routeName) : null;
}
