-- Default rest of every base exercise is 3 minutes (user, 2026-11-14). Own exercises keep their own default.
UPDATE exercises SET rest_sec_default = 180 WHERE owner_id IS NULL;
