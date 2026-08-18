// Shot Log API. One shared, unauthenticated log — `brewer` is self-asserted and
// must never be treated as authorization. Hiding Edit/Delete on other people's
// rows is a courtesy in the UI, not something enforced here.

const MAX_BODY = 8192;   // bytes; a shot with a few add-ins is ~700
const MAX_ROWS = 5000;   // hard ceiling on the shared log
const MAX_ADDINS = 20;

const STYLES = ['hot', 'iced'];
const ROASTS = ['light', 'medium', 'med-dark', 'dark'];
const MILKS = ['whole', '2%', 'skim', 'oat', 'oat barista', 'almond', 'soy', 'none'];
const MILK_PREPS = ['cold', 'frothed', 'cold foam'];
const ESP_PREPS = ['over ice', 'chilled', 'poured on top'];
// Water has no varieties worth logging — either it's in the drink or it isn't.
const WATERS = ['none', 'some'];

// [min, max] for every number the form can produce
const RANGES = {
  grindTime: [0, 120], dose: [0, 100], yield: [0, 500], time: [0, 600],
  milkVol: [0, 1000], frothTime: [0, 300], milkTemp: [0, 250], foam: [0, 100],
  waterVol: [0, 1000], waterTemp: [0, 250]
};
// max length for every free-text field
const LENGTHS = { brewer: 32, beans: 80, grind: 16, notes: 500 };

// Numbers the form leaves blank depending on style or method. They arrive as ''
// (or null for dose), store as NULL, and go back out in the shape the client
// models: dose as null, the rest as ''.
const OPTIONAL_NUMS = { grindTime: '', dose: null, frothTime: '', milkTemp: '', foam: '', waterTemp: '' };

const COLS = ['id', 'brewer', 'ts', 'style', 'beans', 'roast', 'grind', 'grindTime',
  'dose', 'yield', 'time', 'milk', 'milkVol', 'frothTime', 'milkTemp', 'foam',
  'milkPrep', 'espPrep', 'water', 'waterVol', 'waterTemp', 'addins', 'rating',
  'notes', 'updated_at'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
const fail = (message, status) => json({ error: message }, status);

// Thrown by clean(); caught at the top of the handler and turned into a 400.
class Invalid extends Error {}

function str(body, key, { required = false, max } = {}) {
  const raw = body[key];
  const cap = max ?? LENGTHS[key];
  if (raw === undefined || raw === null) {
    if (required) throw new Invalid(`${key} is required`);
    return '';
  }
  if (typeof raw !== 'string') throw new Invalid(`${key} must be text`);
  const v = raw.trim();
  if (required && !v) throw new Invalid(`${key} is required`);
  if (v.length > cap) throw new Invalid(`${key} is longer than ${cap} characters`);
  return v;
}

function inRange(key, v) {
  const [min, max] = RANGES[key];
  if (!Number.isFinite(v)) throw new Invalid(`${key} must be a number`);
  if (v < min || v > max) throw new Invalid(`${key} must be between ${min} and ${max}`);
  return v;
}
const num = (body, key) => inRange(key, Number(body[key]));

// '' / null / undefined all mean "not measured" and store as NULL.
function maybeNum(body, key) {
  const raw = body[key];
  if (raw === '' || raw === null || raw === undefined) return null;
  return inRange(key, Number(raw));
}

function pick(body, key, allowed, { required = false } = {}) {
  const v = str(body, key, { required, max: 24 });
  if (!v && !required) return '';
  if (!allowed.includes(v)) throw new Invalid(`${key} is not one of the known values`);
  return v;
}

// The ingredient list varies drink to drink, so it's stored as a JSON array
// rather than a table — nothing ever queries across add-ins.
function cleanAddins(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Invalid('addins must be a list');
  if (raw.length > MAX_ADDINS) throw new Invalid(`no more than ${MAX_ADDINS} add-ins`);
  return raw
    .filter(a => a && typeof a === 'object' && String(a.name ?? '').trim())
    .map(a => {
      const name = String(a.name).trim();
      const amt = a.amt === null || a.amt === undefined ? '' : String(a.amt).trim();
      // The form offers eight units but re-adds unknown ones as options when a
      // record carries them, so accept any short string here.
      const unit = a.unit === null || a.unit === undefined ? '' : String(a.unit).trim();
      if (name.length > 60) throw new Invalid('an add-in name is too long');
      if (amt.length > 16) throw new Invalid('an add-in amount is too long');
      if (unit.length > 16) throw new Invalid('an add-in unit is too long');
      return { name, amt, unit };
    });
}

// Whitelists every field. Unknown keys in the body are dropped, so nothing a
// client invents can reach a column. Text is stored raw — the client escapes at
// render time, and escaping here would corrupt the JSON/CSV exports.
function clean(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Invalid('Expected a shot object');

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) throw new Invalid('rating must be a whole number from 1 to 10');

  const style = pick(body, 'style', STYLES, { required: true });
  const milk = pick(body, 'milk', MILKS, { required: true });
  const dry = milk === 'none';   // no milk in the drink, so nothing about it to record
  // Shots logged before water was a field carry no `water` key at all; they're dry too.
  const water = pick(body, 'water', WATERS) || 'none';
  const neat = water === 'none';

  // grind stays text on purpose: the form never coerces it, and '' must stay falsy
  return {
    brewer: str(body, 'brewer', { required: true }),
    style,
    beans: str(body, 'beans', { required: true }),
    roast: pick(body, 'roast', ROASTS, { required: true }),
    grind: str(body, 'grind'),
    grindTime: maybeNum(body, 'grindTime'),
    dose: maybeNum(body, 'dose'),
    yield: num(body, 'yield'),
    time: num(body, 'time'),
    milk,
    // The form blanks the fields that don't apply to the chosen style — and hides
    // the milk fields outright when the milk is 'none'. Hold it to both, so an
    // iced drink can't carry a foam depth and a milkless one can't carry a volume.
    milkVol: dry ? 0 : num(body, 'milkVol'),
    frothTime: dry ? null : maybeNum(body, 'frothTime'),
    milkTemp: style === 'iced' || dry ? null : maybeNum(body, 'milkTemp'),
    foam: style === 'iced' || dry ? null : maybeNum(body, 'foam'),
    milkPrep: style === 'iced' && !dry ? pick(body, 'milkPrep', MILK_PREPS) : '',
    espPrep: style === 'iced' ? pick(body, 'espPrep', ESP_PREPS) : '',
    water,
    // Same deal as milk: the form hides the water fields when there is no water,
    // so a water-free drink can't come back carrying a volume or a temperature.
    waterVol: neat ? 0 : num(body, 'waterVol'),
    waterTemp: neat ? null : maybeNum(body, 'waterTemp'),
    addins: cleanAddins(body.addins),
    rating,
    notes: str(body, 'notes')
  };
}

