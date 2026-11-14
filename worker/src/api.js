import { fail, json, readJson } from './http.js';
import {
  createSession, deleteOtherSessions, deleteSession, hashPassword, requireUser, verifyPassword,
} from './auth.js';
import { EMAIL_RE, arr, day, isDay, macros, num, oneOf, str } from './validate.js';
import { SUB_IDS, SUB_NAMES, guessSub } from './categories.js';

const MEALS = ['breakfast', 'lunch', 'snack', 'dinner'];
const FOOD_ICONS = ['oat', 'eggs', 'buckwheat', 'chicken', 'curd', 'salmon', 'dish', ...SUB_IDS];
const MUSCLES = ['chest', 'shoulders', 'biceps', 'forearms', 'abs', 'quads', 'calves', 'traps', 'reardelts', 'lats', 'triceps', 'lowerback', 'glutes', 'hamstrings'];
const GROUPS = ['legs', 'back', 'chest', 'shoulders', 'arms', 'abs', 'cardio'];

const parse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

/** Monday of the week that contains `d` (YYYY-MM-DD). */
function mondayOf(d) {
  const [y, m, dd] = d.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, dd));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

// ---------- profile ----------

async function currentProfile(env, userId) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM profile_history WHERE user_id = ? ORDER BY date ASC',
  ).bind(userId).all();
  const p = { name: null, weight: null, height: null, birthDate: null, steps: null, sex: null, bodyFat: null, trainingMode: null, trainingMin: null, trainingKcal: null };
  for (const r of results) {
    for (const [col, key] of EXTRA) if (r[col] !== null && r[col] !== undefined) p[key] = r[col];
    if (r.name !== null) p.name = r.name;
    if (r.weight_kg !== null) p.weight = r.weight_kg;
    if (r.height_cm !== null) p.height = r.height_cm;
    if (r.birth_date !== null) p.birthDate = r.birth_date;
    if (r.steps_per_day !== null) p.steps = r.steps_per_day;
  }
  return p;
}

async function normsHistory(env, userId) {
  const { results } = await env.DB.prepare(
    'SELECT effective_from, day_type, protein_g, fat_g, carbs_g FROM nutrition_norms WHERE user_id = ? ORDER BY effective_from',
  ).bind(userId).all();
  return results.map((r) => ({ from: r.effective_from, type: r.day_type, macros: r.protein_g === null ? null : [r.protein_g, r.fat_g, r.carbs_g] }));
}

function profileFields(body, { partial }) {
  const out = {};
  const want = (k) => !partial || body[k] !== undefined;
  if (want('name')) out.name = str(body.name, 'name', { min: 1, max: 100 });
  if (want('weight')) out.weight_kg = num(body.weight, 'weight', { min: 30, max: 300 });
  if (want('height')) out.height_cm = num(body.height, 'height', { min: 100, max: 300 });
  if (want('birthDate')) {
    const b = day(body.birthDate, 'birthDate');
    const today = new Date().toISOString().slice(0, 10);
    if (b > today) fail(400, 'invalid_date', 'birthDate');
    out.birth_date = b;
  }
  if (want('steps')) out.steps_per_day = num(body.steps, 'steps', { min: 0, max: 150000, int: true });
  // Calorie-formula inputs are optional everywhere (older accounts have none).
  if (body.sex !== undefined) out.sex = oneOf(body.sex, 'sex', ['m', 'f']);
  if (body.bodyFat !== undefined) out.body_fat = num(body.bodyFat, 'bodyFat', { min: 3, max: 60 });
  if (body.trainingMode !== undefined) out.training_mode = oneOf(body.trainingMode, 'trainingMode', ['none', 'time', 'kcal']);
  if (body.trainingMin !== undefined) out.training_min = num(body.trainingMin, 'trainingMin', { min: 10, max: 300, int: true, optional: true });
  if (body.trainingKcal !== undefined) out.training_kcal = num(body.trainingKcal, 'trainingKcal', { min: 0, max: 3000, int: true, optional: true });
  return out;
}

async function writeProfile(env, userId, date, fields) {
  const cols = Object.keys(fields);
  if (!cols.length) return;
  const existing = await env.DB.prepare('SELECT 1 FROM profile_history WHERE user_id = ? AND date = ?').bind(userId, date).first();
  if (existing) {
    await env.DB.prepare(`UPDATE profile_history SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE user_id = ? AND date = ?`)
      .bind(...cols.map((c) => fields[c]), userId, date).run();
  } else {
    await env.DB.prepare(`INSERT INTO profile_history (user_id, date, ${cols.join(', ')}) VALUES (?, ?, ${cols.map(() => '?').join(', ')})`)
      .bind(userId, date, ...cols.map((c) => fields[c])).run();
  }
}

const EXTRA = [['sex', 'sex'], ['body_fat', 'bodyFat'], ['training_mode', 'trainingMode'], ['training_min', 'trainingMin'], ['training_kcal', 'trainingKcal']];

/** Training-day norms may be null ("not set"): those days then use the rest-day norm. */
const readNorms = (n, field) => ({ training: n?.training === null ? null : macros(n?.training, field), rest: macros(n?.rest, field) });

function normStatements(env, userId, date, norms) {
  return ['training', 'rest'].map((t) => env.DB.prepare(
    `INSERT INTO nutrition_norms (user_id, effective_from, day_type, protein_g, fat_g, carbs_g) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, effective_from, day_type) DO UPDATE SET protein_g = excluded.protein_g, fat_g = excluded.fat_g, carbs_g = excluded.carbs_g`,
  ).bind(userId, date, t, ...(norms[t] ?? [null, null, null])));
}

async function me(env, user) {
  return {
    user: { id: user.id, email: user.email, theme: user.theme, goal: user.goal, createdAt: user.created_at },
    profile: await currentProfile(env, user.id),
    norms: await normsHistory(env, user.id),
  };
}

// ---------- exercises ----------

const exerciseOut = (r) => ({
  id: r.id, own: r.owner_id !== null, name: r.name, type: r.type, kind: r.kind, group: r.group_key,
  subtitle: r.subtitle, primary: parse(r.primary_muscles, []), secondary: parse(r.secondary_muscles, []),
  description: r.description, steps: parse(r.steps, []), rest: r.rest_sec_default,
});

function exerciseFields(body) {
  const primary = arr(body.primary ?? [], 'primary', { max: 14 }).map((m) => oneOf(m, 'primary', MUSCLES));
  if (!primary.length) fail(400, 'invalid_array', 'primary');
  return {
    name: str(body.name, 'name', { min: 2, max: 80 }),
    type: oneOf(body.type ?? 'weight_reps', 'type', ['weight_reps', 'time']),
    kind: body.kind == null ? null : (/^[a-z]{2,20}$/.test(body.kind) ? body.kind : fail(400, 'invalid_option', 'kind')),
    group_key: oneOf(body.group, 'group', GROUPS),
    subtitle: str(body.subtitle ?? '', 'subtitle', { max: 120, optional: true }),
    primary_muscles: JSON.stringify(primary),
    description: str(body.description ?? '', 'description', { max: 2000, optional: true }),
    rest_sec_default: num(body.rest ?? 150, 'rest', { min: 0, max: 600, int: true }),
  };
}

