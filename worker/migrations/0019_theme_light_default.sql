-- «Спорт» style: the light theme is the default. Accounts that never picked a theme ('system') move to light.
UPDATE users SET theme = 'light' WHERE theme = 'system';
