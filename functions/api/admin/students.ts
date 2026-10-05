import { hashPin } from "../../../shared/auth";
import { createStudent, deleteStudent, getStudent, renameStudent, updatePin } from "../../../shared/db";
import { json, jsonError, readJson } from "../../../shared/http";
import { isValidHandleName, isValidPin } from "../../../shared/validation";

interface Env {
  DB: D1Database;
}

interface StudentBody {
  handleName?: unknown;
  newHandleName?: unknown;
  pin?: unknown;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await readJson<StudentBody>(context.request);
  const handleName = trimmed(body?.handleName);
  const pin = body?.pin;

  if (!isValidHandleName(handleName)) return jsonError("ハンドルネームは1〜20文字で入力してください。", 400);
  if (!isValidPin(pin)) return jsonError("PINは4桁の数字で入力してください。", 400);
  if (await getStudent(context.env.DB, handleName)) return jsonError("そのハンドルネームは既に使われています。", 409);

  await createStudent(context.env.DB, handleName, await hashPin(handleName, pin), pin, new Date().toISOString());
  return json({ ok: true });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const body = await readJson<StudentBody>(context.request);
  const handleName = trimmed(body?.handleName);
  const newHandleName = trimmed(body?.newHandleName) || handleName;
  const pinInput = body?.pin;

  const student = await getStudent(db, handleName);
  if (!student) return jsonError("生徒が見つかりません。", 404);
  if (!isValidHandleName(newHandleName)) return jsonError("ハンドルネームは1〜20文字で入力してください。", 400);
  if (pinInput !== undefined && pinInput !== "" && !isValidPin(pinInput)) {
    return jsonError("PINは4桁の数字で入力してください。", 400);
  }

  const pin = isValidPin(pinInput) ? pinInput : student.pin;

  if (newHandleName !== handleName) {
    if (await getStudent(db, newHandleName)) return jsonError("そのハンドルネームは既に使われています。", 409);
    // PINのハッシュはハンドルネームを含むため、改名時は平文PINから作り直す必要がある
    if (!pin) return jsonError("この生徒はPINが未確認です。改名と同時に新しいPINを設定してください。", 400);
    await renameStudent(db, student, newHandleName, pin, await hashPin(newHandleName, pin));
  } else if (pin && pin !== student.pin) {
    await updatePin(db, handleName, pin, await hashPin(handleName, pin));
  }

  return json({ ok: true, handleName: newHandleName });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const body = await readJson<StudentBody>(context.request);
  const handleName = trimmed(body?.handleName);
  if (!(await getStudent(context.env.DB, handleName))) return jsonError("生徒が見つかりません。", 404);

  await deleteStudent(context.env.DB, handleName);
  return json({ ok: true });
};