async function assertUniqueExercise(env, userId, name, exceptId = 0) {
  const dup = await env.DB.prepare(
    `SELECT id FROM exercises WHERE deleted_at IS NULL AND (owner_id IS NULL OR owner_id = ?) AND lower(name) = lower(?) AND id != ?`,
  ).bind(userId, name, exceptId).first();
  if (dup) fail(409, 'exercise_exists', 'name');
}

// ---------- programs ----------

function programFields(body) {
  const weekdays = [...new Set(arr(body.weekdays, 'weekdays', { max: 7 }).map((d) => num(d, 'weekdays', { min: 0, max: 6, int: true })))].sort();
  if (!weekdays.length) fail(400, 'invalid_array', 'weekdays');
  const weeks = num(body.weeks, 'weeks', { min: 1, max: 52, int: true });
  const plan = {};
  const rawPlan = body.plan && typeof body.plan === 'object' ? body.plan : {};
  for (const [w, days] of Object.entries(rawPlan)) {
    const wn = Number(w);
    if (!Number.isInteger(wn) || wn < 1 || wn > weeks || !days || typeof days !== 'object') continue;
    for (const [d, rows] of Object.entries(days)) {
      const dn = Number(d);
      if (!weekdays.includes(dn) || !Array.isArray(rows) || !rows.length) continue;
      plan[wn] ??= {};
      plan[wn][dn] = arr(rows, 'plan', { max: 30 }).map((r) => ({
        exerciseId: num(r.exerciseId, 'plan', { min: 1, int: true }),
        sets: num(r.sets, 'plan', { min: 1, max: 20, int: true }),
        reps: str(String(r.reps ?? ''), 'plan', { min: 1, max: 9 }),
        kg: str(String(r.kg ?? ''), 'plan', { max: 40, optional: true }) ?? '',
        rest: r.rest == null ? null : num(r.rest, 'plan', { min: 0, max: 900, int: true }),
        note: str(r.note ?? '', 'plan', { max: 120, optional: true }),
      }));
      for (const r of plan[wn][dn]) if (!/^\d{1,3}([–-]\d{1,3})?$/.test(r.reps)) fail(400, 'invalid_reps', 'plan');
    }
  }
  return {
    name: str(body.name, 'name', { min: 1, max: 80 }),
    weekdays: JSON.stringify(weekdays),
    weeks,
    plan: JSON.stringify(plan),
  };
}

const programOut = (r) => ({
  id: r.id, name: r.name, weekdays: parse(r.weekdays, []), weeks: r.weeks, startDate: r.start_date,
  active: !!r.is_active, plan: parse(r.plan, {}), createdAt: r.created_at, updatedAt: r.updated_at,
});

// ---------- workouts ----------

async function loadWorkouts(env, userId, where, binds) {
  const { results: ws } = await env.DB.prepare(
    `SELECT * FROM workouts WHERE user_id = ? AND ${where} ORDER BY date DESC, id DESC`,
  ).bind(userId, ...binds).all();
  if (!ws.length) return [];
  const ids = ws.map((w) => w.id);
  const marks = ids.map(() => '?').join(',');
  const { results: exs } = await env.DB.prepare(
    `SELECT * FROM workout_exercises WHERE workout_id IN (${marks}) ORDER BY position`,
  ).bind(...ids).all();
  const exIds = exs.map((e) => e.id);
  const sets = exIds.length
    ? (await env.DB.prepare(
      `SELECT * FROM workout_sets WHERE workout_exercise_id IN (${exIds.map(() => '?').join(',')}) ORDER BY set_index`,
    ).bind(...exIds).all()).results
    : [];
  const setsBy = new Map();
  for (const s of sets) {
    if (!setsBy.has(s.workout_exercise_id)) setsBy.set(s.workout_exercise_id, []);
    setsBy.get(s.workout_exercise_id).push({
      index: s.set_index, plannedWeight: s.planned_weight, plannedReps: s.planned_reps,
      weight: s.weight, reps: s.reps, completedAt: s.completed_at,
    });
  }
  const exBy = new Map();
  for (const e of exs) {
    if (!exBy.has(e.workout_id)) exBy.set(e.workout_id, []);
    exBy.get(e.workout_id).push({
      position: e.position, exerciseId: e.exercise_id, name: e.name, kind: e.kind, muscles: e.muscles_text,
      type: e.type, rest: e.rest_seconds, skippedAt: e.skipped_at, sets: setsBy.get(e.id) ?? [],
    });
  }
  return ws.map((w) => ({
    id: w.id, programId: w.program_id, week: w.program_week, weekday: w.weekday, title: w.title, date: w.date,
    status: w.status, startedAt: w.started_at, finishedAt: w.finished_at, exercises: exBy.get(w.id) ?? [],
  }));
}

async function ownWorkout(env, userId, id) {
  const w = await env.DB.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!w) fail(404, 'not_found');
  return w;
}

function workoutExercisesInput(body) {
  return arr(body.exercises, 'exercises', { max: 30 }).map((e, i) => ({
    position: i,
    exerciseId: e.exerciseId == null ? null : num(e.exerciseId, 'exercises', { min: 1, int: true }),
    name: str(e.name, 'exercises', { min: 1, max: 120 }),
    kind: e.kind == null || !/^[a-z]{2,20}$/.test(e.kind) ? null : e.kind,
    muscles: str(e.muscles ?? '', 'exercises', { max: 200, optional: true }),
    type: oneOf(e.type ?? 'weight_reps', 'exercises', ['weight_reps', 'time']),
    rest: num(e.rest ?? 120, 'exercises', { min: 0, max: 900, int: true }),
    sets: arr(e.sets, 'exercises', { max: 20 }).map((s) => ({
      plannedWeight: num(s.plannedWeight, 'sets', { min: 0, max: 1000, optional: true }),
      plannedReps: num(s.plannedReps, 'sets', { min: 0, max: 1000, int: true }),
      weight: num(s.weight, 'sets', { min: 0, max: 1000, optional: true }),
      reps: num(s.reps, 'sets', { min: 0, max: 1000, int: true, optional: true }),
    })),
  }));
}

async function insertWorkoutExercises(env, workoutId, exercises, now) {
  for (const e of exercises) {
    const row = await env.DB.prepare(
      `INSERT INTO workout_exercises (workout_id, position, exercise_id, name, kind, muscles_text, type, rest_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ).bind(workoutId, e.position, e.exerciseId, e.name, e.kind, e.muscles, e.type, e.rest).first();
    if (e.sets.length) {
      await env.DB.batch(e.sets.map((s, i) => env.DB.prepare(
        `INSERT INTO workout_sets (workout_exercise_id, set_index, planned_weight, planned_reps, weight, reps, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(row.id, i, s.plannedWeight, s.plannedReps, s.weight, s.reps, s.reps === null ? null : now)));
    }
  }
}

// ---------- food ----------

