const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, '../../data.sqlite');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const initSchema = () => {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schemaSql);

  const adminExists = db.prepare('SELECT id FROM Users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO Users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'ADMIN');
  }

  const staffExists = db.prepare('SELECT id FROM Users WHERE username = ?').get('staff');
  if (!staffExists) {
    const hash = bcrypt.hashSync('staff123', 10);
    db.prepare('INSERT INTO Users (username, password_hash, role) VALUES (?, ?, ?)').run('staff', hash, 'STAFF');
  }
};

module.exports = { db, initSchema };
