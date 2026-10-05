import { ADMIN_COOKIE, readCookie, verifyAdminToken } from "../../../shared/auth";
import { json } from "../../../shared/http";

interface Env {
  ADMIN_PASSWORD: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const ok = await verifyAdminToken(readCookie(context.request, ADMIN_COOKIE), context.env.ADMIN_PASSWORD);
  return json({ ok });
};
