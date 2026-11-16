-- Sessions moved to other days of one program week: {"<week>": [slot weekday or null for each day Mon..Sun]}.
ALTER TABLE programs ADD COLUMN moves TEXT NOT NULL DEFAULT '{}';
