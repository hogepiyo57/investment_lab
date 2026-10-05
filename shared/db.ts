export interface Student {
  handle_name: string;
  pin_hash: string;
  pin: string | null;
  created_at: string;
}

export interface EntryRow {
  id: number;
  handle_name: string;
  total_assets: number;
  unrealized_pl: number | null;
  created_at: string;
}

export async function getStudent(db: D1Database, handleName: string): Promise<Student | null> {
  const row = await db
    .prepare("SELECT handle_name, pin_hash, pin, created_at FROM students WHERE handle_name = ?")
    .bind(handleName)
    .first<Student>();
  return row ?? null;
}

export async function createStudent(
  db: D1Database,
  handleName: string,
  pinHash: string,
  pin: string,
  createdAt: string
): Promise<void> {
  await db
    .prepare("INSERT INTO students (handle_name, pin_hash, pin, created_at) VALUES (?, ?, ?, ?)")
    .bind(handleName, pinHash, pin, createdAt)
    .run();
}

export async function setPlainPin(db: D1Database, handleName: string, pin: string): Promise<void> {
  await db.prepare("UPDATE students SET pin = ? WHERE handle_name = ?").bind(pin, handleName).run();
}

export async function insertEntry(
  db: D1Database,
  handleName: string,
  totalAssets: number,
  unrealizedPl: number | null,
  createdAt: string
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO entries (handle_name, total_assets, unrealized_pl, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(handleName, totalAssets, unrealizedPl, createdAt)
    .run();
}

export interface RankingRow {
  handle_name: string;
  total_assets: number;
  unrealized_pl: number | null;
  created_at: string;
  rank: number;
}

// 教師が過去日付の記録を追加・修正できるため、「最新」は id ではなく日時で判定する
export async function getRanking(db: D1Database): Promise<RankingRow[]> {
  const { results } = await db
    .prepare(
      `SELECT handle_name, total_assets, unrealized_pl, created_at
       FROM (
         SELECT handle_name, total_assets, unrealized_pl, created_at,
                ROW_NUMBER() OVER (PARTITION BY handle_name ORDER BY created_at DESC, id DESC) AS rn
         FROM entries
       )
       WHERE rn = 1
       ORDER BY total_assets DESC`
    )
    .all<Omit<RankingRow, "rank">>();

  return (results ?? []).map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getHistory(db: D1Database, handleName: string): Promise<EntryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, handle_name, total_assets, unrealized_pl, created_at
       FROM entries WHERE handle_name = ? ORDER BY created_at ASC, id ASC`
    )
    .bind(handleName)
    .all<EntryRow>();
  return results ?? [];
}

export async function listStudents(db: D1Database): Promise<Omit<Student, "pin_hash">[]> {
  const { results } = await db
    .prepare("SELECT handle_name, pin, created_at FROM students ORDER BY created_at ASC")
    .all<Omit<Student, "pin_hash">>();
  return results ?? [];
}

export async function listAllEntries(db: D1Database): Promise<EntryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, handle_name, total_assets, unrealized_pl, created_at
       FROM entries ORDER BY created_at ASC, id ASC`
    )
    .all<EntryRow>();
  return results ?? [];
}

export async function renameStudent(
  db: D1Database,
  student: Student,
  newHandleName: string,
  pin: string,
  pinHash: string
): Promise<void> {
  // entries は students を外部キー参照しているため、新しい行を作ってから付け替え、旧行を消す
  await db.batch([
    db
      .prepare("INSERT INTO students (handle_name, pin_hash, pin, created_at) VALUES (?, ?, ?, ?)")
      .bind(newHandleName, pinHash, pin, student.created_at),
    db.prepare("UPDATE entries SET handle_name = ? WHERE handle_name = ?").bind(newHandleName, student.handle_name),
    db.prepare("DELETE FROM students WHERE handle_name = ?").bind(student.handle_name),
  ]);
}

export async function updatePin(db: D1Database, handleName: string, pin: string, pinHash: string): Promise<void> {
  await db
    .prepare("UPDATE students SET pin = ?, pin_hash = ? WHERE handle_name = ?")
    .bind(pin, pinHash, handleName)
    .run();
}

export async function deleteStudent(db: D1Database, handleName: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM entries WHERE handle_name = ?").bind(handleName),
    db.prepare("DELETE FROM students WHERE handle_name = ?").bind(handleName),
  ]);
}

export async function getEntry(db: D1Database, id: number): Promise<EntryRow | null> {
  const row = await db
    .prepare("SELECT id, handle_name, total_assets, unrealized_pl, created_at FROM entries WHERE id = ?")
    .bind(id)
    .first<EntryRow>();
  return row ?? null;
}

export async function updateEntry(
  db: D1Database,
  id: number,
  totalAssets: number,
  unrealizedPl: number | null,
  createdAt: string
): Promise<void> {
  await db
    .prepare("UPDATE entries SET total_assets = ?, unrealized_pl = ?, created_at = ? WHERE id = ?")
    .bind(totalAssets, unrealizedPl, createdAt, id)
    .run();
}

export async function deleteEntry(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
}
