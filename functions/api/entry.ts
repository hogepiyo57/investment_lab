import { hashPin, verifyPin } from "../../shared/auth";
import { createStudent, getStudent, getRanking, insertEntry } from "../../shared/db";
import { isValidAmount, isValidHandleName, isValidOptionalAmount, isValidPin } from "../../shared/validation";

interface Env {
  DB: D1Database;
}

interface EntryBody {
  handleName?: unknown;
  pin?: unknown;
  totalAssets?: unknown;
  unrealizedPl?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: EntryBody;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("リクエストの形式が正しくありません。", 400);
  }

  const handleName = typeof body.handleName === "string" ? body.handleName.trim() : "";
  const { pin, totalAssets, unrealizedPl } = body;

  if (!isValidHandleName(handleName)) {
    return jsonError("ハンドルネームは1〜20文字で入力してください。", 400);
  }
  if (!isValidPin(pin)) {
    return jsonError("PINは4桁の数字で入力してください。", 400);
  }
  if (!isValidAmount(totalAssets)) {
    return jsonError("総資産は数値で入力してください。", 400);
  }
  if (!isValidOptionalAmount(unrealizedPl)) {
    return jsonError("含み益・含み損は数値で入力してください。", 400);
  }

  const db = context.env.DB;
  const now = new Date().toISOString();
  const existing = await getStudent(db, handleName);

  if (existing) {
    const pinOk = await verifyPin(handleName, pin as string, existing.pin_hash);
    if (!pinOk) {
      return jsonError("ハンドルネームまたはPINが違います。", 401);
    }
  } else {
    const pinHash = await hashPin(handleName, pin as string);
    await createStudent(db, handleName, pinHash, now);
  }

  await insertEntry(
    db,
    handleName,
    totalAssets as number,
    (unrealizedPl as number | null | undefined) ?? null,
    now
  );

  const ranking = await getRanking(db);
  const myRank = ranking.find((r) => r.handle_name === handleName)?.rank ?? null;

  return new Response(
    JSON.stringify({ ok: true, isNewStudent: !existing, rank: myRank, totalStudents: ranking.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
