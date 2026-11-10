import { studentPinMatches } from "../../shared/auth";
import { getStudent } from "../../shared/db";
import { json, jsonError, readJson } from "../../shared/http";
import { isValidHandleName, isValidPin } from "../../shared/validation";

interface Env {
  DB: D1Database;
}

interface VerifyBody {
  handleName?: unknown;
  pin?: unknown;
}

// 入力フォームの1画面目: ハンドルネームとPINを確かめる。新しい生徒の登録は報告の送信時に行う
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await readJson<VerifyBody>(context.request);
  if (!body) return jsonError("リクエストの形式が正しくありません。", 400);

  const handleName = typeof body.handleName === "string" ? body.handleName.trim() : "";
  const { pin } = body;

  if (!isValidHandleName(handleName)) {
    return jsonError("ハンドルネームは1〜20文字で入力してください。", 400);
  }
  if (!isValidPin(pin)) {
    return jsonError("PINは4桁の数字で入力してください。", 400);
  }

  const existing = await getStudent(context.env.DB, handleName);
  if (existing && !(await studentPinMatches(existing, handleName, pin))) {
    return jsonError("ハンドルネームまたはPINが違います。", 401);
  }

  return json({ ok: true, handleName, isNewStudent: !existing });
};
