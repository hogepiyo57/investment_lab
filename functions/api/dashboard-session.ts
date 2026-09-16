import { parseCookies, SESSION_COOKIE_NAME, verifySessionCookieValue } from "../../shared/auth";

interface Env {
  DASHBOARD_PASSWORD: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  const valid = await verifySessionCookieValue(
    cookies[SESSION_COOKIE_NAME],
    context.env.DASHBOARD_PASSWORD
  );
  return new Response(JSON.stringify({ ok: valid }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
