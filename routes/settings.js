const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// UPDATE SETTINGS
router.post('/update', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { theme, notify_email, reminder_time, full_name, current_role } = req.body;
  const db = await getDb();

  try {
    await db.run('BEGIN TRANSACTION;');

    if (theme || notify_email !== undefined || reminder_time) {
      const emailPref = notify_email !== undefined ? (notify_email ? 1 : 0) : null;
      await db.run(`
        UPDATE settings 
        SET theme = COALESCE(?, theme),
            notify_email = CASE WHEN ? IS NOT NULL THEN ? ELSE notify_email END,
            reminder_time = COALESCE(?, reminder_time),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [theme, emailPref, emailPref, reminder_time, userId]);
    }

    if (full_name || current_role) {
      await db.run(`
        UPDATE profiles
        SET full_name = COALESCE(?, full_name),
            current_role = COALESCE(?, current_role),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [full_name, current_role, userId]);
    }

    await db.run('COMMIT;');

    await db.run('INSERT INTO history (user_id, action_type, description) VALUES (?, "settings", ?)', [
      userId,
      'Settings configurations modified successfully.'
    ]);

    return res.status(200).json({ message: 'Settings saved successfully.' });
  } catch (error) {
    try { await db.run('ROLLBACK;'); } catch(e) {}
    console.error('Settings update error:', error);
    return res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// DELETE ACCOUNT PLACEHOLDER
router.post('/delete-account', authMiddleware, async (req, res) => {
  return res.status(200).json({
    message: 'Account purge request received. A confirmation link has been sent to your operational email to authorize deletion.'
  });
});

module.exports = router;
