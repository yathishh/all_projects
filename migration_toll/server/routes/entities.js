import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All entity routes require authentication
router.use(requireAuth);

const ALLOWED_TABLES = new Set([
  'migration_projects', 'migration_tasks', 'connection_profiles',
  'backup_jobs', 'restore_jobs', 'storage_engines',
  'schema_mappings', 'alert_rules', 'audit_logs',
]);

const guard = (req, res) => {
  if (!ALLOWED_TABLES.has(req.params.table)) {
    res.status(404).json({ error: 'Unknown table' });
    return false;
  }
  return true;
};

const now = () => new Date().toISOString();

// GET /api/:table?sort=-created_date&limit=100
router.get('/:table', (req, res) => {
  if (!guard(req, res)) return;
  const { table } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const rawSort = req.query.sort || '-created_date';
  const asc = !rawSort.startsWith('-');
  const col = rawSort.replace(/^-/, '');

  try {
    const rows = db.prepare(
      `SELECT * FROM ${table} ORDER BY ${col} ${asc ? 'ASC' : 'DESC'} LIMIT ?`
    ).all(limit);
    res.json(rows);
  } catch {
    res.status(400).json({ error: 'Invalid sort column' });
  }
});

// GET /api/:table/filter?field=value (filter by one field)
router.get('/:table/filter', (req, res) => {
  if (!guard(req, res)) return;
  const { table } = req.params;
  const filters = { ...req.query };

  const keys = Object.keys(filters);
  if (keys.length === 0) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    return res.json(rows);
  }

  const where = keys.map(k => `${k} = ?`).join(' AND ');
  try {
    const rows = db.prepare(`SELECT * FROM ${table} WHERE ${where}`).all(...keys.map(k => filters[k]));
    res.json(rows);
  } catch {
    res.status(400).json({ error: 'Invalid filter' });
  }
});

// POST /api/:table
router.post('/:table', (req, res) => {
  if (!guard(req, res)) return;
  const { table } = req.params;
  const data = { ...req.body, created_date: now(), updated_date: now() };

  // Generate id if not present
  if (!data.id) {
    data.id = crypto.randomUUID().replace(/-/g, '');
  }

  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(', ');
  try {
    db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...keys.map(k => data[k]));
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(data.id);
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/:table/:id
router.put('/:table/:id', (req, res) => {
  if (!guard(req, res)) return;
  const { table, id } = req.params;
  const data = { ...req.body, updated_date: now() };
  delete data.id;
  delete data.created_date;

  const keys = Object.keys(data);
  if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });

  const set = keys.map(k => `${k} = ?`).join(', ');
  try {
    db.prepare(`UPDATE ${table} SET ${set} WHERE id = ?`).run(...keys.map(k => data[k]), id);
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/:table/:id
router.delete('/:table/:id', (req, res) => {
  if (!guard(req, res)) return;
  const { table, id } = req.params;
  try {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
