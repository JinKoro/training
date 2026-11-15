-- A dish ingredient can carry its own kcal/macros per 100 g (set in the dish form, «Свои ккал и БЖУ»):
-- they count only inside this dish; the product in the library stays as it is. NULL = the product's values.
ALTER TABLE dish_ingredients ADD COLUMN protein REAL;
ALTER TABLE dish_ingredients ADD COLUMN fat REAL;
ALTER TABLE dish_ingredients ADD COLUMN carbs REAL;
ALTER TABLE dish_ingredients ADD COLUMN kcal REAL;
