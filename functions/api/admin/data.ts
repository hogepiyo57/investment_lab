import { listAllEntries, listStudents } from "../../../shared/db";
import { json } from "../../../shared/http";

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const [students, entries] = await Promise.all([listStudents(context.env.DB), listAllEntries(context.env.DB)]);
  return json({ ok: true, students, entries });
};
