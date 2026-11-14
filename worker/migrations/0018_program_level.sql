-- Level of the ready-made program a user's copy was started from (0 новичок, 1 любитель, 2 продвинутый); NULL = own program.
ALTER TABLE programs ADD COLUMN level INTEGER;
