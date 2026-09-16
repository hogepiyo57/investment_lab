CREATE TABLE IF NOT EXISTS students (
  handle_name TEXT PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle_name TEXT NOT NULL REFERENCES students(handle_name),
  total_assets REAL NOT NULL,
  unrealized_pl REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_handle_created
  ON entries (handle_name, created_at);
