import { ADMIN_COOKIE } from "../../../shared/auth";
import { json } from "../../../shared/http";

export const onRequestPost: PagesFunction = async () => {
  return json({ ok: true }, 200, {
    "Set-Cookie": `${ADMIN_COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  });
};
