const { getDb } = require('../config/db');
const { callGemini } = require('../services/gemini');
const {
  coreStrategyPrompt,
  brandingPrompt,
  portfolioAndCurriculumPrompt,
  futureLetterPrompt
} = require('../prompts/templates');

// Helper to format date
function getFutureDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

// SETUP PROFILE & GENERATE AI OS ROADMAP
async function setupProfile(req, res) {
  const userId = req.user.id;
  const db = await getDb();

  try {
    const {
      full_name,
      age,
      country,
      current_role,
      dream_role,
      dream_company,
      expected_salary,
      learning_time,
      portfolio_url,
      github_url,
      linkedin_url,
      learning_style,
      current_projects,
      confidence_level,
      biggest_struggles,
      preferred_mentor_style
    } = req.body;

    if (!full_name || !dream_role || !dream_company || !learning_time) {
      return res.status(400).json({ error: 'Required fields: Full Name, Dream Role, Dream Company, and Learning Time.' });
    }

    const resumePath = req.file ? req.file.path : null;

    // Check if profile exists
    const existingProfile = await db.get('SELECT id FROM profiles WHERE user_id = ?', [userId]);
    if (existingProfile) {
      // Clean up previous data if user is re-onboarding
      await db.run('DELETE FROM profiles WHERE user_id = ?', [userId]);
      await db.run('DELETE FROM goals WHERE user_id = ?', [userId]);
      await db.run('DELETE FROM skills WHERE user_id = ?', [userId]);
      await db.run('DELETE FROM skill_progress WHERE user_id = ?', [userId]);
      await db.run('DELETE FROM roadmaps WHERE user_id = ?', [userId]);
      await db.run('DELETE FROM projects WHERE user_id = ?', [userId]);
      await db.run('DELETE FROM weekly_plans WHERE user_id = ?', [userId]);
      await db.run('DELETE FROM daily_tasks WHERE user_id = ?', [userId]);
      await db.run('DELETE FROM future_letters WHERE user_id = ?', [userId]);
    }

    // Save profile baseline
    await db.run(`
      INSERT INTO profiles (
        user_id, full_name, age, country, current_role, dream_role, dream_company,
        expected_salary, learning_time, portfolio_url, github_url, linkedin_url,
        resume_path, learning_style, current_projects, confidence_level,
        biggest_struggles, preferred_mentor_style
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId, full_name, age ? parseInt(age) : null, country, current_role, dream_role, dream_company,
      expected_salary, learning_time, portfolio_url, github_url, linkedin_url,
      resumePath, learning_style, current_projects, confidence_level,
      biggest_struggles, preferred_mentor_style
    ]);

    // Gather skills details for prompts
    const current_skills = req.body.current_skills || '';
    const weak_skills = req.body.weak_skills || biggest_struggles;

    const profileData = {
      full_name, age, country, current_role, dream_role, dream_company,
      expected_salary, learning_time, portfolio_url, github_url, linkedin_url,
      learning_style, current_projects, confidence_level, biggest_struggles,
      preferred_mentor_style, current_skills, weak_skills
    };

    console.log('Calling Gemini AI service for Core Strategy, Branding, and Projects...');

    // Call Gemini API endpoints in parallel to speed up onboarding
    let coreData, brandingData, portfolioData, letterData;
    try {
      [coreData, brandingData, portfolioData] = await Promise.all([
        callGemini(coreStrategyPrompt(profileData)),
        callGemini(brandingPrompt(profileData)),
        callGemini(portfolioAndCurriculumPrompt(profileData))
      ]);

      // Call future letter using the details generated
      letterData = await callGemini(futureLetterPrompt(profileData, 0, 0));
    } catch (aiError) {
      console.error('Gemini processing failed:', aiError);
      return res.status(502).json({
        error: aiError.message || 'AI generation failed. Please ensure your Gemini API key is valid.'
      });
    }

    console.log('AI processing successful. Saving results to database...');

    // 1. Update Career Summary in Profile
    await db.run('UPDATE profiles SET career_summary = ? WHERE user_id = ?', [coreData.career_summary, userId]);

    // 2. Save Skills & Progress Telemetry
    if (coreData.skill_gap_analysis && Array.isArray(coreData.skill_gap_analysis)) {
      for (const item of coreData.skill_gap_analysis) {
        // Save to skills table
        await db.run('INSERT INTO skills (user_id, skill_name, skill_type) VALUES (?, ?, ?)', [
          userId,
          item.skill_name,
          item.current_proficiency < 50 ? 'weak' : 'current'
        ]);

        // Save progress telemetry
        await db.run('INSERT INTO skill_progress (user_id, skill_name, proficiency_percentage) VALUES (?, ?, ?)', [
          userId,
          item.skill_name,
          item.current_proficiency
        ]);
      }
    }

    // 3. Save Career Roadmap
    await db.run('INSERT INTO roadmaps (user_id, roadmap_json) VALUES (?, ?)', [
      userId,
      JSON.stringify(coreData.roadmap)
    ]);

    // Save milestones as goals
    if (coreData.roadmap && coreData.roadmap.phases) {
      for (const phase of coreData.roadmap.phases) {
        if (phase.milestones) {
          for (const ms of phase.milestones) {
            await db.run('INSERT INTO goals (user_id, title, status, target_date) VALUES (?, ?, ?, ?)', [
              userId,
              ms,
              'pending',
              phase.estimated_date
            ]);
          }
        }
      }
    }

    // 4. Save Weekly Planner & Daily Routines
    const plannerPayload = {
      weekly_routine: coreData.weekly_routine,
      daily_routine: coreData.daily_routine,
      plan_30_day: coreData.plan_30_day,
      plan_90_day: coreData.plan_90_day,
      plan_one_year: coreData.plan_one_year,
      motivation: coreData.motivation,
      personal_advice: coreData.personal_advice,
      common_mistakes: coreData.common_mistakes
    };
    
    await db.run('INSERT INTO weekly_plans (user_id, week_start_date, plan_json) VALUES (?, ?, ?)', [
      userId,
      getFutureDate(0),
      JSON.stringify(plannerPayload)
    ]);

    // 5. Generate daily task entries in database for Week 1
    // Generate tasks based on weekly routine
    if (coreData.weekly_routine) {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = new Date();
      
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + i);
        const dayName = daysOfWeek[targetDate.getDay()];
        const dateStr = targetDate.toISOString().split('T')[0];

        const dayRoutine = coreData.weekly_routine.find(d => d.day.toLowerCase() === dayName.toLowerCase());
        if (dayRoutine && dayRoutine.tasks) {
          for (const task of dayRoutine.tasks) {
            await db.run('INSERT INTO daily_tasks (user_id, task_description, status, minutes_duration, date) VALUES (?, ?, ?, ?, ?)', [
              userId,
              task,
              'pending',
              60, // default 60 mins
              dateStr
            ]);
          }
        }
      }
    }

    // 6. Save Portfolio Projects
    if (portfolioData.portfolio_projects) {
      const projTypes = ['beginner', 'intermediate', 'advanced', 'flagship'];
      for (const type of projTypes) {
        const proj = portfolioData.portfolio_projects[type];
        if (proj) {
          await db.run(`
            INSERT INTO projects (
              user_id, title, problem, architecture, features, folder_structure,
              tech_stack, difficulty, timeline, resume_bullet_points, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_started')
          `, [
            userId,
            proj.title,
            proj.problem,
            proj.architecture,
            JSON.stringify(proj.features || []),
            proj.folder_structure,
            proj.tech_stack,
            proj.difficulty || type,
            proj.timeline,
            JSON.stringify(proj.resume_bullet_points || []),
          ]);
        }
      }
    }

    // 7. Save Branding & Recruitment Reports
    const brandingReport = {
      resume_improvements: brandingData.resume_improvements,
      linkedin_headline: brandingData.linkedin_headline,
      linkedin_about: brandingData.linkedin_about,
      networking_strategy: brandingData.networking_strategy,
      interview_preparation: brandingData.interview_preparation,
      recommended_courses: portfolioData.recommended_courses,
      books: portfolioData.books,
      certifications: portfolioData.certifications
    };

    await db.run('INSERT INTO reports (user_id, report_type, data_json) VALUES (?, ?, ?)', [
      userId,
      'branding_audit',
      JSON.stringify(brandingReport)
    ]);

    // Save onboarding report raw snapshot
    const onboardingSnapshot = {
      profile: profileData,
      core: coreData,
      branding: brandingData,
      portfolio: portfolioData
    };
    await db.run('INSERT INTO reports (user_id, report_type, data_json) VALUES (?, ?, ?)', [
      userId,
      'onboarding',
      JSON.stringify(onboardingSnapshot)
    ]);

    // 8. Save Future Self Letter
    if (letterData && letterData.future_letter) {
      await db.run('INSERT INTO future_letters (user_id, letter_content, status, month_year) VALUES (?, ?, ?, ?)', [
        userId,
        letterData.future_letter,
        'unread',
        new Date().toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }).replace('/', '-')
      ]);
    }

    // 9. Save history logs & achievements
    await db.run('INSERT INTO history (user_id, action_type, description) VALUES (?, ?, ?)', [
      userId,
      'profile',
      'Onboarding completed. AI Career Roadmap fully generated and active.'
    ]);

    await db.run('INSERT INTO achievements (user_id, title, description) VALUES (?, ?, ?)', [
      userId,
      'Map Drawn',
      'Created your first career operating roadmap successfully.'
    ]);

    return res.status(200).json({
      message: 'Onboarding completed and Career OS workspace compiled successfully.',
      redirect: 'app.html'
    });
  } catch (error) {
    console.error('Onboarding profile setup error:', error);
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
