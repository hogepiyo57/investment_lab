export interface Student {
  handle_name: string;
  pin_hash: string;
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
    .prepare("SELECT handle_name, pin_hash, created_at FROM students WHERE handle_name = ?")
    .bind(handleName)
    .first<Student>();
  return row ?? null;
}

export async function createStudent(
  db: D1Database,
  handleName: string,
  pinHash: string,
  createdAt: string
): Promise<void> {
  await db
    .prepare("INSERT INTO students (handle_name, pin_hash, created_at) VALUES (?, ?, ?)")
    .bind(handleName, pinHash, createdAt)
    .run();
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

export async function getRanking(db: D1Database): Promise<RankingRow[]> {
  const { results } = await db
    .prepare(
      `SELECT e.handle_name as handle_name, e.total_assets as total_assets,
              e.unrealized_pl as unrealized_pl, e.created_at as created_at
       FROM entries e
       INNER JOIN (
         SELECT handle_name, MAX(id) as max_id FROM entries GROUP BY handle_name
       ) latest ON latest.max_id = e.id
       ORDER BY e.total_assets DESC`
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
