const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
require('dotenv').config();

const dbFile = path.resolve(__dirname, '..', process.env.DB_FILE || 'database/futureme.sqlite');

let db = null;

async function getDb() {
  if (db) return db;
  db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });
  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON;');
  return db;
}

module.exports = { getDb };
