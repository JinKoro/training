-- Food is per 100 g only: drop piece/portion sizes from products and logged entries (grams stay as they are).
UPDATE products SET portion_name = NULL, portion_g = NULL;
UPDATE diary_entries SET portions = NULL, portion_name = NULL, portion_g = NULL;
