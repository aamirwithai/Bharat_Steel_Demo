const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../db');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT id, username, password_hash, role FROM Users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.user = { id: user.id, username: user.username, role: user.role };
  return res.json({ id: user.id, username: user.username, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json(req.session.user);
});

module.exports = router;
