/**
 * Database & Transaction Service for FutureMe OS onboarding.
 * Manages database writes with transactional rollback security and concurrency serialization.
 */

// Helper to format date
function getFutureDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

// Structured logging helper
function logStep(stepName, status, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[ONBOARDING_LOG] [${timestamp}] [${stepName}] [${status}] ${JSON.stringify(details)}`);
}

// Simple Mutex for serializing SQLite transactions on a single connection
class Mutex {
  constructor() {
    this.queue = [];
    this.locked = false;
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift();
      nextResolve();
    } else {
      this.locked = false;
    }
  }
}

const dbWriteMutex = new Mutex();

/**
 * Saves all profile and AI roadmap data inside a secure database transaction.
 * Rolls back on error to ensure database integrity.
 * @param {Object} db - Database connection
 * @param {number|string} userId - User ID
 * @param {Object} profileData - Raw profile form inputs
 * @param {string} resumePath - Path to uploaded resume
 * @param {Object} coreData - Core roadmap and routine details
 * @param {Object} brandingData - Resume and LinkedIn audit reports
 * @param {Object} portfolioData - Projects and learning resources
 * @param {Object} letterData - Stored Future Self letter
 */
async function saveOnboardingData(db, userId, profileData, resumePath, coreData, brandingData, portfolioData, letterData) {
  await dbWriteMutex.acquire();
  
  try {
    logStep('DATABASE_TRANSACTION', 'START', { userId });
    await db.run('BEGIN TRANSACTION');

    try {
      // 1. Check if profile exists and perform cascade cleanups
      const existingProfile = await db.get('SELECT id FROM profiles WHERE user_id = ?', [userId]);
      if (existingProfile) {
        logStep('PROFILE_CLEANUP', 'START', { userId });
        await db.run('DELETE FROM profiles WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM goals WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM skills WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM skill_progress WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM roadmaps WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM projects WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM weekly_plans WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM daily_tasks WHERE user_id = ?', [userId]);
        await db.run('DELETE FROM future_letters WHERE user_id = ?', [userId]);
        logStep('PROFILE_CLEANUP', 'SUCCESS', { userId });
      }

      // 2. Save profile baseline with career summary
      logStep('PROFILE_CREATION', 'START', { userId });
      await db.run(`
        INSERT INTO profiles (
          user_id, full_name, age, country, current_role, dream_role, dream_company,
          expected_salary, learning_time, portfolio_url, github_url, linkedin_url,
          resume_path, learning_style, current_projects, confidence_level,
          biggest_struggles, preferred_mentor_style, career_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        profileData.full_name,
        profileData.age ? parseInt(profileData.age) : null,
        profileData.country,
        profileData.current_role,
        profileData.dream_role,
        profileData.dream_company,
        profileData.expected_salary,
        profileData.learning_time,
        profileData.portfolio_url,
        profileData.github_url,
        profileData.linkedin_url,
        resumePath,
        profileData.learning_style,
        profileData.current_projects,
        profileData.confidence_level,
        profileData.biggest_struggles,
        profileData.preferred_mentor_style,
        coreData.career_summary
      ]);
      logStep('PROFILE_CREATION', 'SUCCESS', { userId, full_name: profileData.full_name });

      // 3. Save Skills & Progress Telemetry
      let skillCount = 0;
      if (coreData.skill_gap_analysis && Array.isArray(coreData.skill_gap_analysis)) {
        logStep('DATABASE_INSERTS', 'START', { table: 'skills', userId });
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
          skillCount++;
        }
        logStep('DATABASE_INSERTS', 'SUCCESS', { table: 'skills', count: skillCount });
      }

      // 4. Save Career Roadmap
      logStep('ROADMAP_CREATION', 'START', { userId });
      await db.run('INSERT INTO roadmaps (user_id, roadmap_json) VALUES (?, ?)', [
        userId,
        JSON.stringify(coreData.roadmap)
      ]);
      logStep('ROADMAP_CREATION', 'SUCCESS', { userId });

      // Save milestones as goals
      let goalCount = 0;
      if (coreData.roadmap && coreData.roadmap.phases) {
        logStep('DATABASE_INSERTS', 'START', { table: 'goals', userId });
        for (const phase of coreData.roadmap.phases) {
          if (phase.milestones) {
            for (const ms of phase.milestones) {
              await db.run('INSERT INTO goals (user_id, title, status, target_date) VALUES (?, ?, ?, ?)', [
                userId,
                ms,
                'pending',
                phase.estimated_date
              ]);
              goalCount++;
            }
          }
        }
        logStep('DATABASE_INSERTS', 'SUCCESS', { table: 'goals', count: goalCount });
      }

      // 5. Save Weekly Planner & Daily Routines
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
      
      logStep('DATABASE_INSERTS', 'START', { table: 'weekly_plans', userId });
      await db.run('INSERT INTO weekly_plans (user_id, week_start_date, plan_json) VALUES (?, ?, ?)', [
        userId,
        getFutureDate(0),
        JSON.stringify(plannerPayload)
      ]);
      logStep('DATABASE_INSERTS', 'SUCCESS', { table: 'weekly_plans', count: 1 });

      // 6. Generate daily task entries in database for Week 1
      let taskCount = 0;
      if (coreData.weekly_routine) {
        logStep('DATABASE_INSERTS', 'START', { table: 'daily_tasks', userId });
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
              taskCount++;
            }
          }
        }
        logStep('DATABASE_INSERTS', 'SUCCESS', { table: 'daily_tasks', count: taskCount });
      }

      // 7. Save Portfolio Projects
      let projectCount = 0;
      if (portfolioData.portfolio_projects) {
        logStep('DATABASE_INSERTS', 'START', { table: 'projects', userId });
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
            projectCount++;
          }
        }
        logStep('DATABASE_INSERTS', 'SUCCESS', { table: 'projects', count: projectCount });
      }

      // 8. Save Branding & Recruitment Reports
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

      logStep('DATABASE_INSERTS', 'START', { table: 'reports (branding)', userId });
      await db.run('INSERT INTO reports (user_id, report_type, data_json) VALUES (?, ?, ?)', [
        userId,
        'branding_audit',
        JSON.stringify(brandingReport)
      ]);

      // Save onboarding report raw snapshot
      const onboardingSnapshot = {
        profile: {
          ...profileData,
          current_skills: profileData.current_skills || '',
          weak_skills: profileData.weak_skills || profileData.biggest_struggles || ''
        },
        core: coreData,
        branding: brandingData,
        portfolio: portfolioData
      };
      await db.run('INSERT INTO reports (user_id, report_type, data_json) VALUES (?, ?, ?)', [
        userId,
        'onboarding',
        JSON.stringify(onboardingSnapshot)
      ]);
      logStep('DATABASE_INSERTS', 'SUCCESS', { table: 'reports', count: 2 });

      // 9. Save Future Self Letter
      if (letterData && letterData.future_letter) {
        logStep('DATABASE_INSERTS', 'START', { table: 'future_letters', userId });
        await db.run('INSERT INTO future_letters (user_id, letter_content, status, month_year) VALUES (?, ?, ?, ?)', [
          userId,
          letterData.future_letter,
          'unread',
          new Date().toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }).replace('/', '-')
        ]);
        logStep('DATABASE_INSERTS', 'SUCCESS', { table: 'future_letters', count: 1 });
      }

      // 10. Save history logs & achievements
      logStep('DATABASE_INSERTS', 'START', { table: 'history & achievements', userId });
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
      logStep('DATABASE_INSERTS', 'SUCCESS', { table: 'history & achievements', count: 2 });

      // Commit transaction
      await db.run('COMMIT');
      logStep('DATABASE_TRANSACTION', 'COMMIT', { userId });
    } catch (dbErr) {
      console.error(`[ONBOARDING_LOG] [${new Date().toISOString()}] [DATABASE_TRANSACTION] [ROLLBACK] Error occurred: ${dbErr.message}`);
      await db.run('ROLLBACK');
      logStep('DATABASE_TRANSACTION', 'ROLLBACK', { userId, error: dbErr.message });
      throw dbErr;
    }
  } finally {
    dbWriteMutex.release();
  }
}

module.exports = {
  saveOnboardingData
};
