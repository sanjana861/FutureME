const { getDb } = require('../config/db');
const { callGemini } = require('../services/gemini');
const { weeklyReviewPrompt } = require('../prompts/templates');

// Helper to format date
function getLocalDateString(dateOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dateOffset);
  return d.toISOString().split('T')[0];
}

// GET DAILY TASKS
async function getDailyTasks(req, res) {
  const userId = req.user.id;
  const dateStr = req.query.date || getLocalDateString();
  const db = await getDb();

  try {
    const tasks = await db.all(
      'SELECT * FROM daily_tasks WHERE user_id = ? AND date = ?',
      [userId, dateStr]
    );

    // Calculate completion metrics
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return res.status(200).json({
      date: dateStr,
      tasks,
      metrics: {
        total,
        completed,
        completionRate
      }
    });
  } catch (error) {
    console.error('Get daily tasks error:', error);
    return res.status(500).json({ error: 'Failed to retrieve daily mission tasks.' });
  }
}

// COMPLETE TASK
async function completeTask(req, res) {
  const userId = req.user.id;
  const taskId = req.params.id;
  const db = await getDb();

  try {
    const task = await db.get('SELECT * FROM daily_tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found in daily records.' });
    }

    await db.run(
      'UPDATE daily_tasks SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [taskId]
    );

    // Dynamic Skill Growth: Increase a random skill's progress by 2%
    const skills = await db.all('SELECT id, skill_name, proficiency_percentage FROM skill_progress WHERE user_id = ?', [userId]);
    let skillGrown = null;
    let newPercentage = 0;

    if (skills.length > 0) {
      // Pick a random skill
      const randomIndex = Math.floor(Math.random() * skills.length);
      const chosenSkill = skills[randomIndex];
      newPercentage = Math.min(chosenSkill.proficiency_percentage + 4, 100);
      
      await db.run(
        'UPDATE skill_progress SET proficiency_percentage = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [newPercentage, chosenSkill.id]
      );
      skillGrown = chosenSkill.skill_name;
    }

    // Add history entry
    await db.run(
      'INSERT INTO history (user_id, action_type, description) VALUES (?, ?, ?)',
      [userId, 'task', `Completed mission task: "${task.task_description}". ${skillGrown ? `Skill '${skillGrown}' grew to ${newPercentage}%!` : ''}`]
    );

    // Check achievement: Complete 5 tasks
    const completedCountRow = await db.get('SELECT COUNT(*) as count FROM daily_tasks WHERE user_id = ? AND status = "completed"', [userId]);
    if (completedCountRow.count === 5) {
      const alreadyUnlocked = await db.get('SELECT id FROM achievements WHERE user_id = ? AND title = "Consistency Code"', [userId]);
      if (!alreadyUnlocked) {
        await db.run(
          'INSERT INTO achievements (user_id, title, description) VALUES (?, ?, ?)',
          [userId, 'Consistency Code', 'Completed 5 daily tasks. You are building momentum!']
        );
      }
    }

    return res.status(200).json({
      message: 'Task marked complete.',
      skillGrown,
      newProficiency: newPercentage
    });
  } catch (error) {
    console.error('Complete task error:', error);
    return res.status(500).json({ error: 'Database update failed.' });
  }
}

// SKIP TASK
async function skipTask(req, res) {
  const userId = req.user.id;
  const taskId = req.params.id;
  const db = await getDb();

  try {
    const task = await db.get('SELECT * FROM daily_tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found in daily records.' });
    }

    await db.run(
      'UPDATE daily_tasks SET status = "skipped", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [taskId]
    );

    await db.run(
      'INSERT INTO history (user_id, action_type, description) VALUES (?, ?, ?)',
      [userId, 'task', `Skipped task: "${task.task_description}"`]
    );

    return res.status(200).json({ message: 'Task marked skipped.' });
  } catch (error) {
    console.error('Skip task error:', error);
    return res.status(500).json({ error: 'Database update failed.' });
  }
}

// POSTPONE TASK (MOVE TO TOMORROW)
async function postponeTask(req, res) {
  const userId = req.user.id;
  const taskId = req.params.id;
  const db = await getDb();

  try {
    const task = await db.get('SELECT * FROM daily_tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found in daily records.' });
    }

    const tomorrowStr = getLocalDateString(1);

    // Update date to tomorrow, keeping it active (pending)
    await db.run(
      'UPDATE daily_tasks SET date = ?, status = "pending", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [tomorrowStr, taskId]
    );

    await db.run(
      'INSERT INTO history (user_id, action_type, description) VALUES (?, ?, ?)',
      [userId, 'task', `Postponed task: "${task.task_description}" to tomorrow (${tomorrowStr})`]
    );

    return res.status(200).json({
      message: `Task postponed to tomorrow (${tomorrowStr}).`
    });
  } catch (error) {
    console.error('Postpone task error:', error);
    return res.status(500).json({ error: 'Database update failed.' });
  }
}

