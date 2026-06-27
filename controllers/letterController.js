const { getDb } = require('../config/db');
const { callGemini } = require('../services/gemini');
const { futureLetterPrompt } = require('../prompts/templates');

// GET ALL PAST LETTERS
async function getAllLetters(req, res) {
  const userId = req.user.id;
  const db = await getDb();

  try {
    const letters = await db.all(
      'SELECT id, letter_content, status, month_year, created_at FROM future_letters WHERE user_id = ? ORDER BY id DESC',
      [userId]
    );

    // If no letters exist, generate the first one automatically
    if (letters.length === 0) {
      const profile = await db.get('SELECT * FROM profiles WHERE user_id = ?', [userId]);
      if (profile) {
        console.log('No letters found. Generating initial future letter...');
        let letterData;
        try {
          letterData = await callGemini(futureLetterPrompt(profile, 0, 0));
          const monthYear = new Date().toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }).replace('/', '-');
          
          await db.run('INSERT INTO future_letters (user_id, letter_content, status, month_year) VALUES (?, ?, ?, ?)', [
            userId,
            letterData.future_letter,
            'unread',
            monthYear
          ]);

          letters.push({
            letter_content: letterData.future_letter,
            status: 'unread',
            month_year: monthYear,
            created_at: new Date().toISOString()
          });
        } catch (aiErr) {
          console.error('Initial letter generation failed:', aiErr);
        }
      }
    }

    return res.status(200).json({ letters });
  } catch (error) {
    console.error('Get letters error:', error);
    return res.status(500).json({ error: 'Failed to query future letter matrices.' });
  }
}

// GENERATE NEW LETTER (FORCE MONTHLY GENERATION)
async function generateNewLetter(req, res) {
  const userId = req.user.id;
  const db = await getDb();

  try {
    const profile = await db.get('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found. Onboarding required.' });
    }

    // Get completion statistics for the past 30 days
    const stats = await db.get(`
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(*) as total
      FROM daily_tasks
      WHERE user_id = ? AND date >= date('now', '-30 days')
    `, [userId]);

    console.log('Generating monthly progress letter from the future...');
    let letterData;
    try {
      letterData = await callGemini(futureLetterPrompt(profile, stats.completed || 0, stats.total || 0));
    } catch (aiErr) {
      console.error('Gemini future letter failed:', aiErr);
      return res.status(502).json({ error: 'AI letter compilation timed out.' });
    }

    const monthYear = new Date().toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }).replace('/', '-');

    const result = await db.run(
      'INSERT INTO future_letters (user_id, letter_content, status, month_year) VALUES (?, ?, ?, ?)',
      [userId, letterData.future_letter, 'unread', monthYear]
    );

    await db.run('INSERT INTO history (user_id, action_type, description) VALUES (?, "letter", ?)', [
      userId,
      `Received new letter from future self for period ${monthYear}.`
    ]);

    return res.status(200).json({
      message: 'New future letter compiled successfully.',
      letter: {
        id: result.lastID,
        letter_content: letterData.future_letter,
        status: 'unread',
        month_year: monthYear
      }
    });
  } catch (error) {
    console.error('Generate letter error:', error);
    return res.status(500).json({ error: 'Failed to store newly generated future letter.' });
  }
}

// MARK LETTER AS READ
async function readLetter(req, res) {
  const userId = req.user.id;
  const letterId = req.params.id;
  const db = await getDb();

  try {
    await db.run(
      'UPDATE future_letters SET status = "read" WHERE id = ? AND user_id = ?',
      [letterId, userId]
    );
    return res.status(200).json({ message: 'Letter marked read.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update letter status.' });
  }
}

module.exports = {
  getAllLetters,
  generateNewLetter,
  readLetter
};
