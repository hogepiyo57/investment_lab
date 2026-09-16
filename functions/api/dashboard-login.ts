import { createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "../../shared/auth";

interface Env {
  DASHBOARD_PASSWORD: string;
}

interface LoginBody {
  password?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: LoginBody;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("リクエストの形式が正しくありません。", 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!context.env.DASHBOARD_PASSWORD) {
    return jsonError("サーバー側にダッシュボードパスワードが設定されていません。", 500);
  }
  if (password !== context.env.DASHBOARD_PASSWORD) {
    return jsonError("パスワードが違います。", 401);
  }

  const cookieValue = await createSessionCookieValue(context.env.DASHBOARD_PASSWORD);
  const cookie = `${SESSION_COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
