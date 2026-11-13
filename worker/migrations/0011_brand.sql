-- Optional brand; the shown name is «brand · name». Imported products had the brand glued into the name: split it out.
ALTER TABLE products ADD COLUMN brand TEXT;
UPDATE products SET brand = substr(name, 1, instr(name, ' · ') - 1), name = substr(name, instr(name, ' · ') + 3)
  WHERE instr(name, ' · ') > 0 AND created_by IS NULL AND barcode IS NOT NULL;
