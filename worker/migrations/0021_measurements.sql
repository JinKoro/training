-- Body circumferences by date (cm). Weight and body fat live in profile_history; the API serves both as one history.
CREATE TABLE measurements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  metric  TEXT NOT NULL CHECK (metric IN ('neck','chest','shoulders','waist','belly','hips','thigh','calf','arm')),
  value   REAL NOT NULL,
  PRIMARY KEY (user_id, date, metric)
);