// Meal tags as a bit mask: breakfast 1, lunch 2, dinner 4, snack 8; 15 = every meal.
const MEAL_BITS = { breakfast: 1, lunch: 2, dinner: 4, snack: 8 };
const mealsOf = (mask) => Object.keys(MEAL_BITS).filter((m) => ((mask ?? 15) & MEAL_BITS[m]) !== 0);
function maskOf(list, field) {
  const a = arr(list, field, { max: 4 });
  let mask = 0;
  for (const m of a) mask |= MEAL_BITS[oneOf(m, field, MEALS)];
  if (!mask) fail(400, 'invalid_array', field);
  return mask;
}
/** Products joined with the current user's meal tags (column my_meals). */
const PRODUCT_SELECT = 'SELECT p.*, pm.meals AS my_meals FROM products p LEFT JOIN product_meals pm ON pm.product_id = p.id AND pm.user_id = ?';

/** Shown name = «brand · name»; `title` and `brand` are the parts (for editing). */
const fullName = (r) => (r.brand ? `${r.brand} · ${r.name}` : r.name);
const productOut = (r) => ({
  type: 'product', id: r.id, name: fullName(r), title: r.name, brand: r.brand ?? null, barcode: r.barcode, protein: r.protein, fat: r.fat, carbs: r.carbs, kcal: r.kcal ?? null,
  portionName: r.portion_name, portionG: r.portion_g, icon: r.icon, meals: mealsOf(r.my_meals), base: r.created_by === null, createdBy: r.created_by,
});
const dishOut = (r) => ({
  type: 'dish', id: r.id, name: r.name, protein: r.protein, fat: r.fat, carbs: r.carbs, kcal: r.kcal ?? null,
  cookedWeight: r.cooked_weight_g, icon: 'dish', portionName: null, portionG: null, meals: mealsOf(r.meals),
});
const entryOut = (r) => ({
  id: r.id, date: r.date, meal: r.meal, position: r.position, productId: r.product_id, dishId: r.dish_id,
  grams: r.grams, portions: r.portions, name: r.name, icon: r.icon, protein: r.protein, fat: r.fat,
  carbs: r.carbs, kcal: r.kcal ?? null, portionName: r.portion_name, portionG: r.portion_g,
});
/** Label kcal per 100 g: null/absent = computed from macros. */
const kcalIn = (v) => num(v, 'kcal', { min: 0, max: 900, optional: true });
/** Effective kcal per 100 g: the stored label value, else 4·P + 9·F + 4·C. */
const kcalOf = (r) => r.kcal ?? r.protein * 4 + r.fat * 9 + r.carbs * 4;

/** Product picture = its sub-category (guessed from the name when the client sent none). */
const brandIn = (v) => { const b = String(v ?? '').trim(); return b ? str(b, 'brand', { max: 40 }) : null; };
function iconFor(name, picked) {
  if (picked && SUB_IDS.includes(picked)) return picked;
  return guessSub(name) ?? 'other';
}
function oldIconFor(name) { // pre-category drawings, kept for reference
  const n = name.toLowerCase();
  if (/овсян|каш|мюсли/.test(n)) return 'oat';
  if (/яйц|омлет/.test(n)) return 'eggs';
  if (/греч|рис|круп/.test(n)) return 'buckwheat';
  if (/кур|индей|мяс|говя|свин/.test(n)) return 'chicken';
  if (/творог|йогурт|сыр|кефир|молок/.test(n)) return 'curd';
  if (/лосос|рыб|тунец|сёмг|семг|форел/.test(n)) return 'salmon';
  return 'dish';
}

async function itemFor(env, userId, type, id) {
  if (type === 'product') {
    const r = await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).bind(userId, id).first();
    if (!r) fail(404, 'not_found');
    return productOut(r);
  }
  const r = await env.DB.prepare('SELECT * FROM dishes WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!r) fail(404, 'not_found');
  return dishOut(r);
}

const todayOf = (request) => {
  const t = request.headers.get('X-Local-Date');
  return isDay(t) ? t : new Date().toISOString().slice(0, 10);
};

const LABEL_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
const LABEL_PROMPT = `This is a photo of a food package (front and/or the nutrition facts table). Read everything you can find and return only JSON:
{"name": string|null, "brand": string|null, "barcode": string|null, "category": string|null, "kcal": number|null, "protein": number|null, "fat": number|null, "carbs": number|null}.
- name: the product name in Russian as printed, without the brand and without the weight (e.g. "Творог 5%", "Молоко 2,5%"); null if not visible.
- brand: the brand / trademark (e.g. "Простоквашино"); null if not visible.
- barcode: the EAN/UPC digits printed under the barcode (8, 12 or 13 digits, digits only); null if not readable.
- category: the id of the best matching category from this list, or null: ${Object.entries(SUB_NAMES).map(([id, n]) => `${id}=${n}`).join('; ')}.
- kcal, protein, fat, carbs: values PER 100 g (or per 100 ml). If the table has several columns (per 100 g and per portion), use the per-100 g column. If only per-portion values and the portion weight are given, convert to per 100 g. kcal is energy in kilocalories (not kJ). Decimal commas are decimal points.
Use null for anything you cannot read. Never guess.`;

/** Vision model reads the label; any failure (quota, bad answer) returns nulls so the app falls back to on-phone OCR. */
async function readLabelAI(env, image) {
  const num = (v, max) => {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : null;
  };
  let r;
  try {
    r = await env.AI.run(LABEL_MODEL, {
      messages: [{ role: 'user', content: [{ type: 'text', text: LABEL_PROMPT }, { type: 'image_url', image_url: { url: image } }] }],
      max_tokens: 300, temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: { type: 'object', properties: { ...Object.fromEntries(['name', 'brand', 'barcode', 'category'].map((k) => [k, { type: ['string', 'null'] }])), ...Object.fromEntries(['kcal', 'protein', 'fat', 'carbs'].map((k) => [k, { type: ['number', 'null'] }])) }, required: ['name', 'brand', 'barcode', 'category', 'kcal', 'protein', 'fat', 'carbs'] },
      },
    });
  } catch (e) {
    console.warn('label AI failed', String(e));
    return null;
  }
  const raw = typeof r?.response === 'string' ? r.response : JSON.stringify(r?.response ?? '');
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const text = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null);
  const code = typeof j.barcode === 'string' ? j.barcode.replace(/\D/g, '') : '';
  const out = {
    name: text(j.name, 80), brand: text(j.brand, 40),
    barcode: /^(\d{8}|\d{12,14})$/.test(code) ? code : null,
    category: typeof j.category === 'string' && SUB_NAMES[j.category] ? j.category : null,
    kcal: num(j.kcal, 900), protein: num(j.protein, 100), fat: num(j.fat, 100), carbs: num(j.carbs, 100),
  };
  return Object.values(out).some((v) => v !== null) ? out : null;
}

// ---------- router ----------