// Row -> the object the client expects: addins parsed, NULLs back to '' (or
// null for dose, which the client models that way).
function toShot(row) {
  const out = { ...row };
  try { out.addins = JSON.parse(row.addins); } catch { out.addins = []; }
  if (!Array.isArray(out.addins)) out.addins = [];
  for (const [key, blank] of Object.entries(OPTIONAL_NUMS)) {
    if (out[key] === null || out[key] === undefined) out[key] = blank;
  }
  return out;
}
// The inverse, for binding: addins serialized, everything else as-is.
const toRow = shot => ({ ...shot, addins: JSON.stringify(shot.addins) });

const rowById = (env, id) =>
  env.DB.prepare('SELECT * FROM shots WHERE id = ?').bind(id).first();

async function listShots(env) {
  const { results } = await env.DB.prepare('SELECT * FROM shots ORDER BY ts DESC').all();
  return json({ shots: results.map(toShot) });
}

async function createShot(env, body) {
  const id = String(body?.id ?? '');
  if (!/^[a-z0-9]{6,24}$/.test(id)) throw new Invalid('id is malformed');

  const { total } = await env.DB.prepare('SELECT COUNT(*) AS total FROM shots').first();
  if (total >= MAX_ROWS) return fail('The log is full', 429);

  const s = clean(body);
  const now = Date.now();
  // ts is server-assigned so a wrong client clock can't reorder the log
  const shot = { id, ...s, ts: now, updated_at: now };
  const row = toRow(shot);

  try {
    await env.DB.prepare(
      `INSERT INTO shots (${COLS.map(c => `"${c}"`).join(', ')})
       VALUES (${COLS.map(() => '?').join(', ')})`
    ).bind(...COLS.map(c => row[c])).run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) return fail('That shot already exists', 409);
    throw e;
  }
  return json({ shot: toShot(row) }, 201);
}

async function updateShot(env, id, body) {
  const existing = await rowById(env, id);
  if (!existing) return fail('No such shot', 404);

  const s = clean(body);
  // ts is the creation time and survives edits, exactly as it did locally
  const shot = { id, ...s, ts: existing.ts, updated_at: Date.now() };
  const row = toRow(shot);

  const fields = COLS.filter(c => c !== 'id');
  await env.DB.prepare(
    `UPDATE shots SET ${fields.map(c => `"${c}" = ?`).join(', ')} WHERE id = ?`
  ).bind(...fields.map(c => row[c]), id).run();

  return json({ shot: toShot(row) });
}

async function removeShot(env, id) {
  const { meta } = await env.DB.prepare('DELETE FROM shots WHERE id = ?').bind(id).run();
  if (!meta.changes) return fail('No such shot', 404);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // The Worker only owns /api/*; everything else is a static asset.
    if (!path.startsWith('/api/')) return new Response('Not found', { status: 404 });

    const write = request.method !== 'GET';

    if (write) {
      // Same-origin only. No CORS headers are sent anywhere, deliberately.
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return fail('Cross-origin writes are not allowed', 403);

      if (env.WRITE_LIMIT) {
        const key = request.headers.get('CF-Connecting-IP') || 'unknown';
        const { success } = await env.WRITE_LIMIT.limit({ key });
        if (!success) return fail('Slow down a moment', 429);
      }
    }

    let body;
    if (request.method === 'POST' || request.method === 'PUT') {
      if (!(request.headers.get('content-type') || '').includes('application/json')) {
        return fail('Expected application/json', 415);
      }
      // Content-Length can lie, so the text is re-checked after reading.
      if (Number(request.headers.get('content-length')) > MAX_BODY) return fail('That is too much data', 413);
      const text = await request.text();
      if (text.length > MAX_BODY) return fail('That is too much data', 413);
      try { body = JSON.parse(text); } catch { return fail('That is not valid JSON', 400); }
    }

    const match = /^\/api\/shots(?:\/([^/]+))?$/.exec(path);
    if (!match) return fail('No such endpoint', 404);
    const id = match[1] ? decodeURIComponent(match[1]) : null;

    try {
      if (!id) {
        if (request.method === 'GET') return await listShots(env);
        if (request.method === 'POST') return await createShot(env, body);
        return fail('Method not allowed', 405);
      }
      if (request.method === 'PUT') return await updateShot(env, id, body);
      if (request.method === 'DELETE') return await removeShot(env, id);
      return fail('Method not allowed', 405);
    } catch (e) {
      if (e instanceof Invalid) return fail(e.message, 400);
      console.error('shot-log', e);
      return fail('Something went wrong saving that', 500);
    }
  }
};
