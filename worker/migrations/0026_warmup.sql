-- Warmup, cool-down and stretching: three timed base exercises in their own group «Разминка» (group_key warmup).
-- The steps are a short pool of moves to fill the time with, not a fixed routine. No rest after them.
INSERT INTO exercises (owner_id,name,type,kind,group_key,subtitle,primary_muscles,secondary_muscles,description,steps,rest_sec_default,created_at)
SELECT NULL,'Разминка','time','warmup','warmup','Суставы и лёгкое кардио','[]','[]',
  'Разогреть тело перед весами: 10 минут, движения на выбор.',
  '["Лёгкое кардио: дорожка, велосипед или скакалка — 5 мин.", "Вращения: шея, плечи, локти, кисти — 1 мин.", "Вращения: таз, колени, голеностопы — 1 мин.", "Приседания без веса, выпады, наклоны — 1–2 мин.", "Первое упражнение дня с пустым грифом или лёгким весом — 1–2 подхода."]',
  0,1795000000000
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE owner_id IS NULL AND lower(name)=lower('Разминка'));
INSERT INTO exercises (owner_id,name,type,kind,group_key,subtitle,primary_muscles,secondary_muscles,description,steps,rest_sec_default,created_at)
SELECT NULL,'Заминка','time','walk','warmup','Спокойно после тренировки','[]','[]',
  'Успокоить пульс и дыхание после тренировки: 5 минут.',
  '["Спокойная ходьба или велосипед, пульс успокаивается — 3–5 мин.", "Глубокое ровное дыхание — 1 мин."]',
  0,1795000000000
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE owner_id IS NULL AND lower(name)=lower('Заминка'));
INSERT INTO exercises (owner_id,name,type,kind,group_key,subtitle,primary_muscles,secondary_muscles,description,steps,rest_sec_default,created_at)
SELECT NULL,'Растяжка','time','stretch','warmup','Мышцы после нагрузки','["hamstrings"]','["quads", "glutes", "chest", "lats"]',
  'Растянуть мышцы после тренировки: 10 минут, каждое положение спокойно, без рывков.',
  '["Задняя поверхность бедра: наклон к прямым ногам — 30–40 с.", "Квадрицепс: стоя, пятку к ягодице — 30–40 с на ногу.", "Ягодицы: «голубь» или лёжа нога на колено — 30–40 с на ногу.", "Грудь и плечи: руки в проёме двери — 30–40 с.", "Спина: «кошка-корова», вис на перекладине — 1 мин."]',
  0,1795000000000
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE owner_id IS NULL AND lower(name)=lower('Растяжка'));
