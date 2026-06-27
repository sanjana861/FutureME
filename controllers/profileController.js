const { getDb } = require('../config/db');
const { validateOnboardingInput, validateUserExists } = require('../services/validationService');
const { generateOnboardingAI } = require('../services/aiService');
const { saveOnboardingData } = require('../services/dbService');

// SETUP PROFILE & GENERATE AI OS ROADMAP
async function setupProfile(req, res) {
  const userId = req.user.id;
  const db = await getDb();
  const timestamp = new Date().toISOString();

  console.log(`[ONBOARDING_LOG] [${timestamp}] [ONBOARDING_FLOW] [START] Initiating onboarding for user ID: ${userId}`);

  try {
    // 1. Validate inputs
    const validation = validateOnboardingInput(req.body);
    if (!validation.isValid) {
      console.error(`[ONBOARDING_LOG] [${new Date().toISOString()}] [ONBOARDING_FLOW] [VALIDATION_FAILED] User ID ${userId}: ${validation.error}`);
      return res.status(400).json({ error: validation.error });
    }

    // 2. Validate foreign key (user existence)
    const userExists = await validateUserExists(db, userId);
    if (!userExists) {
      console.error(`[ONBOARDING_LOG] [${new Date().toISOString()}] [ONBOARDING_FLOW] [FOREIGN_KEY_FAILED] Parent user with ID ${userId} does not exist in the database.`);
      return res.status(400).json({ error: 'User account session is invalid or has been removed.' });
    }
    console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [ONBOARDING_FLOW] [VALIDATION_SUCCESS] User validation completed.`);

    const resumePath = req.file ? req.file.path : null;

    // 3. Generate AI insights (Offline-resilient, handles retries internally)
    const aiResponse = await generateOnboardingAI({
      ...req.body,
      current_skills: req.body.current_skills || '',
      weak_skills: req.body.weak_skills || req.body.biggest_struggles || ''
    });

    // 4. Save results inside database transaction
    await saveOnboardingData(
      db,
      userId,
      req.body,
      resumePath,
      aiResponse.coreData,
      aiResponse.brandingData,
      aiResponse.portfolioData,
      aiResponse.letterData
    );

    console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [ONBOARDING_FLOW] [SUCCESS] Onboarding workflow completed for user ID: ${userId}`);

    return res.status(200).json({
      message: 'Onboarding completed and Career OS workspace compiled successfully.',
      redirect: 'app.html'
    });
  } catch (error) {
    console.error(`[ONBOARDING_LOG] [${new Date().toISOString()}] [ONBOARDING_FLOW] [FAILED] Onboarding setup error:`, error);
    return res.status(500).json({ error: 'Server database error during profile construction.' });
  }
}

// GET DASHBOARD CONSOLIDATED DATA
async function getDashboardData(req, res) {
  const userId = req.user.id;
  const db = await getDb();

  try {
    const profile = await db.get('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    if (!profile) {
      return res.status(404).json({ error: 'No profile configured for active user session.' });
    }

    // Get Roadmap
    const roadmapRow = await db.get('SELECT roadmap_json FROM roadmaps WHERE user_id = ?', [userId]);
    const roadmap = roadmapRow ? JSON.parse(roadmapRow.roadmap_json) : null;

    // Get Projects
    const projects = await db.all('SELECT * FROM projects WHERE user_id = ?', [userId]);
    const formattedProjects = projects.map(p => ({
      ...p,
      features: JSON.parse(p.features || '[]'),
      resume_bullet_points: JSON.parse(p.resume_bullet_points || '[]')
    }));

    // Get Skills Progress
    const skillsProgress = await db.all('SELECT skill_name, proficiency_percentage FROM skill_progress WHERE user_id = ?', [userId]);

    // Get Weekly Planner
    const weeklyPlanRow = await db.get('SELECT plan_json FROM weekly_plans WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
    const weeklyPlan = weeklyPlanRow ? JSON.parse(weeklyPlanRow.plan_json) : null;

    // Get Branding Report
    const brandingRow = await db.get("SELECT data_json FROM reports WHERE user_id = ? AND report_type = 'branding_audit' ORDER BY id DESC LIMIT 1", [userId]);
    const branding = brandingRow ? JSON.parse(brandingRow.data_json) : null;

    // Get Future Letters
    const letters = await db.all('SELECT * FROM future_letters WHERE user_id = ? ORDER BY id DESC', [userId]);

    // Get Achievements
    const achievements = await db.all('SELECT * FROM achievements WHERE user_id = ?', [userId]);

    // Get History Logs
    const historyLogs = await db.all('SELECT * FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 15', [userId]);

    return res.status(200).json({
      profile,
      roadmap,
      projects: formattedProjects,
      skills: skillsProgress,
      weeklyPlan,
      branding,
      letters,
      achievements,
      historyLogs
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return res.status(500).json({ error: 'Failed to retrieve active dashboard state.' });
  }
}

module.exports = {
  setupProfile,
  getDashboardData
};
