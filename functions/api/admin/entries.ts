import { deleteEntry, getEntry, getStudent, insertEntry, updateEntry } from "../../../shared/db";
import { json, jsonError, readJson } from "../../../shared/http";
import { isValidAmount, isValidOptionalAmount, toIsoDate } from "../../../shared/validation";

interface Env {
  DB: D1Database;
}

interface EntryBody {
  id?: unknown;
  handleName?: unknown;
  totalAssets?: unknown;
  unrealizedPl?: unknown;
  createdAt?: unknown;
}

function validateAmounts(body: EntryBody | null): Response | null {
  if (!isValidAmount(body?.totalAssets)) return jsonError("総資産は数値で入力してください。", 400);
  if (!isValidOptionalAmount(body?.unrealizedPl)) return jsonError("含み損益は数値で入力してください。", 400);
  return null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await readJson<EntryBody>(context.request);
  const handleName = typeof body?.handleName === "string" ? body.handleName : "";
  if (!(await getStudent(context.env.DB, handleName))) return jsonError("生徒が見つかりません。", 404);

  const invalid = validateAmounts(body);
  if (invalid) return invalid;
  const createdAt = toIsoDate(body?.createdAt) ?? new Date().toISOString();

  await insertEntry(context.env.DB, handleName, body!.totalAssets as number, (body!.unrealizedPl as number | null) ?? null, createdAt);
  return json({ ok: true });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const body = await readJson<EntryBody>(context.request);
  const id = Number(body?.id);
  const entry = Number.isInteger(id) ? await getEntry(context.env.DB, id) : null;
  if (!entry) return jsonError("記録が見つかりません。", 404);

  const invalid = validateAmounts(body);
  if (invalid) return invalid;
  const createdAt = toIsoDate(body?.createdAt);
  if (!createdAt) return jsonError("日時が正しくありません。", 400);

  await updateEntry(context.env.DB, id, body!.totalAssets as number, (body!.unrealizedPl as number | null) ?? null, createdAt);
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const body = await readJson<EntryBody>(context.request);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || !(await getEntry(context.env.DB, id))) return jsonError("記録が見つかりません。", 404);

  await deleteEntry(context.env.DB, id);
  return json({ ok: true });
};
