-- Account role: 'user' (everyone) or 'admin' (may change and delete any product of the shared library).
-- Admins are set by hand in the database, nothing in the app grants the role.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));
