-- Failed sign-ins per e-mail and per IP within a 15-minute window (login rate limit).
CREATE TABLE login_attempts (
  key          TEXT PRIMARY KEY,   -- 'e:<email>' or 'ip:<address>'
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL    -- ms
);
