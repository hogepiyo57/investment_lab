import { getRanking } from "../../shared/db";

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const ranking = await getRanking(context.env.DB);
  return new Response(JSON.stringify({ ok: true, ranking }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