// WEEKLY ACCOUNTABILITY CHECK-IN
async function submitWeeklyCheckin(req, res) {
  const userId = req.user.id;
  const { goals_completed, feedback_notes } = req.body; // 'yes', 'no', 'partial' and user text feedback
  const db = await getDb();

  if (!goals_completed) {
    return res.status(400).json({ error: 'Please answer if you completed your goals (yes/no/partial).' });
  }

  try {
    const profile = await db.get('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    // Query task history statistics from the last 7 days
    const stats = await db.get(`
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'skipped' THEN 1 END) as skipped,
        COUNT(CASE WHEN status = 'postponed' THEN 1 END) as postponed
      FROM daily_tasks 
      WHERE user_id = ? AND date >= date('now', '-7 days')
    `, [userId]);

    console.log('Sending weekly checklist statistics to accountability review AI...');
    let aiResponse;
    try {
      aiResponse = await callGemini(
        weeklyReviewPrompt(
          profile,
          stats.completed || 0,
          stats.skipped || 0,
          stats.postponed || 0,
          feedback_notes || 'No comments left.'
        )
      );
    } catch (aiErr) {
      console.error('AI checkin review failed:', aiErr);
      return res.status(502).json({ error: 'AI Accountability Engine timed out. Please try again.' });
    }

    // Save weekly accountability review to Reports
    await db.run('INSERT INTO reports (user_id, report_type, data_json) VALUES (?, ?, ?)', [
      userId,
      'weekly_review',
      JSON.stringify({
        stats,
        user_feedback: feedback_notes,
        ai_evaluation: aiResponse
      })
    ]);

    // Update settings or roadmap difficulty based on AI decision
    const difficultyAdjust = aiResponse.difficulty_adjustment; // increase, decrease, maintain
    let adjustmentMsg = 'Plan difficulty maintained.';

    if (difficultyAdjust === 'increase') {
      adjustmentMsg = 'AI coach has increased difficulty due to your high task compliance!';
      // Add achievement
      await db.run(
        'INSERT INTO achievements (user_id, title, description) VALUES (?, ?, ?)',
        [userId, 'Level Up', 'Unlocked higher difficulty tasks by satisfying weekly checkpoints.']
      );
    } else if (difficultyAdjust === 'decrease') {
      adjustmentMsg = 'AI coach simplified tasks to help you regain consistency.';
    }

    // Update weekly plan in weekly_plans table
    const weeklyPlanRow = await db.get('SELECT plan_json FROM weekly_plans WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
    if (weeklyPlanRow) {
      const plan = JSON.parse(weeklyPlanRow.plan_json);
      plan.weekly_routine = aiResponse.updated_weekly_routine;
      plan.motivation = aiResponse.feedback;
      plan.next_week_plan = aiResponse.next_week_plan;

      await db.run('INSERT INTO weekly_plans (user_id, week_start_date, plan_json) VALUES (?, ?, ?)', [
        userId,
        getLocalDateString(0),
        JSON.stringify(plan)
      ]);
    }

    // Generate daily tasks for the NEXT 7 days based on updated weekly routine
    if (aiResponse.updated_weekly_routine) {
      // Remove any pending tasks starting tomorrow to avoid overlaps
      const tomorrowStr = getLocalDateString(1);
      await db.run('DELETE FROM daily_tasks WHERE user_id = ? AND date >= ? AND status = "pending"', [userId, tomorrowStr]);

      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = new Date();
      
      for (let i = 1; i <= 7; i++) {
        const targetDate = new Date();
        targetDate.setDate(today.getDate() + i);
        const dayName = daysOfWeek[targetDate.getDay()];
        const dateStr = targetDate.toISOString().split('T')[0];

        const dayRoutine = aiResponse.updated_weekly_routine.find(d => d.day.toLowerCase() === dayName.toLowerCase());
        if (dayRoutine && dayRoutine.tasks) {
          for (const task of dayRoutine.tasks) {
            await db.run('INSERT INTO daily_tasks (user_id, task_description, status, minutes_duration, date) VALUES (?, ?, ?, ?, ?)', [
              userId,
              task,
              'pending',
              45,
              dateStr
            ]);
          }
        }
      }
    }

    // Log history
    await db.run('INSERT INTO history (user_id, action_type, description) VALUES (?, ?, ?)', [
      userId,
      'weekly_checkin',
      `Weekly check-in submitted. AI assessment: "${aiResponse.feedback.substring(0, 100)}...". ${adjustmentMsg}`
    ]);

    return res.status(200).json({
      message: 'Weekly review checkpoint finalized.',
      aiReview: aiResponse.feedback,
      difficultyAdjustment: adjustmentMsg,
      nextWeekFocus: aiResponse.next_week_plan
    });
  } catch (error) {
    console.error('Weekly checkin error:', error);
    return res.status(500).json({ error: 'Failed to process weekly accountability session.' });
  }
}

module.exports = {
  getDailyTasks,
  completeTask,
  skipTask,
  postponeTask,
  submitWeeklyCheckin
};
