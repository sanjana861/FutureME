const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'futureme_super_secret_matrix_key_123!';

// SIGNUP
async function signup(req, res) {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'All fields (email, password, full name) are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please supply a valid operational email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Secure Password Architecture requires at least 6 characters.' });
    }

    const db = await getDb();

    // Check if user exists
    const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existingUser) {
      return res.status(409).json({ error: 'An account is already configured under this email address.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user
    const result = await db.run(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email.toLowerCase(), passwordHash]
    );
    const userId = result.lastID;

    // Create default settings for user
    await db.run('INSERT INTO settings (user_id, theme, notify_email, reminder_time) VALUES (?, ?, ?, ?)', [
      userId,
      'dark',
      1,
      '09:00'
    ]);

    // Create default history log
    await db.run(
      'INSERT INTO history (user_id, action_type, description, metadata_json) VALUES (?, ?, ?, ?)',
      [userId, 'auth', 'Account initialized successfully', JSON.stringify({ email: email.toLowerCase() })]
    );

    // Add initial achievements
    await db.run(
      'INSERT INTO achievements (user_id, title, description) VALUES (?, ?, ?)',
      [userId, 'Core Activated', 'Successfully registered and initialized your FutureMe account.']
    );

    // Issue token
    const token = jwt.sign({ id: userId, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(201).json({
      message: 'Account deployed successfully.',
      token,
      user: { id: userId, email: email.toLowerCase(), full_name }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Server error encountered during authentication setup.' });
  }
}

// LOGIN
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Operational Email and Password Key are required.' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid operational email or password.' });
    }

    // Verify Password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid operational email or password.' });
    }

    // Get user's profile to retrieve full name
    const profile = await db.get('SELECT full_name FROM profiles WHERE user_id = ?', [user.id]);
    const fullName = profile ? profile.full_name : 'User';

    // Issue Token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Log history
    await db.run(
      'INSERT INTO history (user_id, action_type, description) VALUES (?, ?, ?)',
      [user.id, 'auth', 'Successful sign in session established']
    );

    return res.status(200).json({
      message: 'Authentication validated.',
      token,
      user: { id: user.id, email: user.email, full_name: fullName }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error encountered during validation.' });
  }
}

// LOGOUT
async function logout(req, res) {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Session terminated successfully.' });
}

// FORGOT PASSWORD
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Operational Email is required.' });
  }
  // Placeholder logic as requested
  return res.status(200).json({
    message: 'Reset pipeline triggered. If this email exists in our records, a secure key reset matrix link will be sent.'
  });
}

// GET ME (CURRENT USER STATUS)
async function me(req, res) {
  try {
    const db = await getDb();
    const user = await db.get('SELECT id, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User workspace not found.' });
    }

    const profile = await db.get('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);
    const settings = await db.get('SELECT theme, notify_email, reminder_time FROM settings WHERE user_id = ?', [req.user.id]);

    return res.status(200).json({
      user,
      onboarded: !!profile,
      profile: profile || null,
      settings: settings || { theme: 'dark', notify_email: 1, reminder_time: '09:00' }
    });
  } catch (error) {
    console.error('Get user status error:', error);
    return res.status(500).json({ error: 'Database mismatch during session query.' });
  }
}

// GOOGLE MOCK LOGIN
async function googleMock(req, res) {
  try {
    const db = await getDb();
    const email = 'google.user@example.com';
    const fullName = 'Google User';

    // Check if user exists
    let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    let userId;

    if (!user) {
      // Create user with a dummy password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('google_oauth_mock_password_123', salt);
      const result = await db.run(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)',
        [email, passwordHash]
      );
      userId = result.lastID;

      // Create settings
      await db.run('INSERT INTO settings (user_id, theme, notify_email, reminder_time) VALUES (?, ?, ?, ?)', [
        userId,
        'dark',
        1,
        '09:00'
      ]);

      // Achievements
      await db.run(
        'INSERT INTO achievements (user_id, title, description) VALUES (?, ?, ?)',
        [userId, 'Core Activated', 'Successfully registered and initialized your FutureMe account.']
      );
    } else {
      userId = user.id;
    }

    // Issue Token
    const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
      message: 'Google Authentication validated.',
      token,
      user: { id: userId, email, full_name: fullName }
    });
  } catch (error) {
    console.error('Google mock error:', error);
    return res.status(500).json({ error: 'Server error during Google auth simulation.' });
  }
}

module.exports = {
  signup,
  login,
  logout,
  forgotPassword,
  me,
  googleMock
};
