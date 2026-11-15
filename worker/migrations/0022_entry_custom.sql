-- A diary entry can carry its own kcal/macros per 100 g (a label can be wrong); the product stays as it is.
-- The flag tells the app the entry's numbers are the user's own, so «Свои ккал и БЖУ» opens filled in.
ALTER TABLE diary_entries ADD COLUMN custom INTEGER NOT NULL DEFAULT 0;
-- Entries logged with own values before the flag existed: their numbers differ from the product's.
UPDATE diary_entries SET custom = 1
WHERE product_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM products p WHERE p.id = diary_entries.product_id AND (
    p.protein != diary_entries.protein OR p.fat != diary_entries.fat OR p.carbs != diary_entries.carbs
    OR IFNULL(p.kcal, -1) != IFNULL(diary_entries.kcal, -1)));
