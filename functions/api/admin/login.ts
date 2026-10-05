import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminToken, passwordMatches } from "../../../shared/auth";
import { json, jsonError, readJson } from "../../../shared/http";

interface Env {
  ADMIN_PASSWORD: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await readJson<{ password?: unknown }>(context.request);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!(await passwordMatches(password, context.env.ADMIN_PASSWORD))) {
    return jsonError("パスワードが違います。", 401);
  }

  const token = await createAdminToken(context.env.ADMIN_PASSWORD);
  return json({ ok: true }, 200, {
    "Set-Cookie": `${ADMIN_COOKIE}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${ADMIN_SESSION_SECONDS}`,
  });
};