export async function handleApi(request, env, path) {
  const method = request.method;
  const seg = path.split('/').filter(Boolean); // after /api
  const ok = (body = { ok: true }, status = 200) => json(request, body, status);
  const now = Date.now();
  const today = todayOf(request);

  // --- auth (public) ---
  if (seg[0] === 'auth') {
    if (method === 'POST' && seg[1] === 'register') {
      const body = await readJson(request);
      const email = str(body.email, 'email', { max: 200 }).toLowerCase();
      if (!EMAIL_RE.test(email)) fail(400, 'invalid_email', 'email');
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length < 8 || password.length > 128) fail(400, 'invalid_password', 'password');
      const profile = profileFields(body, { partial: false });
      const goal = oneOf(body.goal ?? 'keep', 'goal', ['lose', 'keep', 'gain']);
      const norms = readNorms(body.norms, 'norms');
      const exists = await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
      if (exists) fail(409, 'email_taken', 'email');
      const { hash, salt } = await hashPassword(password);
      const user = await env.DB.prepare(
        'INSERT INTO users (email, password_hash, password_salt, goal, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
      ).bind(email, hash, salt, goal, now).first();
      await writeProfile(env, user.id, today, profile);
      await env.DB.batch(normStatements(env, user.id, today, norms));
      return ok({ token: await createSession(env, user.id) }, 201);
    }
    if (method === 'POST' && seg[1] === 'login') {
      const body = await readJson(request);
      const email = String(body.email ?? '').trim().toLowerCase();
      const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (!user || !(await verifyPassword(String(body.password ?? ''), user))) fail(401, 'bad_credentials');
      return ok({ token: await createSession(env, user.id) });
    }
    if (method === 'POST' && seg[1] === 'logout') {
      await deleteSession(env, request);
      return ok();
    }
    fail(404, 'not_found');
  }

  const user = await requireUser(env, request);
  const uid = user.id;

  // --- me ---
  if (seg[0] === 'me') {
    if (seg.length === 1 && method === 'GET') return ok(await me(env, user));
    if (seg.length === 1 && method === 'PATCH') {
      const body = await readJson(request);
      if (body.theme !== undefined) {
        await env.DB.prepare('UPDATE users SET theme = ? WHERE id = ?').bind(oneOf(body.theme, 'theme', ['system', 'light', 'dark']), uid).run();
      }
      if (body.goal !== undefined) {
        await env.DB.prepare('UPDATE users SET goal = ? WHERE id = ?').bind(oneOf(body.goal, 'goal', ['lose', 'keep', 'gain']), uid).run();
      }
      return ok();
    }
    if (seg[1] === 'profile' && method === 'PUT') {
      const body = await readJson(request);
      const fields = profileFields(body, { partial: true });
      const cur = await currentProfile(env, uid);
      const map = { name: 'name', weight_kg: 'weight', height_cm: 'height', birth_date: 'birthDate', steps_per_day: 'steps', ...Object.fromEntries(EXTRA) };
      for (const k of Object.keys(fields)) if (fields[k] === cur[map[k]]) delete fields[k];
      await writeProfile(env, uid, today, fields);
      if (body.norms) {
        await env.DB.batch(normStatements(env, uid, today, readNorms(body.norms, 'norms')));
      }
      if (body.goal !== undefined) {
        await env.DB.prepare('UPDATE users SET goal = ? WHERE id = ?').bind(oneOf(body.goal, 'goal', ['lose', 'keep', 'gain']), uid).run();
      }
      return ok(await me(env, { ...user, goal: body.goal ?? user.goal }));
    }
    if (seg[1] === 'norms' && method === 'PUT') {
      const body = await readJson(request);
      await env.DB.batch(normStatements(env, uid, today, readNorms(body, 'norms')));
      return ok(await me(env, user));
    }
    if (seg[1] === 'password' && method === 'POST') {
      const body = await readJson(request);
      if (!(await verifyPassword(String(body.current ?? ''), user))) fail(400, 'bad_password', 'current');
      const next = typeof body.next === 'string' ? body.next : '';
      if (next.length < 8 || next.length > 128) fail(400, 'invalid_password', 'next');
      const { hash, salt } = await hashPassword(next);
      await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, uid).run();
      await deleteOtherSessions(env, request, uid);
      return ok();
    }
    fail(404, 'not_found');
  }

  // --- exercises ---
  if (seg[0] === 'exercises') {
    if (seg.length === 1 && method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM exercises WHERE deleted_at IS NULL AND (owner_id IS NULL OR owner_id = ?) ORDER BY name COLLATE NOCASE',
      ).bind(uid).all();
      return ok({ exercises: results.map(exerciseOut) });
    }
    if (seg.length === 1 && method === 'POST') {
      const f = exerciseFields(await readJson(request));
      await assertUniqueExercise(env, uid, f.name);
      const r = await env.DB.prepare(
        `INSERT INTO exercises (owner_id, name, type, kind, group_key, subtitle, primary_muscles, description, rest_sec_default, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      ).bind(uid, f.name, f.type, f.kind, f.group_key, f.subtitle, f.primary_muscles, f.description, f.rest_sec_default, now).first();
      return ok({ exercise: exerciseOut(r) }, 201);
    }
    const id = num(seg[1], 'id', { min: 1, int: true });
    const own = await env.DB.prepare('SELECT * FROM exercises WHERE id = ? AND owner_id = ? AND deleted_at IS NULL').bind(id, uid).first();
    if (!own) fail(404, 'not_found');
    if (method === 'PUT') {
      const f = exerciseFields(await readJson(request));
      await assertUniqueExercise(env, uid, f.name, id);
      const r = await env.DB.prepare(
        `UPDATE exercises SET name = ?, type = ?, kind = ?, group_key = ?, subtitle = ?, primary_muscles = ?, description = ?, rest_sec_default = ?
         WHERE id = ? RETURNING *`,
      ).bind(f.name, f.type, f.kind, f.group_key, f.subtitle, f.primary_muscles, f.description, f.rest_sec_default, id).first();
      return ok({ exercise: exerciseOut(r) });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('UPDATE exercises SET deleted_at = ? WHERE id = ?').bind(now, id).run();
      return ok();
    }
    fail(405, 'method_not_allowed');
  }

  // --- programs ---
  if (seg[0] === 'programs') {
    if (seg.length === 1 && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM programs WHERE user_id = ? ORDER BY created_at DESC').bind(uid).all();
      return ok({ programs: results.map(programOut) });
    }
    if (seg.length === 1 && method === 'POST') {
      const f = programFields(await readJson(request));
      await env.DB.prepare('UPDATE programs SET is_active = 0 WHERE user_id = ?').bind(uid).run();
      const r = await env.DB.prepare(
        `INSERT INTO programs (user_id, name, weekdays, weeks, start_date, is_active, plan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?) RETURNING *`,
      ).bind(uid, f.name, f.weekdays, f.weeks, mondayOf(today), f.plan, now, now).first();
      return ok({ program: programOut(r) }, 201);
    }
    const id = num(seg[1], 'id', { min: 1, int: true });
    const prog = await env.DB.prepare('SELECT * FROM programs WHERE id = ? AND user_id = ?').bind(id, uid).first();
    if (!prog) fail(404, 'not_found');
    if (method === 'GET') return ok({ program: programOut(prog) });
    if (method === 'PUT') {
      const f = programFields(await readJson(request));
      const r = await env.DB.prepare(
        'UPDATE programs SET name = ?, weekdays = ?, weeks = ?, plan = ?, updated_at = ? WHERE id = ? RETURNING *',
      ).bind(f.name, f.weekdays, f.weeks, f.plan, now, id).first();
      return ok({ program: programOut(r) });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM programs WHERE id = ?').bind(id).run();
      return ok();
    }
    fail(405, 'method_not_allowed');
  }

  // --- workouts ---
  if (seg[0] === 'workouts') {
    if (seg.length === 1 && method === 'GET') {
      const url = new URL(request.url);
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      if (from && to) return ok({ workouts: await loadWorkouts(env, uid, 'date >= ? AND date <= ?', [day(from, 'from'), day(to, 'to')]) });
      return ok({ workouts: await loadWorkouts(env, uid, '1 = 1', []) });
    }
    if (seg.length === 1 && method === 'POST') {
      const body = await readJson(request);
      const exercises = workoutExercisesInput(body);
      if (!exercises.length) fail(400, 'invalid_array', 'exercises');
      const finished = body.status === 'finished';
      const w = await env.DB.prepare(
        `INSERT INTO workouts (user_id, program_id, program_week, weekday, title, date, status, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      ).bind(
        uid,
        body.programId == null ? null : num(body.programId, 'programId', { min: 1, int: true }),
        body.week == null ? null : num(body.week, 'week', { min: 1, max: 52, int: true }),
        body.weekday == null ? null : num(body.weekday, 'weekday', { min: 0, max: 6, int: true }),
        str(body.title, 'title', { min: 1, max: 120 }),
        day(body.date, 'date'),
        finished ? 'finished' : 'in_progress',
        now,
        finished ? now : null,
      ).first();
      if (body.programId != null) {
        const p = await env.DB.prepare('SELECT 1 FROM programs WHERE id = ? AND user_id = ?').bind(body.programId, uid).first();
        if (!p) await env.DB.prepare('UPDATE workouts SET program_id = NULL WHERE id = ?').bind(w.id).run();
      }
      await insertWorkoutExercises(env, w.id, exercises, now);
      return ok({ workout: (await loadWorkouts(env, uid, 'id = ?', [w.id]))[0] }, 201);
    }
    const id = num(seg[1], 'id', { min: 1, int: true });
    const w = await ownWorkout(env, uid, id);

    if (seg.length === 2 && method === 'GET') return ok({ workout: (await loadWorkouts(env, uid, 'id = ?', [id]))[0] });
    if (seg.length === 2 && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM workouts WHERE id = ?').bind(id).run();
      return ok();
    }
    if (seg.length === 2 && method === 'PUT') {
      // edit a past workout: replace its exercises and sets
      const body = await readJson(request);
      const exercises = workoutExercisesInput(body);
      if (!exercises.length) fail(400, 'invalid_array', 'exercises');
      await env.DB.prepare('DELETE FROM workout_exercises WHERE workout_id = ?').bind(id).run();
      await insertWorkoutExercises(env, id, exercises, w.finished_at ?? now);
      return ok({ workout: (await loadWorkouts(env, uid, 'id = ?', [id]))[0] });
    }
    if (seg[2] === 'finish' && method === 'POST') {
      await env.DB.prepare("UPDATE workouts SET status = 'finished', finished_at = ? WHERE id = ?").bind(now, id).run();
      return ok({ workout: (await loadWorkouts(env, uid, 'id = ?', [id]))[0] });
    }
    if (seg[2] === 'exercises') {
      const pos = num(seg[3], 'position', { min: 0, max: 29, int: true });
      const ex = await env.DB.prepare('SELECT id FROM workout_exercises WHERE workout_id = ? AND position = ?').bind(id, pos).first();
      if (!ex) fail(404, 'not_found');
      if (seg.length === 4 && method === 'PATCH') {
        const body = await readJson(request);
        await env.DB.prepare('UPDATE workout_exercises SET skipped_at = ? WHERE id = ?').bind(body.skipped ? now : null, ex.id).run();
        return ok();
      }
      if (seg[4] === 'sets' && method === 'PUT') {
        const idx = num(seg[5], 'set', { min: 0, max: 19, int: true });
        const body = await readJson(request);
        const clear = body.clear === true;
        const res = await env.DB.prepare(
          'UPDATE workout_sets SET weight = ?, reps = ?, completed_at = ? WHERE workout_exercise_id = ? AND set_index = ?',
        ).bind(
          clear ? null : num(body.weight, 'weight', { min: 0, max: 1000 }),
          clear ? null : num(body.reps, 'reps', { min: 0, max: 1000, int: true }),
          clear ? null : now, ex.id, idx,
        ).run();
        if (!res.meta.changes) fail(404, 'not_found');
        return ok();
      }
    }
    fail(404, 'not_found');
  }

  // --- food: products, dishes, diary ---
  if (seg[0] === 'products') {
    // Barcode not in our library yet: ask Open Food Facts so the new-product form can be prefilled.
    // Photo of a nutrition label → kcal and macros per 100 g, read by a vision model on Workers AI (free daily quota).
    if (seg[1] === 'label' && method === 'POST') {
      const image = String((await readJson(request)).image ?? '');
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 2_500_000) fail(400, 'invalid_image', 'image');
      return ok({ label: await readLabelAI(env, image) });
    }
    if (seg[1] === 'lookup' && method === 'GET') {
      const code = new URL(request.url).searchParams.get('barcode') ?? '';
      if (!/^(\d{8}|\d{12,14})$/.test(code)) fail(400, 'invalid_barcode', 'barcode');
      return ok({ product: await openFoodFacts(code) });
    }
    if (seg.length === 1 && method === 'GET') {
      const url = new URL(request.url);
      const barcode = url.searchParams.get('barcode');
      if (barcode) {
        // A 12-digit UPC-A is the same code as a 13-digit EAN with a leading 0.
        const codes = [barcode, barcode.length === 12 ? `0${barcode}` : barcode.length === 13 && barcode.startsWith('0') ? barcode.slice(1) : barcode];
        const r = await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.barcode IN (?, ?)`).bind(uid, codes[0], codes[1]).first();
        if (r || url.searchParams.get('auto') !== '1') return ok({ product: r ? productOut(r) : null });
        // Scanner: unknown here but complete in Open Food Facts → add it to the library at once (the scanner's user owns it and can fix it).
        if (!/^(\d{8}|\d{12,14})$/.test(barcode)) return ok({ product: null });
        const o = await openFoodFacts(barcode);
        if (!o || !o.name || o.name.length < 2 || o.protein === null || o.fat === null || o.carbs === null || o.protein + o.fat + o.carbs > 100.5) return ok({ product: null, off: o });
        const name = o.name.charAt(0).toUpperCase() + o.name.slice(1);
        const ins = await env.DB.prepare(
          `INSERT INTO products (name, brand, barcode, protein, fat, carbs, kcal, icon, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        ).bind(name, o.brand, barcode, o.protein, o.fat, o.carbs, o.kcal, iconFor(name), uid, Date.now()).first();
        return ok({ product: productOut({ ...ins, my_meals: null }), created: true });
      }
      const q = (url.searchParams.get('q') ?? '').trim();
      const meal = url.searchParams.get('meal');
      // Search covers everything, including products other people added.
      if (q) {
        // SQLite's LIKE ignores case only for Latin letters, so "абрик" would miss "Абрикос": filter in JS instead.
        const needle = q.toLowerCase().replace(/ё/g, 'е');
        const { results } = await env.DB.prepare(`${PRODUCT_SELECT} ORDER BY p.name COLLATE NOCASE`).bind(uid).all();
        // Search the full name (brand + name), so «савушкин йогурт» and «йогурт» both find it.
        const norm = (r) => fullName(r).toLowerCase().replace(/ё/g, 'е');
        const words = needle.split(/\s+/).filter(Boolean);
        const hits = results.filter((r) => { const n = norm(r); return words.every((w) => n.includes(w)); });
        // Best matches first (a single letter matches almost everything): the name starts with the query,
        // then a word in it does, then anywhere. The sort is stable, so ties stay alphabetical. At most 50 go out.
        const rank = (r) => {
          const n = norm(r);
          if (r.name.toLowerCase().replace(/ё/g, 'е').startsWith(needle) || n.startsWith(needle)) return 0;
          return words.every((w) => n.split(/[^a-zа-я0-9%]+/).some((t) => t.startsWith(w))) ? 1 : 2;
        };
        const ranked = hits.map((r) => [rank(r), r]).sort((a, b) => a[0] - b[0]);
        return ok({ products: ranked.slice(0, 50).map(([, r]) => productOut(r)) });
      }
      // Browsing: the user's own products (?mine=1), or the base library — most used first, ?limit=N.
      const bit = meal ? MEAL_BITS[oneOf(meal, 'meal', MEALS)] : 15;
      if (url.searchParams.get('mine') === '1') {
        const { results } = await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.created_by = ? ORDER BY p.name COLLATE NOCASE`).bind(uid, uid).all();
        return ok({ products: results.map(productOut) });
      }
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 1000));
      const { results } = await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.created_by IS NULL AND (COALESCE(pm.meals, 15) & ?) != 0
        ORDER BY (SELECT COUNT(*) FROM diary_entries d WHERE d.product_id = p.id) DESC, p.name COLLATE NOCASE LIMIT ?`)
        .bind(uid, bit, limit).all();
      return ok({ products: results.map(productOut) });
    }
    if (seg.length === 1 && method === 'POST') {
      const body = await readJson(request);
      const name = str(body.name, 'name', { min: 2, max: 80 });
      const p = num(body.protein, 'protein', { min: 0, max: 100 });
      const f = num(body.fat, 'fat', { min: 0, max: 100 });
      const c = num(body.carbs, 'carbs', { min: 0, max: 100 });
      if (p + f + c > 100.0001) fail(400, 'invalid_macros', 'carbs');
      const k = kcalIn(body.kcal);
      const barcode = str(body.barcode ?? '', 'barcode', { max: 14, optional: true });
      if (barcode && !/^(\d{8}|\d{12,14})$/.test(barcode)) fail(400, 'invalid_barcode', 'barcode');
      if (barcode) {
        const dup = await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.barcode = ?`).bind(uid, barcode).first();
        if (dup) return json(request, { error: 'barcode_taken', field: 'barcode', product: productOut(dup) }, 409);
      }
      const mealMask = body.meals === undefined ? 15 : maskOf(body.meals, 'meals');
      const portionName = null, portionG = null; // everything is per 100 g; portions were removed
      const r = await env.DB.prepare(
        `INSERT INTO products (name, brand, barcode, protein, fat, carbs, kcal, portion_name, portion_g, icon, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      ).bind(name, brandIn(body.brand), barcode, p, f, c, k, portionName, portionG, iconFor(name, body.icon), uid, now).first();
      if (mealMask !== 15) await env.DB.prepare('INSERT INTO product_meals (user_id, product_id, meals) VALUES (?, ?, ?)').bind(uid, r.id, mealMask).run();
      return ok({ product: productOut({ ...r, my_meals: mealMask }) }, 201);
    }
    // Delete one's own product. Diary entries keep their copy (product link cleared); a product used in a dish stays.
    if (seg.length === 2 && method === 'DELETE') {
      const id = num(seg[1], 'id', { min: 1, int: true });
      const cur = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
      if (!cur) fail(404, 'not_found');
      if (cur.created_by !== uid) fail(403, 'forbidden');
      const used = await env.DB.prepare('SELECT d.name FROM dish_ingredients di JOIN dishes d ON d.id = di.dish_id WHERE di.product_id = ? LIMIT 1').bind(id).first();
      if (used) return json(request, { error: 'product_in_dish', dish: used.name }, 409);
      await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      return ok({ ok: true });
    }
    // Edit a product: its author can change everything; anyone can change the category (picture) of a shared product.
    if (seg.length === 2 && method === 'PUT') {
      const id = num(seg[1], 'id', { min: 1, int: true });
      const cur = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
      if (!cur) fail(404, 'not_found');
      const body = await readJson(request);
      const icon = body.icon === undefined ? cur.icon : oneOf(body.icon, 'icon', SUB_IDS);
      if (cur.created_by !== uid) {
        await env.DB.prepare('UPDATE products SET icon = ? WHERE id = ?').bind(icon, id).run();
      } else {
        const name = str(body.name ?? cur.name, 'name', { min: 2, max: 80 });
        const brand = body.brand === undefined ? cur.brand : brandIn(body.brand);
        const p = num(body.protein ?? cur.protein, 'protein', { min: 0, max: 100 });
        const f = num(body.fat ?? cur.fat, 'fat', { min: 0, max: 100 });
        const c = num(body.carbs ?? cur.carbs, 'carbs', { min: 0, max: 100 });
        if (p + f + c > 100.0001) fail(400, 'invalid_macros', 'carbs');
        const k = body.kcal === undefined ? cur.kcal : kcalIn(body.kcal);
        const barcode = body.barcode === undefined ? cur.barcode : str(body.barcode ?? '', 'barcode', { max: 14, optional: true }) || null;
        if (barcode && !/^(\d{8}|\d{12,14})$/.test(barcode)) fail(400, 'invalid_barcode', 'barcode');
        if (barcode && barcode !== cur.barcode) {
          const dup = await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.barcode = ? AND p.id != ?`).bind(uid, barcode, id).first();
          if (dup) return json(request, { error: 'barcode_taken', field: 'barcode', product: productOut(dup) }, 409);
        }
        await env.DB.prepare('UPDATE products SET name = ?, brand = ?, barcode = ?, protein = ?, fat = ?, carbs = ?, kcal = ?, icon = ? WHERE id = ?')
          .bind(name, brand, barcode, p, f, c, k, icon, id).run();
      }
      // Diary entries keep their own name and numbers (history); only the picture follows the product.
      await env.DB.prepare('UPDATE diary_entries SET icon = ? WHERE product_id = ?').bind(icon, id).run();
      return ok({ product: await itemFor(env, uid, 'product', id) });
    }
    if (seg.length === 3 && seg[2] === 'meals' && method === 'PUT') {
      const id = num(seg[1], 'id', { min: 1, int: true });
      await itemFor(env, uid, 'product', id);
      const mask = maskOf((await readJson(request)).meals, 'meals');
      await env.DB.prepare(`INSERT INTO product_meals (user_id, product_id, meals) VALUES (?, ?, ?)
        ON CONFLICT (user_id, product_id) DO UPDATE SET meals = excluded.meals`).bind(uid, id, mask).run();
      return ok({ product: await itemFor(env, uid, 'product', id) });
    }
    if (seg.length === 2 && method === 'GET') {
      return ok({ product: await itemFor(env, uid, 'product', num(seg[1], 'id', { min: 1, int: true })) });
    }
    fail(404, 'not_found');
  }

  if (seg[0] === 'dishes') {
    if (seg.length === 1 && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM dishes WHERE user_id = ? ORDER BY created_at DESC').bind(uid).all();
      return ok({ dishes: results.map(dishOut) });
    }
    if (seg.length === 1 && method === 'POST') {
      const body = await readJson(request);
      const name = str(body.name, 'name', { min: 2, max: 80 });
      const cooked = num(body.cookedWeight, 'cookedWeight', { min: 1, max: 20000 });
      const mealMask = body.meals === undefined ? 15 : maskOf(body.meals, 'meals');
      const raw = arr(body.ingredients, 'ingredients', { max: 40 });
      if (!raw.length) fail(400, 'invalid_array', 'ingredients');
      // An ingredient is a product, or one of the user's dishes (e.g. a whole meal turned into a dish):
      // a dish is expanded into its own products, scaled to the grams used.
      const ings = [];
      for (const i of raw) {
        const grams = num(i.grams, 'ingredients', { min: 1, max: 5000 });
        if (i.dishId !== undefined && i.dishId !== null) {
          const d = await env.DB.prepare('SELECT * FROM dishes WHERE id = ? AND user_id = ?').bind(num(i.dishId, 'ingredients', { min: 1, int: true }), uid).first();
          if (!d) fail(400, 'invalid_product', 'ingredients');
          const { results: parts } = await env.DB.prepare('SELECT product_id, grams FROM dish_ingredients WHERE dish_id = ? ORDER BY position').bind(d.id).all();
          const rawTotal = parts.reduce((a, x) => a + x.grams, 0) || 1;
          for (const x of parts) ings.push({ productId: x.product_id, grams: (x.grams / rawTotal) * grams * (rawTotal / d.cooked_weight_g) });
        } else {
          ings.push({ productId: num(i.productId, 'ingredients', { min: 1, int: true }), grams });
        }
      }
      if (ings.length > 120) fail(400, 'invalid_array', 'ingredients');
      let tp = 0; let tf = 0; let tc = 0; let tk = 0;
      for (const i of ings) {
        const p = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(i.productId).first();
        if (!p) fail(400, 'invalid_product', 'ingredients');
        tp += (p.protein * i.grams) / 100; tf += (p.fat * i.grams) / 100; tc += (p.carbs * i.grams) / 100; tk += (kcalOf(p) * i.grams) / 100;
      }
      const r = await env.DB.prepare(
        'INSERT INTO dishes (user_id, name, cooked_weight_g, protein, fat, carbs, kcal, meals, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
      ).bind(uid, name, cooked, (tp / cooked) * 100, (tf / cooked) * 100, (tc / cooked) * 100, (tk / cooked) * 100, mealMask, now).first();
      await env.DB.batch(ings.map((i, k) => env.DB.prepare(
        'INSERT INTO dish_ingredients (dish_id, position, product_id, grams) VALUES (?, ?, ?, ?)',
      ).bind(r.id, k, i.productId, i.grams)));
      return ok({ dish: dishOut(r) }, 201);
    }
    if (seg.length === 2 && method === 'GET') {
      return ok({ dish: await itemFor(env, uid, 'dish', num(seg[1], 'id', { min: 1, int: true })) });
    }
    if (seg.length === 3 && seg[2] === 'meals' && method === 'PUT') {
      const id = num(seg[1], 'id', { min: 1, int: true });
      await itemFor(env, uid, 'dish', id);
      const mask = maskOf((await readJson(request)).meals, 'meals');
      await env.DB.prepare('UPDATE dishes SET meals = ? WHERE id = ? AND user_id = ?').bind(mask, id, uid).run();
      return ok({ dish: await itemFor(env, uid, 'dish', id) });
    }
    fail(404, 'not_found');
  }

  if (seg[0] === 'food') {
    if (seg[1] === 'recent' && method === 'GET') {
      const url = new URL(request.url);
      const meal = url.searchParams.get('meal');
      if (meal) {
        // What this user ate at the same meal over the last few days, newest first, one row per food.
        oneOf(meal, 'meal', MEALS);
        const to = day(url.searchParams.get('date') ?? today, 'date');
        const from = new Date(Date.parse(`${to}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
        const { results } = await env.DB.prepare(
          `SELECT * FROM diary_entries WHERE user_id = ? AND meal = ? AND date >= ? AND date <= ? AND (product_id IS NOT NULL OR dish_id IS NOT NULL)
           ORDER BY date DESC, created_at DESC`,
        ).bind(uid, meal, from, to).all();
        const seen = new Set();
        const items = [];
        for (const e of results) {
          const key = e.product_id ? `p${e.product_id}` : `d${e.dish_id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const row = e.product_id
            ? await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).bind(uid, e.product_id).first()
            : await env.DB.prepare('SELECT * FROM dishes WHERE id = ? AND user_id = ?').bind(e.dish_id, uid).first();
          if (row) items.push({ ...(e.product_id ? productOut(row) : dishOut(row)), lastGrams: e.grams, lastDate: e.date });
        }
        return ok({ items });
      }
      const { results } = await env.DB.prepare(
        `SELECT product_id, dish_id, MAX(created_at) AS last, grams FROM diary_entries
         WHERE user_id = ? AND (product_id IS NOT NULL OR dish_id IS NOT NULL)
         GROUP BY product_id, dish_id ORDER BY last DESC LIMIT 30`,
      ).bind(uid).all();
      const items = [];
      for (const r of results) {
        const row = r.product_id
          ? await env.DB.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).bind(uid, r.product_id).first()
          : await env.DB.prepare('SELECT * FROM dishes WHERE id = ? AND user_id = ?').bind(r.dish_id, uid).first();
        if (row) items.push(r.product_id ? productOut(row) : dishOut(row));
      }
      return ok({ items });
    }
    if (seg[1] === 'searches') {
      // Search history: GET the last 10, POST {q} to remember one, DELETE ?q= to drop one, DELETE alone to clear.
      if (method === 'GET') {
        const { results } = await env.DB.prepare('SELECT query FROM search_history WHERE user_id = ? ORDER BY used_at DESC LIMIT 10').bind(uid).all();
        return ok({ searches: results.map((r) => r.query) });
      }
      if (method === 'POST') {
        const q = str((await readJson(request)).q, 'q', { min: 1, max: 100 }).trim().replace(/\s+/g, ' ');
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO search_history (user_id, qkey, query, used_at) VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id, qkey) DO UPDATE SET query = excluded.query, used_at = excluded.used_at`).bind(uid, q.toLowerCase(), q, now),
          env.DB.prepare(`DELETE FROM search_history WHERE user_id = ? AND qkey NOT IN
            (SELECT qkey FROM search_history WHERE user_id = ? ORDER BY used_at DESC LIMIT 10)`).bind(uid, uid),
        ]);
        return ok();
      }
      if (method === 'DELETE') {
        const q = new URL(request.url).searchParams.get('q');
        if (q) await env.DB.prepare('DELETE FROM search_history WHERE user_id = ? AND qkey = ?').bind(uid, q.trim().replace(/\s+/g, ' ').toLowerCase()).run();
        else await env.DB.prepare('DELETE FROM search_history WHERE user_id = ?').bind(uid).run();
        return ok();
      }
    }
    if (seg[1] === 'last-grams' && method === 'GET') {
      const url = new URL(request.url);
      const type = oneOf(url.searchParams.get('type'), 'type', ['product', 'dish']);
      const id = num(url.searchParams.get('id'), 'id', { min: 1, int: true });
      const r = await env.DB.prepare(
        `SELECT grams FROM diary_entries WHERE user_id = ? AND ${type === 'product' ? 'product_id' : 'dish_id'} = ? ORDER BY created_at DESC LIMIT 1`,
      ).bind(uid, id).first();
      return ok({ grams: r?.grams ?? null });
    }
    fail(404, 'not_found');
  }

  if (seg[0] === 'diary') {
    if (seg.length === 1 && method === 'GET') {
      const url = new URL(request.url);
      const from = day(url.searchParams.get('from'), 'from');
      const to = day(url.searchParams.get('to'), 'to');
      const { results } = await env.DB.prepare(
        'SELECT * FROM diary_entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, meal, position, id',
      ).bind(uid, from, to).all();
      return ok({ entries: results.map(entryOut) });
    }
    if (seg.length === 1 && method === 'POST') {
      const body = await readJson(request);
      const date = day(body.date, 'date');
      const meal = oneOf(body.meal, 'meal', MEALS);
      const type = oneOf(body.itemType, 'itemType', ['product', 'dish']);
      const item = await itemFor(env, uid, type, num(body.itemId, 'itemId', { min: 1, int: true }));
      const grams = num(body.grams, 'grams', { min: 1, max: 5000 });
      const portions = num(body.portions, 'portions', { min: 0, max: 100, optional: true });
      const pos = await env.DB.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM diary_entries WHERE user_id = ? AND date = ? AND meal = ?')
        .bind(uid, date, meal).first();
      const r = await env.DB.prepare(
        `INSERT INTO diary_entries (user_id, date, meal, position, product_id, dish_id, grams, portions, name, icon, protein, fat, carbs, kcal, portion_name, portion_g, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      ).bind(
        uid, date, meal, pos.p, type === 'product' ? item.id : null, type === 'dish' ? item.id : null, grams, portions,
        item.name, FOOD_ICONS.includes(item.icon) ? item.icon : 'dish', item.protein, item.fat, item.carbs, item.kcal,
        item.portionName, item.portionG, now,
      ).first();
      return ok({ entry: entryOut(r) }, 201);
    }
    if (seg[1] === 'copy' && method === 'POST') {
      const body = await readJson(request);
      const from = day(body.fromDate, 'fromDate');
      const meal = oneOf(body.meal, 'meal', MEALS);
      const mode = oneOf(body.mode ?? 'append', 'mode', ['append', 'replace']);
      const targets = [...new Set(arr(body.toDates, 'toDates', { max: 14 }).map((d) => day(d, 'toDates')))];
      if (!targets.length) fail(400, 'invalid_array', 'toDates');
      for (const t of targets) if (t === from || t < today) fail(422, 'invalid_target', 'toDates');
      const { results: src } = await env.DB.prepare(
        'SELECT * FROM diary_entries WHERE user_id = ? AND date = ? AND meal = ? ORDER BY position, id',
      ).bind(uid, from, meal).all();
      if (!src.length) fail(400, 'empty_meal', 'meal');
      const stmts = [];
      for (const t of targets) {
        if (mode === 'replace') stmts.push(env.DB.prepare('DELETE FROM diary_entries WHERE user_id = ? AND date = ? AND meal = ?').bind(uid, t, meal));
        src.forEach((e, k) => stmts.push(env.DB.prepare(
          `INSERT INTO diary_entries (user_id, date, meal, position, product_id, dish_id, grams, portions, name, icon, protein, fat, carbs, kcal, portion_name, portion_g, created_at)
           VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM diary_entries WHERE user_id = ? AND date = ? AND meal = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(uid, t, meal, uid, t, meal, e.product_id, e.dish_id, e.grams, e.portions, e.name, e.icon, e.protein, e.fat, e.carbs, e.kcal, e.portion_name, e.portion_g, now + k)));
      }
      await env.DB.batch(stmts);
      return ok();
    }
    const id = num(seg[1], 'id', { min: 1, int: true });
    const entry = await env.DB.prepare('SELECT * FROM diary_entries WHERE id = ? AND user_id = ?').bind(id, uid).first();
    if (!entry) fail(404, 'not_found');
    if (method === 'PATCH') {
      const body = await readJson(request);
      const grams = num(body.grams ?? entry.grams, 'grams', { min: 1, max: 5000 });
      const meal = oneOf(body.meal ?? entry.meal, 'meal', MEALS);
      let portions = body.portions === undefined ? entry.portions : num(body.portions, 'portions', { min: 0, max: 100, optional: true });
      if (portions && entry.portion_g && Math.abs(portions * entry.portion_g - grams) > 0.01) portions = null;
      const r = await env.DB.prepare('UPDATE diary_entries SET grams = ?, meal = ?, portions = ? WHERE id = ? RETURNING *')
        .bind(grams, meal, portions, id).first();
      return ok({ entry: entryOut(r) });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM diary_entries WHERE id = ?').bind(id).run();
      return ok();
    }
    fail(405, 'method_not_allowed');
  }

  fail(404, 'not_found');
}

