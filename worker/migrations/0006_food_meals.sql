-- Which meals a food belongs to, as a bit mask: breakfast 1, lunch 2, dinner 4, snack 8 (15 = all).
-- Products are shared, so each user keeps their own tags; a missing row means all meals.
CREATE TABLE product_meals (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  meals      INTEGER NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

-- Dishes belong to one user, so the tags live on the dish.
ALTER TABLE dishes ADD COLUMN meals INTEGER NOT NULL DEFAULT 15;
