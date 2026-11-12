-- Подход: initial schema. Dates are local calendar days 'YYYY-MM-DD'; timestamps are epoch ms.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  theme         TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  goal          TEXT NOT NULL DEFAULT 'keep' CHECK (goal IN ('lose','keep','gain')),
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Every profile change is kept with its date. NULL = not changed that day; current value = latest non-null.
CREATE TABLE profile_history (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  name          TEXT,
  weight_kg     REAL,
  height_cm     INTEGER,
  birth_date    TEXT,
  steps_per_day INTEGER,
  PRIMARY KEY (user_id, date)
);

-- Nutrition norms history; kcal is never stored (4P + 9F + 4C).
CREATE TABLE nutrition_norms (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  day_type       TEXT NOT NULL CHECK (day_type IN ('training','rest')),
  protein_g      INTEGER NOT NULL,
  fat_g          INTEGER NOT NULL,
  carbs_g        INTEGER NOT NULL,
  PRIMARY KEY (user_id, effective_from, day_type)
);

-- Exercise library: owner_id NULL = base library for everyone; otherwise visible only to the owner.
CREATE TABLE exercises (
  id          INTEGER PRIMARY KEY,
  owner_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'weight_reps' CHECK (type IN ('weight_reps','time')),
  kind        TEXT,                -- illustration key (bench, pulldown, …); NULL = letter tile
  group_key   TEXT,                -- filter group: legs, back, chest, shoulders, arms, abs
  subtitle    TEXT,
  primary_muscles   TEXT NOT NULL DEFAULT '[]',   -- JSON arrays of muscle keys
  secondary_muscles TEXT NOT NULL DEFAULT '[]',
  description TEXT,
  steps       TEXT NOT NULL DEFAULT '[]',   -- JSON array of technique steps
  rest_sec_default INTEGER NOT NULL DEFAULT 150,
  created_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);
CREATE INDEX exercises_owner ON exercises(owner_id);

-- Program = N weeks; plan JSON: { "<week>": { "<weekday 0..6>": [ {exerciseId, sets, reps:"10"|"10–12", kg:"60"|"60/65/65", rest, note} ] } }
CREATE TABLE programs (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  weekdays   TEXT NOT NULL DEFAULT '[]',   -- JSON array of weekday indexes 0..6 (Mon=0)
  weeks      INTEGER NOT NULL,
  start_date TEXT NOT NULL,                -- Monday of week 1
  is_active  INTEGER NOT NULL DEFAULT 0,
  plan       TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX programs_user ON programs(user_id);

CREATE TABLE workouts (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id   INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  program_week INTEGER,
  weekday      INTEGER,
  title        TEXT NOT NULL,
  date         TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('in_progress','finished')),
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER
);
CREATE INDEX workouts_user_date ON workouts(user_id, date);

CREATE TABLE workout_exercises (
  id           INTEGER PRIMARY KEY,
  workout_id   INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  exercise_id  INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,     -- snapshot
  kind         TEXT,
  muscles_text TEXT,
  type         TEXT NOT NULL DEFAULT 'weight_reps',
  rest_seconds INTEGER NOT NULL DEFAULT 120,
  skipped_at   INTEGER,
  UNIQUE (workout_id, position)
);

CREATE TABLE workout_sets (
  id                  INTEGER PRIMARY KEY,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_index           INTEGER NOT NULL,
  planned_weight      REAL,
  planned_reps        INTEGER NOT NULL,
  weight              REAL,
  reps                INTEGER,
  completed_at        INTEGER,
  UNIQUE (workout_exercise_id, set_index)
);

-- Food: products are shared by all users; dishes and diary entries belong to one user.
CREATE TABLE products (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  barcode      TEXT UNIQUE,
  protein      REAL NOT NULL,   -- per 100 g
  fat          REAL NOT NULL,
  carbs        REAL NOT NULL,
  portion_name TEXT,
  portion_g    REAL,
  icon         TEXT NOT NULL DEFAULT 'dish',
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX products_name ON products(name COLLATE NOCASE);

CREATE TABLE dishes (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  cooked_weight_g REAL NOT NULL,
  protein         REAL NOT NULL,   -- per 100 g cooked
  fat             REAL NOT NULL,
  carbs           REAL NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX dishes_user ON dishes(user_id);

CREATE TABLE dish_ingredients (
  dish_id    INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  grams      REAL NOT NULL,
  PRIMARY KEY (dish_id, position)
);

CREATE TABLE diary_entries (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  meal         TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','snack','dinner')),
  position     INTEGER NOT NULL DEFAULT 0,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  dish_id      INTEGER REFERENCES dishes(id) ON DELETE SET NULL,
  grams        REAL NOT NULL,
  portions     REAL,
  name         TEXT NOT NULL,      -- snapshot at logging time
  icon         TEXT NOT NULL,
  protein      REAL NOT NULL,      -- per 100 g snapshot
  fat          REAL NOT NULL,
  carbs        REAL NOT NULL,
  portion_name TEXT,
  portion_g    REAL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX diary_user_date ON diary_entries(user_id, date);
