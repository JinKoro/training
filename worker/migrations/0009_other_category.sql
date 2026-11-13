-- Products no keyword matched get the «Другое» category.
UPDATE products SET icon = 'other' WHERE icon IN ('oat', 'eggs', 'buckwheat', 'chicken', 'curd', 'salmon', 'dish');
UPDATE diary_entries SET icon = 'other' WHERE product_id IS NOT NULL AND icon IN ('oat', 'eggs', 'buckwheat', 'chicken', 'curd', 'salmon', 'dish');
