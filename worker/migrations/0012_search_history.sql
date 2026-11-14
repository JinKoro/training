-- Product search history per user: queries that led to opening a product, newest first (the app keeps 10).
CREATE TABLE search_history (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qkey TEXT NOT NULL,          -- lower-cased query (SQLite lower() is ASCII-only, so it is computed in the worker)
  query TEXT NOT NULL,         -- as typed, shown in the list
  used_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, qkey)
);
