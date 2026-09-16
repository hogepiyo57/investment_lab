import { parseCookies, SESSION_COOKIE_NAME, verifySessionCookieValue } from "../../shared/auth";
import { getHistory } from "../../shared/db";
import { isValidHandleName } from "../../shared/validation";

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

  const url = new URL(context.request.url);
  const handleName = url.searchParams.get("handle")?.trim() ?? "";
  if (!isValidHandleName(handleName)) {
    return new Response(JSON.stringify({ ok: false, error: "ハンドルネームが不正です。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const history = await getHistory(context.env.DB, handleName);
  return new Response(JSON.stringify({ ok: true, history }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
