import { hashPin, timingSafeEqual, verifyPin } from "../../shared/auth";
import { createStudent, getRanking, getStudent, insertEntry, setPlainPin } from "../../shared/db";
import { json, jsonError, readJson } from "../../shared/http";
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
  const body = await readJson<EntryBody>(context.request);
  if (!body) return jsonError("リクエストの形式が正しくありません。", 400);

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
    const pinOk = existing.pin
      ? timingSafeEqual(pin, existing.pin)
      : await verifyPin(handleName, pin, existing.pin_hash);
    if (!pinOk) {
      return jsonError("ハンドルネームまたはPINが違います。", 401);
    }
    // PIN列追加前に登録した生徒は、正しいPINで報告した時点で平文を記録する
    if (!existing.pin) await setPlainPin(db, handleName, pin);
  } else {
    await createStudent(db, handleName, await hashPin(handleName, pin), pin, now);
  }

  await insertEntry(db, handleName, totalAssets, unrealizedPl ?? null, now);

  const ranking = await getRanking(db);
  const myRank = ranking.find((r) => r.handle_name === handleName)?.rank ?? null;

  return json({ ok: true, isNewStudent: !existing, rank: myRank, totalStudents: ranking.length });
};
