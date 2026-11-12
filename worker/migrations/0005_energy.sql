-- Body data for the calorie formula (kept as dated history like the rest of the profile).
ALTER TABLE profile_history ADD COLUMN sex TEXT CHECK (sex IN ('m','f'));
ALTER TABLE profile_history ADD COLUMN body_fat REAL;
ALTER TABLE profile_history ADD COLUMN training_mode TEXT CHECK (training_mode IN ('none','time','kcal'));
ALTER TABLE profile_history ADD COLUMN training_min INTEGER;
ALTER TABLE profile_history ADD COLUMN training_kcal INTEGER;

-- Training-day norms may be "not set" (NULL macros): such days use the rest-day norm.
CREATE TABLE nutrition_norms_new (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  day_type       TEXT NOT NULL CHECK (day_type IN ('training','rest')),
  protein_g      INTEGER,
  fat_g          INTEGER,
  carbs_g        INTEGER,
  PRIMARY KEY (user_id, effective_from, day_type)
);
INSERT INTO nutrition_norms_new SELECT user_id, effective_from, day_type, protein_g, fat_g, carbs_g FROM nutrition_norms;
DROP TABLE nutrition_norms;
ALTER TABLE nutrition_norms_new RENAME TO nutrition_norms;
