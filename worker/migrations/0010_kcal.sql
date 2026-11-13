-- Label calories per 100 g, independent of macros (manufacturers' kcal often differs from 4·P + 9·F + 4·C).
-- NULL = compute from macros; existing rows stay NULL.
ALTER TABLE products ADD COLUMN kcal REAL;
ALTER TABLE diary_entries ADD COLUMN kcal REAL;
ALTER TABLE dishes ADD COLUMN kcal REAL;
