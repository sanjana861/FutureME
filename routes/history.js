const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// GET LIST OF ALL REPORTS
router.get('/reports', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const db = await getDb();

  try {
    const reports = await db.all(
      'SELECT id, report_type, created_at FROM reports WHERE user_id = ? ORDER BY id DESC',
      [userId]
    );
    return res.status(200).json({ reports });
  } catch (error) {
    console.error('Fetch reports history error:', error);
    return res.status(500).json({ error: 'Failed to retrieve reports history.' });
  }
});

// GET SINGLE REPORT BY ID
router.get('/report/:id', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const reportId = req.params.id;
  const db = await getDb();

  try {
    const report = await db.get(
      'SELECT * FROM reports WHERE id = ? AND user_id = ?',
      [reportId, userId]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    return res.status(200).json({
      id: report.id,
      report_type: report.report_type,
      created_at: report.created_at,
      data: JSON.parse(report.data_json)
    });
  } catch (error) {
    console.error('Fetch single report error:', error);
    return res.status(500).json({ error: 'Failed to fetch report details.' });
  }
});

// COMPARE TWO REPORTS
router.get('/compare/:id1/:id2', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { id1, id2 } = req.params;
  const db = await getDb();

  try {
    const report1 = await db.get('SELECT * FROM reports WHERE id = ? AND user_id = ?', [id1, userId]);
    const report2 = await db.get('SELECT * FROM reports WHERE id = ? AND user_id = ?', [id2, userId]);

    if (!report1 || !report2) {
      return res.status(404).json({ error: 'One or both reports do not exist.' });
    }

    const data1 = JSON.parse(report1.data_json);
    const data2 = JSON.parse(report2.data_json);

    // Simple comparison logic based on report types
    const comparison = {
      report1: { id: id1, type: report1.report_type, date: report1.created_at },
      report2: { id: id2, type: report2.report_type, date: report2.created_at },
      changes: []
    };

    // If comparing weekly reviews or onboarding reports
    if (report1.report_type === 'weekly_review' && report2.report_type === 'weekly_review') {
      const stats1 = data1.stats || { completed: 0, skipped: 0 };
      const stats2 = data2.stats || { completed: 0, skipped: 0 };

      comparison.changes.push({
        metric: 'Completed Tasks',
        old_value: stats1.completed,
        new_value: stats2.completed,
        difference: stats2.completed - stats1.completed
      });
      comparison.changes.push({
        metric: 'Skipped Tasks',
        old_value: stats1.skipped,
        new_value: stats2.skipped,
        difference: stats2.skipped - stats1.skipped
      });
    } else {
      // General comparison placeholder
      comparison.changes.push({
        metric: 'Status Summary',
        details: `Comparing Report 1 (${report1.report_type}) dated ${report1.created_at} with Report 2 (${report2.report_type}) dated ${report2.created_at}.`
      });
    }

    return res.status(200).json({ comparison });
  } catch (error) {
    console.error('Compare reports error:', error);
    return res.status(500).json({ error: 'Failed to compare reports.' });
  }
});

module.exports = router;
