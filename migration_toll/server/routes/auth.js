import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing)
    return res.status(409).json({ error: 'An account with this email already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = db.prepare(
    'INSERT INTO users (email, password, name) VALUES (?, ?, ?) RETURNING id, email, name, role, created_date'
  ).get(email.toLowerCase(), hashed, name || null);

  res.status(201).json({ token: signToken({ id: user.id, email: user.email, role: user.role }), user });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!row || !(await bcrypt.compare(password, row.password)))
    return res.status(401).json({ error: 'Invalid email or password' });

  const { password: _pw, ...user } = row;
  res.json({ token: signToken({ id: user.id, email: user.email, role: user.role }), user });
});

// GET /api/auth/me  (requires token)
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, email, name, role, created_date FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ user });
});

export default router;
