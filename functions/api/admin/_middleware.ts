import { ADMIN_COOKIE, readCookie, verifyAdminToken } from "../../../shared/auth";
import { jsonError } from "../../../shared/http";

interface Env {
  ADMIN_PASSWORD: string;
}

const PUBLIC_PATHS = new Set(["/api/admin/login", "/api/admin/session"]);

export const onRequest: PagesFunction<Env> = async (context) => {
  if (!context.env.ADMIN_PASSWORD) {
    return jsonError("サーバーに管理者パスワード(ADMIN_PASSWORD)が設定されていません。", 500);
  }
  const path = new URL(context.request.url).pathname;
  if (PUBLIC_PATHS.has(path)) return context.next();

  const ok = await verifyAdminToken(readCookie(context.request, ADMIN_COOKIE), context.env.ADMIN_PASSWORD);
  if (!ok) return jsonError("ログインが必要です。", 401);
  return context.next();
};
