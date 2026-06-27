const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// UPDATE PROJECT STATUS
router.post('/:id/status', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const projectId = req.params.id;
  const { status } = req.body;
  const db = await getDb();

  if (!['not_started', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid project status configuration.' });
  }

  try {
    const project = await db.get('SELECT title FROM projects WHERE id = ? AND user_id = ?', [projectId, userId]);
    if (!project) {
      return res.status(404).json({ error: 'Project layout not found.' });
    }

    await db.run('UPDATE projects SET status = ? WHERE id = ?', [status, projectId]);

    if (status === 'completed') {
      await db.run('INSERT INTO history (user_id, action_type, description) VALUES (?, "project", ?)', [
        userId,
        `Built and shipped portfolio project blueprint: "${project.title}".`
      ]);

      const unlocked = await db.get('SELECT id FROM achievements WHERE user_id = ? AND title = "Shipped It!"', [userId]);
      if (!unlocked) {
        await db.run('INSERT INTO achievements (user_id, title, description) VALUES (?, ?, ?)', [
          userId,
          'Shipped It!',
          `Finished construction on project: "${project.title}".`
        ]);
      }
    } else {
      await db.run('INSERT INTO history (user_id, action_type, description) VALUES (?, "project", ?)', [
        userId,
        `Began construction on project: "${project.title}" (Set status: ${status}).`
      ]);
    }

    return res.status(200).json({ message: 'Project status synchronized.' });
  } catch (error) {
    console.error('Update project status error:', error);
    return res.status(500).json({ error: 'Failed to synchronize project status.' });
  }
});

module.exports = router;
