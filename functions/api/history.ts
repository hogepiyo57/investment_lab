import { getHistory } from "../../shared/db";
import { isValidHandleName } from "../../shared/validation";

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
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