/** Per-100 g macros and a name from Open Food Facts, or null when unknown or incomplete. */
async function openFoodFacts(code) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_ru,brands,nutriments`, {
      headers: { 'User-Agent': 'Podhod/1.0 (personal workout and food diary)' },
      cf: { cacheTtl: 86400 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const p = j?.product;
    if (j?.status !== 1 || !p) return null;
    const n = p.nutriments ?? {};
    const g = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 10) / 10 : typeof v === 'string' && v.trim() !== '' ? g(Number(v.replace(',', '.'))) : null);
    const protein = g(n.proteins_100g), fat = g(n.fat_100g), carbs = g(n.carbohydrates_100g);
    const kv = typeof n['energy-kcal_100g'] === 'string' ? Number(n['energy-kcal_100g'].replace(',', '.')) : n['energy-kcal_100g'];
    const kcal = typeof kv === 'number' && Number.isFinite(kv) && kv >= 0 && kv <= 900 ? Math.round(kv * 10) / 10 : null;
    const name = String(p.product_name_ru || p.product_name || '').trim();
    const brand = String(p.brands || '').split(',')[0].replace(/^((СП|ОАО|ЗАО|ООО|ОДО|ЧУП|УП|СООО|ИООО)\s+)+/i, '').replace(/["«»]/g, '').trim();
    if (!name && protein === null && fat === null && carbs === null) return null;
    return { name: name.slice(0, 80) || null, brand: brand.slice(0, 40) || null, protein, fat, carbs, kcal };
  } catch {
    return null;
  }
}
