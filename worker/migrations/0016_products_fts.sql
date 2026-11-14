-- Full-text search over products (brand + name): the library is going to hold tens of thousands of products,
-- scanning them all on every keystroke is slow and burns the read quota. «ё» is stored as «е»; unicode61 folds case.
ALTER TABLE products ADD COLUMN source TEXT; -- 'off' = imported from Open Food Facts (searchable, not shown in the curated library tab)
CREATE VIRTUAL TABLE products_fts USING fts5(search, tokenize = 'unicode61');
INSERT INTO products_fts(rowid, search)
  SELECT id, replace(replace(coalesce(brand || ' ', '') || name, 'ё', 'е'), 'Ё', 'Е') FROM products;
CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, search) VALUES (new.id, replace(replace(coalesce(new.brand || ' ', '') || new.name, 'ё', 'е'), 'Ё', 'Е'));
END;
CREATE TRIGGER products_fts_au AFTER UPDATE OF name, brand ON products BEGIN
  DELETE FROM products_fts WHERE rowid = old.id;
  INSERT INTO products_fts(rowid, search) VALUES (new.id, replace(replace(coalesce(new.brand || ' ', '') || new.name, 'ё', 'е'), 'Ё', 'Е'));
END;
CREATE TRIGGER products_fts_ad AFTER DELETE ON products BEGIN
  DELETE FROM products_fts WHERE rowid = old.id;
END;
-- Products the scanner auto-added from Open Food Facts belong to the shared library, not to whoever scanned them.
UPDATE products SET created_by = NULL, source = 'off' WHERE brand LIKE '%Heinz%' AND name LIKE '%кетчуп%';
