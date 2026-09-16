import { parseCookies, SESSION_COOKIE_NAME, verifySessionCookieValue } from "../../shared/auth";
import { getRanking } from "../../shared/db";

interface Env {
  DB: D1Database;
  DASHBOARD_PASSWORD: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cookies = parseCookies(context.request.headers.get("Cookie"));
  const valid = await verifySessionCookieValue(
    cookies[SESSION_COOKIE_NAME],
    context.env.DASHBOARD_PASSWORD
  );
  if (!valid) {
    return new Response(JSON.stringify({ ok: false, error: "認証が必要です。" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ranking = await getRanking(context.env.DB);
  return new Response(JSON.stringify({ ok: true, ranking }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
