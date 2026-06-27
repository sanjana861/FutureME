const { getDb } = require('../config/db');
const { callGemini } = require('../services/gemini');
const { mentorChatPrompt } = require('../prompts/templates');

// GET CHAT HISTORY
async function getChatHistory(req, res) {
  const userId = req.user.id;
  const db = await getDb();

  try {
    const history = await db.all(
      'SELECT sender, message, created_at FROM mentor_conversations WHERE user_id = ? ORDER BY id ASC',
      [userId]
    );

    // If history is empty, insert a welcome message
    if (history.length === 0) {
      const profile = await db.get('SELECT full_name, preferred_mentor_style FROM profiles WHERE user_id = ?', [userId]);
      const name = profile ? profile.full_name.split(' ')[0] : 'User';
      const style = profile ? profile.preferred_mentor_style : 'Strict Mentor';
      
      let welcomeMsg = `Hello ${name}. I am your career mentor. I will monitor your progress and push you to reach your goals. What are we studying today?`;
      if (style.toLowerCase().includes('friendly')) {
        welcomeMsg = `Hi ${name}! I'm so excited to help you on your learning journey. How is your day going? Let's check your tasks together!`;
      }

      await db.run(
        'INSERT INTO mentor_conversations (user_id, sender, message) VALUES (?, "assistant", ?)',
        [userId, welcomeMsg]
      );
      
      history.push({
        sender: 'assistant',
        message: welcomeMsg,
        created_at: new Date().toISOString()
      });
    }

    return res.status(200).json({ history });
  } catch (error) {
    console.error('Get chat history error:', error);
    return res.status(500).json({ error: 'Failed to retrieve mentor conversation history.' });
  }
}

// SEND CHAT MESSAGE & GENERATE RESPONSE
async function sendChatMessage(req, res) {
  const userId = req.user.id;
  const { message } = req.body;
  const db = await getDb();

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  try {
    const profile = await db.get('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found. Please complete onboarding first.' });
    }

    // Save user message to database
    await db.run(
      'INSERT INTO mentor_conversations (user_id, sender, message) VALUES (?, "user", ?)',
      [userId, message]
    );

    // Retrieve last 15 messages for context
    const history = await db.all(
      'SELECT sender, message FROM mentor_conversations WHERE user_id = ? ORDER BY id DESC LIMIT 15',
      [userId]
    );
    // Reverse to chronological order
    history.reverse();

    console.log('Contacting Gemini mentor engine with context...');
    let aiResponse;
    try {
      aiResponse = await callGemini(mentorChatPrompt(profile, history, message));
    } catch (aiErr) {
      console.error('Mentor AI response failed:', aiErr);
      return res.status(502).json({ error: 'Your AI Mentor is offline. Please check your Gemini connection.' });
    }

    // Save AI message to database
    await db.run(
      'INSERT INTO mentor_conversations (user_id, sender, message) VALUES (?, "assistant", ?)',
      [userId, aiResponse.response]
    );

    return res.status(200).json({
      message: aiResponse.response
    });
  } catch (error) {
    console.error('Send chat message error:', error);
    return res.status(500).json({ error: 'Server error processing conversation.' });
  }
}

module.exports = {
  getChatHistory,
  sendChatMessage
};
