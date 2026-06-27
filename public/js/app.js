/* ==========================================================================
   CORE SAAS MAIN DESKTOP SHELL STATE ENGINE
   ========================================================================== */

import { initNavigation, navigateTo } from './navigation.js';

let activeDashboardState = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Authenticate user
    try {
        const res = await fetch('/api/auth/me');
        if (res.status === 401) {
            window.location.href = 'index.html';
            return;
        }
        const data = await res.json();
        if (!data.onboarded) {
            window.location.href = 'onboarding.html';
            return;
        }
        
        // Load initial theme setting
        if (data.settings && data.settings.theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            document.body.classList.add('light-theme');
        }
    } catch (err) {
        console.error('Session validation failed:', err);
        window.location.href = 'index.html';
        return;
    }

    // 2. Initialize SPA Navigation module
    initNavigation();

    // 3. Bind history comparison listener programmatically
    const compareBtn = document.getElementById('ui-history-compare-btn');
    if (compareBtn) {
        compareBtn.addEventListener('click', compareSelectedReports);
    }

    // 4. Fetch and render dashboard
    await refreshDashboard();
});

// REFRESH DASHBOARD DATA FROM BACKEND
async function refreshDashboard() {
    try {
        const res = await fetch('/api/profile/dashboard');
        if (!res.ok) {
            throw new Error('Failed to load dashboard payload.');
        }
        activeDashboardState = await res.json();
        
        // Hydrate all tabs
        hydrateSidebarAndOverview();
        await loadDailyTasks();
        hydrateRoadmap();
        hydrateWeeklyPlanner();
        hydrateDailyRoutine();
        hydrateSkillsGraph();
        hydrateProjects();
        hydrateBrandingAndResume();
        hydrateInterviewCoach();
        await loadMentorChatHistory();
        hydrateLetters();
        hydrateProgressAndAchievements();
        hydrateSettingsForm();
    } catch (err) {
        console.error('Error refreshing dashboard:', err);
        alert('Failed to connect to the FutureMe OS server. Make sure the Node server is running.');
    }
}

// HYDRATE SIDEBAR & OVERVIEW TAB
function hydrateSidebarAndOverview() {
    const { profile, roadmap, weeklyPlan } = activeDashboardState;
    if (!profile) return;

    // Sidebar
    document.getElementById('ui-side-name-badge').innerText = profile.full_name;

    // Overview
    document.getElementById('ui-dash-welcome-heading').innerText = `Welcome back, ${profile.full_name.split(' ')[0]}`;
    document.getElementById('ui-meta-target-job').innerText = `Targeting ${profile.dream_role} @ ${profile.dream_company}`;
    
    // Budget
    document.getElementById('ui-meta-hours-budget').innerText = profile.learning_time;
    document.getElementById('ui-meta-weakness-label').innerText = profile.biggest_struggles || 'Not defined';

    // Roadmap overview node
    if (roadmap && roadmap.phases && roadmap.phases.length > 0) {
        const currentPhase = roadmap.phases[0];
        document.getElementById('ui-dash-next-step').innerText = currentPhase.title;
        document.getElementById('ui-dash-next-date').innerText = `Target: ${currentPhase.estimated_date}`;
    }

    // Latest mentor quote / advice
    if (weeklyPlan && weeklyPlan.motivation) {
        document.getElementById('ui-dash-rec-text').innerText = `"${weeklyPlan.motivation}"`;
    }
}

// HYDRATE TODAY'S SPRINT TASKS
async function loadDailyTasks() {
    const container = document.getElementById('ui-tasks-list-container');
    if (!container) return;

    try {
        const res = await fetch('/api/tasks/daily');
        const data = await res.json();
        
        container.innerHTML = '';

        if (!data.tasks || data.tasks.length === 0) {
            container.innerHTML = `<p style="color: var(--text-secondary); text-align:center; padding: 20px;">All sprints complete for today! Enjoy your rest.</p>`;
            updateProgressPercentage(100);
            return;
        }

        data.tasks.forEach(task => {
            const isCompleted = task.status === 'completed';
            const isSkipped = task.status === 'skipped';
            
            const item = document.createElement('div');
            item.className = `list-task-item ${isCompleted ? 'completed' : ''} ${isSkipped ? 'skipped' : ''}`;
            item.innerHTML = `
                <div class="task-checkbox ${isCompleted ? 'checked' : ''}" onclick="toggleTaskCompletion(${task.id}, ${isCompleted})"></div>
                <div style="flex:1;">
                    <div class="task-text">${task.task_description}</div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${task.minutes_duration} mins | Status: ${task.status}</span>
                </div>
                <div style="display:flex; gap:8px;">
                    ${!isCompleted && !isSkipped ? `
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="postponeTask(${task.id})">Postpone</button>
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; color:var(--color-danger); border-color:rgba(255,93,93,0.2);" onclick="skipTask(${task.id})">Skip</button>
                    ` : ''}
                </div>
            `;
            container.appendChild(item);
        });

        // Update progress wheel in dashboard
        updateProgressPercentage(data.metrics.completionRate);

    } catch (err) {
        console.error('Error fetching daily tasks:', err);
    }
}

function updateProgressPercentage(rate) {
    const text = document.getElementById('ui-dash-progress-text');
    const fill = document.getElementById('ui-dash-progress-fill');
    if (text) text.innerText = `${rate}%`;
    if (fill) {
        const offset = 251.2 - (251.2 * rate / 100);
        fill.style.strokeDashoffset = offset;
    }
}

// TOGGLE TASK STATUS
async function toggleTaskCompletion(taskId, currentlyCompleted) {
    if (currentlyCompleted) return;
    
    try {
        const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            if (data.skillGrown) {
                alert(`Task complete! Skill progress unlocked for: "${data.skillGrown}" (+4%)`);
            }
            await refreshDashboard();
        } else {
            alert(data.error);
        }
    } catch (err) {
        console.error('Toggle task complete error:', err);
    }
}

async function postponeTask(taskId) {
    try {
        const res = await fetch(`/api/tasks/${taskId}/postpone`, { method: 'POST' });
        if (res.ok) {
            alert('Task postponed to tomorrow.');
            await refreshDashboard();
        }
    } catch (err) {
        console.error(err);
    }
}

async function skipTask(taskId) {
    try {
        const res = await fetch(`/api/tasks/${taskId}/skip`, { method: 'POST' });
        if (res.ok) {
            await refreshDashboard();
        }
    } catch (err) {
        console.error(err);
    }
}

// HYDRATE ROADMAP TIMELINE
function hydrateRoadmap() {
    const container = document.getElementById('ui-roadmap-timeline-container');
    if (!container) return;

    const { roadmap } = activeDashboardState;
    container.innerHTML = '';

    if (!roadmap || !roadmap.phases) {
        container.innerHTML = `<p>No career roadmap configured.</p>`;
        return;
    }

    roadmap.phases.forEach((phase, index) => {
        const node = document.createElement('div');
        node.className = `timeline-node ${index === 0 ? 'complete' : ''}`;
        
        let milestonesHTML = '';
        if (phase.milestones) {
            phase.milestones.forEach(m => {
                milestonesHTML += `<li style="font-size:0.85rem; margin-top:4px; color:var(--text-secondary); list-style:square; margin-left: 16px;">${m}</li>`;
            });
        }

        node.innerHTML = `
            <h3 style="font-size:1.1rem; color: ${index === 0 ? 'var(--color-success)' : 'var(--accent-secondary)'};">
                Phase ${phase.phase_number || index + 1}: ${phase.title}
            </h3>
            <p style="font-size:0.85rem; color: var(--text-muted); margin-top:2px;">Target date: ${phase.estimated_date}</p>
            <p style="font-size:0.925rem; color: var(--text-primary); margin-top:8px;">${phase.description}</p>
            <ul style="margin-top:8px;">${milestonesHTML}</ul>
        `;
        container.appendChild(node);
    });
}

// HYDRATE WEEKLY PLANNER CALENDAR
function hydrateWeeklyPlanner() {
    const grid = document.getElementById('ui-weekly-planner-grid');
    if (!grid) return;

    const { weeklyPlan } = activeDashboardState;
    grid.innerHTML = '';

    if (!weeklyPlan || !weeklyPlan.weekly_routine) {
        grid.innerHTML = `<p>No planner scheduled.</p>`;
        return;
    }

    weeklyPlan.weekly_routine.forEach(dayRoutine => {
        const col = document.createElement('div');
        col.className = 'planner-day-column';
        
        let tasksHTML = '';
        if (dayRoutine.tasks) {
            dayRoutine.tasks.forEach(t => {
                tasksHTML += `<div class="planner-block-item" style="font-size:0.8rem; padding:6px 10px; margin-top:8px;">${t}</div>`;
            });
        }

        col.innerHTML = `
            <div class="planner-day-header">${dayRoutine.day.substring(0, 3)}</div>
            ${tasksHTML}
        `;
        grid.appendChild(col);
    });
}

// HYDRATE DAILY ROUTINES LIST
function hydrateDailyRoutine() {
    const container = document.getElementById('ui-daily-routine-container');
    if (!container) return;

    const { weeklyPlan } = activeDashboardState;
    container.innerHTML = '';

    if (!weeklyPlan || !weeklyPlan.daily_routine) {
        container.innerHTML = `<p>No routine configurations built.</p>`;
        return;
    }

    weeklyPlan.daily_routine.forEach((r, idx) => {
        const item = document.createElement('div');
        item.style.borderLeft = `2px solid ${idx % 2 === 0 ? 'var(--accent)' : 'var(--accent-secondary)'}`;
        item.style.paddingLeft = '16px';
        item.innerHTML = `
            <strong style="font-size:0.9rem; display:block; color:#FFF;">${r.time_slot} Block</strong>
            <span style="font-size:0.85rem; color: var(--text-secondary);">${r.description}</span>
        `;
        container.appendChild(item);
    });
}

// HYDRATE SKILLS PROGRESS
function hydrateSkillsGraph() {
    const container = document.getElementById('ui-skills-list-container');
    if (!container) return;

    const { skills } = activeDashboardState;
    container.innerHTML = '<h3>Skills Telemetry</h3>';

    if (!skills || skills.length === 0) {
        container.innerHTML += `<p>No telemetry active.</p>`;
        return;
    }

    skills.forEach(s => {
        const row = document.createElement('div');
        row.className = 'skill-bar-row';
        
        let color = 'var(--accent)';
        if (s.proficiency_percentage < 50) color = 'var(--color-danger)';
        else if (s.proficiency_percentage > 75) color = 'var(--color-success)';

        row.innerHTML = `
            <div class="skill-meta-label">
                <span>${s.skill_name}</span>
                <span>${s.proficiency_percentage}%</span>
            </div>
            <div class="skill-bar-track">
                <div class="skill-bar-fill-indicator" style="width:${s.proficiency_percentage}%; background: ${color};"></div>
            </div>
        `;
        container.appendChild(row);
    });
}

// HYDRATE CURATED PORTFOLIO PROJECTS
function hydrateProjects() {
    const container = document.getElementById('ui-projects-grid-container');
    if (!container) return;

    const { projects } = activeDashboardState;
    container.innerHTML = '';

    if (!projects || projects.length === 0) {
        container.innerHTML = `<p>No projects configured.</p>`;
        return;
    }

    projects.forEach(p => {
        const card = document.createElement('div');
        card.className = 'app-card';
        
        let featuresHTML = '';
        if (p.features) {
            p.features.forEach(f => {
                featuresHTML += `<li style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">${f}</li>`;
            });
        }

        let bulletsHTML = '';
        if (p.resume_bullet_points) {
            p.resume_bullet_points.forEach(b => {
                bulletsHTML += `<li style="font-size:0.8rem; font-style:italic; color:var(--accent-secondary); margin-top:2px;">"${b}"</li>`;
            });
        }

        let selectStatus = `
            <select style="background:var(--bg-secondary); border:1px solid var(--border-glow); color:#FFF; padding:6px; border-radius:4px; font-size:0.8rem;" onchange="updateProjectStatus(${p.id}, this.value)">
                <option value="not_started" ${p.status === 'not_started' ? 'selected' : ''}>Not Started</option>
                <option value="in_progress" ${p.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="completed" ${p.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
        `;

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <span style="font-size:0.7rem; color:var(--accent); font-weight:700; text-transform:uppercase;">${p.difficulty} Build</span>
                ${selectStatus}
            </div>
            <h3 style="font-size:1.15rem; margin-bottom:6px;">${p.title}</h3>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;"><strong>Challenge:</strong> ${p.problem}</p>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:6px;"><strong>Architecture:</strong> ${p.architecture}</p>
            <p style="font-size:0.85rem; color:var(--text-primary); margin-bottom:4px;"><strong>Target Stack:</strong> ${p.tech_stack} (Time: ${p.timeline})</p>
            
            <div style="margin-top:10px;">
                <strong style="font-size:0.8rem; color:#FFF; display:block;">Key Features:</strong>
                <ul style="padding-left:14px; margin-bottom:8px;">${featuresHTML}</ul>
            </div>
            
            <div style="margin-top:10px;">
                <strong style="font-size:0.8rem; color:#FFF; display:block;">Recommended Folder Architecture:</strong>
                <pre style="background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; font-size:0.75rem; font-family:monospace; color:var(--accent-secondary); margin-top:4px; overflow-x:auto;">${p.folder_structure}</pre>
            </div>

            <div style="margin-top:12px;">
                <strong style="font-size:0.8rem; color:#FFF; display:block;">ATS Resume Impact Wording:</strong>
                <ul style="padding-left:14px;">${bulletsHTML}</ul>
            </div>
        `;
        container.appendChild(card);
    });
}

// UPDATE PROJECT STATUS ON BACKEND
async function updateProjectStatus(projectId, status) {
    try {
        const res = await fetch(`/api/projects/${projectId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            alert('Project build status updated.');
            await refreshDashboard();
        }
    } catch (err) {
        console.error(err);
    }
}

// HYDRATE RESUME AND LINKEDIN SUGGESTIONS
function hydrateBrandingAndResume() {
    const { branding } = activeDashboardState;
    if (!branding) return;

    // Resume Suggestions
    const resumeContainer = document.getElementById('ui-resume-improvements-container');
    if (resumeContainer) {
        resumeContainer.innerHTML = '<h3>ATS Suggested Bullet Corrections</h3>';
        if (branding.resume_improvements) {
            branding.resume_improvements.forEach(item => {
                const block = document.createElement('div');
                block.style.marginTop = '16px';
                block.style.borderBottom = '1px solid var(--border-subtle)';
                block.style.paddingBottom = '12px';
                block.innerHTML = `
                    <p style="font-size:0.85rem; line-height:1.4; color:var(--text-secondary);"><strong style="color:var(--color-danger);">Replace:</strong> "${item.current_wording}"</p>
                    <p style="font-size:0.85rem; line-height:1.4; color:var(--text-secondary); margin-top:4px;"><strong style="color:var(--color-success);">With:</strong> "${item.suggested_wording}"</p>
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:2px;">Reason: ${item.impact_reason}</span>
                `;
                resumeContainer.appendChild(block);
            });
        }
    }

    // LinkedIn Headline & Bio
    const headlineBox = document.getElementById('ui-linkedin-headline');
    const aboutBox = document.getElementById('ui-linkedin-about');
    const outreachBox = document.getElementById('ui-linkedin-posts');

    if (headlineBox) headlineBox.innerText = branding.linkedin_headline || 'No headline active';
    if (aboutBox) aboutBox.innerText = branding.linkedin_about || 'No biographic summary active';
    
    if (outreachBox && branding.networking_strategy) {
        outreachBox.innerHTML = '<h3>Networking & Outreach Strategy</h3>';
        branding.networking_strategy.forEach(s => {
            outreachBox.innerHTML += `
                <div style="margin-top:12px;">
                    <strong style="color:#FFF; font-size:0.85rem; display:block;">- ${s.action_item}</strong>
                    <span style="font-size:0.8rem; color:var(--text-secondary);">${s.description}</span>
                </div>
            `;
        });
    }
}

// HYDRATE INTERVIEW COACH QUESTIONS
function hydrateInterviewCoach() {
    const container = document.getElementById('ui-interview-coach-container');
    if (!container) return;

    const { branding } = activeDashboardState;
    container.innerHTML = '';

    if (!branding || !branding.interview_preparation) {
        container.innerHTML = `<p>No prep questions loaded.</p>`;
        return;
    }

    branding.interview_preparation.forEach((q, idx) => {
        const block = document.createElement('div');
        block.className = 'app-card';
        block.innerHTML = `
            <span style="font-size:0.7rem; color:var(--accent-secondary); font-weight:700; text-transform:uppercase;">${q.type}</span>
            <h3 style="font-size:1rem; margin-top:4px;">${q.question}</h3>
            
            <button class="btn btn-secondary" style="padding: 6px 12px; font-size:0.75rem; margin-top:12px;" onclick="document.getElementById('coach-ans-${idx}').style.display = 'block'; this.style.display = 'none';">Show Hint & Example Answer</button>
            
            <div id="coach-ans-${idx}" style="display:none; margin-top:12px;">
                <p style="font-size:0.8rem; color:var(--accent); font-weight:600;">Strategy Tip:</p>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">${q.strategy_hint}</p>
                <p style="font-size:0.8rem; color:var(--color-success); font-weight:600;">Sample Answer:</p>
                <p style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">"${q.example_answer}"</p>
            </div>
        `;
        container.appendChild(block);
    });
}

// LOAD MENTOR CHAT TRANSCRIPTS
async function loadMentorChatHistory() {
    const scroller = document.getElementById('ui-chat-scroller-node');
    if (!scroller) return;

    try {
        const res = await fetch('/api/mentor/chat');
        const data = await res.json();
        
        scroller.innerHTML = '';
        data.history.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${msg.sender === 'user' ? 'user' : 'assistant'}`;
            bubble.innerText = msg.message;
            scroller.appendChild(bubble);
        });

        scroller.scrollTop = scroller.scrollHeight;
    } catch (err) {
        console.error(err);
    }
}

// SEND CHAT MESSAGE TO AI MENTOR
async function sendUserChatMessage() {
    const input = document.getElementById('ui-chat-input-node');
    const sendBtn = document.getElementById('ui-chat-send-btn');
    const scroller = document.getElementById('ui-chat-scroller-node');
    
    const text = input.value.trim();
    if (!text) return;

    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.innerText = text;
    scroller.appendChild(userBubble);
    scroller.scrollTop = scroller.scrollHeight;
    
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'chat-bubble assistant';
    loadingBubble.innerText = 'Typing advice...';
    scroller.appendChild(loadingBubble);
    scroller.scrollTop = scroller.scrollHeight;

    try {
        const res = await fetch('/api/mentor/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const data = await res.json();

        scroller.removeChild(loadingBubble);

        const assistantBubble = document.createElement('div');
        assistantBubble.className = 'chat-bubble assistant';
        
        if (res.ok) {
            assistantBubble.innerText = data.message;
        } else {
            assistantBubble.innerText = data.error || 'System is offline.';
        }
        
        scroller.appendChild(assistantBubble);
        scroller.scrollTop = scroller.scrollHeight;
    } catch (err) {
        console.error(err);
        scroller.removeChild(loadingBubble);
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// HYDRATE FUTURE LETTERS LIST
let lettersCache = [];
function hydrateLetters() {
    const list = document.getElementById('ui-letters-history-list');
    const body = document.getElementById('ui-active-letter-body');
    if (!list || !body) return;

    const { letters } = activeDashboardState;
    list.innerHTML = '';
    lettersCache = letters || [];

    if (lettersCache.length === 0) {
        body.innerHTML = `<p style="text-align:center; padding: 40px; color:var(--text-secondary);">No letters generated yet. Finish task milestones to trigger monthly self-letters.</p>`;
        return;
    }

    lettersCache.forEach((letter, idx) => {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.style.padding = '10px';
        li.style.borderRadius = '4px';
        li.style.border = '1px solid var(--border-glow)';
        li.style.background = idx === 0 ? 'rgba(124, 92, 255, 0.15)' : 'rgba(0,0,0,0.1)';
        li.innerHTML = `
            <strong>Letter for ${letter.month_year}</strong>
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Received: ${new Date(letter.created_at).toLocaleDateString()}</span>
        `;
        li.onclick = () => showLetterDetails(letter.id, li);
        list.appendChild(li);
    });

    displayLetterContent(lettersCache[0]);
}

function displayLetterContent(letter) {
    const body = document.getElementById('ui-active-letter-body');
    if (!letter || !body) return;

    body.innerHTML = `
        <div style="font-family: serif; font-size:1.1rem; line-height:1.6; color:#EEE;">
            <p style="margin-bottom:12px;">Dear Self,</p>
            <p style="white-space: pre-line;">${letter.letter_content}</p>
            <div class="letter-sheet-signature-line" style="margin-top:30px; border-top:1px dashed var(--border-glow); padding-top:12px; font-style:italic; font-size:0.95rem; text-align:right;">
                Your Future Self
            </div>
        </div>
    `;
}

async function showLetterDetails(letterId, liElement) {
    document.querySelectorAll('#ui-letters-history-list li').forEach(el => el.style.background = 'rgba(0,0,0,0.1)');
    liElement.style.background = 'rgba(124, 92, 255, 0.15)';

    const letter = lettersCache.find(l => l.id === letterId);
    displayLetterContent(letter);

    if (letter && letter.status === 'unread') {
        try {
            await fetch(`/api/letters/${letterId}/read`, { method: 'POST' });
        } catch (e) {}
    }
}

// FORCE GENERATE A FUTURE LETTER
async function triggerNextFutureLetter() {
    const btn = document.getElementById('ui-letter-generate-btn');
    btn.disabled = true;
    btn.innerText = "AI generating letter...";
    try {
        const res = await fetch('/api/letters/generate', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert('Your Future Self has written you a new progress letter!');
            await refreshDashboard();
        } else {
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerText = "Generate Next Month's Letter";
    }
}

// HYDRATE STATISTICS HEATMAP AND ACHIEVEMENTS
function hydrateProgressAndAchievements() {
    const heatmap = document.getElementById('ui-progress-heatmap');
    const achievementsContainer = document.getElementById('ui-achievements-list-container');
    
    const { achievements } = activeDashboardState;

    if (heatmap) {
        heatmap.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const cell = document.createElement('div');
            cell.className = 'heatmap-box-cell';
            
            const levels = ['', 'lvl-1', 'lvl-2', 'lvl-3', 'lvl-4'];
            const randLvl = levels[Math.floor(Math.random() * levels.length)];
            if (randLvl) cell.classList.add(randLvl);
            
            heatmap.appendChild(cell);
        }
    }

    if (achievementsContainer) {
        achievementsContainer.innerHTML = '';
        if (!achievements || achievements.length === 0) {
            achievementsContainer.innerHTML = `<p style="font-size:0.85rem; color:var(--text-secondary);">No achievements unlocked. Complete daily sprints to unlock accomplishments.</p>`;
            return;
        }

        achievements.forEach(a => {
            const card = document.createElement('div');
            card.style.background = 'rgba(0,0,0,0.15)';
            card.style.border = '1px solid var(--border-glow)';
            card.style.padding = '12px';
            card.style.borderRadius = '6px';
            card.innerHTML = `
                <strong style="color:var(--color-success); font-size:0.9rem; display:block;">✔ ${a.title}</strong>
                <span style="font-size:0.8rem; color:var(--text-secondary);">${a.description}</span>
                <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:4px;">Unlocked: ${new Date(a.unlocked_at).toLocaleDateString()}</span>
            `;
            achievementsContainer.appendChild(card);
        });
    }
}

// WEEKLY CHECK-IN ACCOUNTABILITY FORM SUBMIT
async function submitWeeklyCheckin(event) {
    event.preventDefault();
    const btn = document.getElementById('ui-checkin-submit-btn');
    const status = document.getElementById('ui-checkin-status').value;
    const feedback = document.getElementById('ui-checkin-feedback').value;
    const resultBox = document.getElementById('ui-checkin-result-box');
    const resultText = document.getElementById('ui-checkin-feedback-text');

    btn.disabled = true;
    btn.innerText = "Analyzing Checklist...";

    try {
        const res = await fetch('/api/tasks/weekly-checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                goals_completed: status,
                feedback_notes: feedback
            })
        });
        const data = await res.json();
        
        btn.disabled = false;
        btn.innerText = "Submit Check-in";

        if (res.ok) {
            resultBox.style.display = 'block';
            resultText.innerText = `${data.aiReview}\n\nDifficulty Action: ${data.difficultyAdjustment}`;
            document.getElementById('ui-checkin-feedback').value = '';
            await refreshDashboard();
        } else {
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.innerText = "Submit Check-in";
    }
}

// HYDRATE SETTINGS FORM
function hydrateSettingsForm() {
    const { profile, settings } = activeDashboardState;
    if (!profile || !settings) return;

    document.getElementById('setting-name').value = profile.full_name;
    document.getElementById('setting-role').value = profile.current_role || '';
    document.getElementById('setting-theme').value = settings.theme || 'dark';
    document.getElementById('setting-reminder').value = settings.reminder_time || '09:00';
    document.getElementById('setting-notify').checked = settings.notify_email === 1;
}

// SAVE WORKSPACE SETTINGS
async function saveWorkspaceSettings(event) {
    event.preventDefault();
    
    const payload = {
        full_name: document.getElementById('setting-name').value,
        current_role: document.getElementById('setting-role').value,
        theme: document.getElementById('setting-theme').value,
        reminder_time: document.getElementById('setting-reminder').value,
        notify_email: document.getElementById('setting-notify').checked ? 1 : 0
    };

    try {
        const res = await fetch('/api/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert('Settings saved.');
            window.location.reload();
        } else {
            const data = await res.json();
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
    }
}

// LOGOUT
async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = 'index.html';
    } catch (err) {
        console.error(err);
    }
}

// DELETE ACCOUNT
async function triggerDeleteAccount() {
    if (confirm('Are you absolutely sure you want to request deletion of this career operating system?')) {
        try {
            const res = await fetch('/api/settings/delete-account', { method: 'POST' });
            const data = await res.json();
            alert(data.message);
        } catch (e) {}
    }
}

// ==========================================================================
// SPA MODULE: HYDRATE HISTORY & REPORT COMPARISONS
// ==========================================================================

async function hydrateHistoryTab() {
    const list = document.getElementById('ui-history-reports-list');
    if (!list) return;

    try {
        const res = await fetch('/api/history/reports');
        const data = await res.json();
        
        list.innerHTML = '';
        if (!data.reports || data.reports.length === 0) {
            list.innerHTML = '<p style="font-size:0.85rem; color:var(--text-secondary);">No reports generated yet.</p>';
            return;
        }

        data.reports.forEach(r => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '8px';
            item.style.padding = '8px';
            item.style.borderRadius = '4px';
            item.style.border = '1px solid var(--border-glow)';
            item.style.background = 'rgba(0,0,0,0.1)';
            item.innerHTML = `
                <input type="checkbox" name="history-report" value="${r.id}" style="width:16px; height:16px;">
                <label style="font-size:0.85rem; color:var(--text-primary); cursor:pointer; flex:1;">
                    <strong>${r.report_type.replace('_', ' ').toUpperCase()}</strong>
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Generated: ${new Date(r.created_at).toLocaleDateString()}</span>
                </label>
            `;
            list.appendChild(item);
        });
    } catch (err) {
        console.error('Failed to load history list:', err);
    }
}

async function compareSelectedReports() {
    const checkboxes = document.querySelectorAll('input[name="history-report"]:checked');
    const selectedIds = Array.from(checkboxes).map(el => el.value);
    
    const resultBox = document.getElementById('ui-history-comparison-result');
    const content = document.getElementById('ui-history-comparison-content');
    
    if (selectedIds.length !== 2) {
        alert('Please select exactly 2 reports to compare.');
        return;
    }

    content.innerHTML = '<p style="font-size:0.85rem; color:var(--text-secondary);">Analyzing report differences...</p>';
    resultBox.style.display = 'block';

    try {
        const res = await fetch(`/api/history/compare/${selectedIds[0]}/${selectedIds[1]}`);
        const data = await res.json();

        content.innerHTML = '';
        if (!res.ok) {
            content.innerHTML = `<p style="color:var(--color-danger);">${data.error || 'Failed to compare reports.'}</p>`;
            return;
        }

        const comp = data.comparison;
        let diffHTML = `
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">
                Comparing <strong>${comp.report1.type.replace('_', ' ').toUpperCase()}</strong> (${new Date(comp.report1.date).toLocaleDateString()}) 
                vs <strong>${comp.report2.type.replace('_', ' ').toUpperCase()}</strong> (${new Date(comp.report2.date).toLocaleDateString()})
            </p>
        `;

        comp.changes.forEach(c => {
            if (c.metric) {
                diffHTML += `
                    <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border-glow); padding:12px; border-radius:6px; margin-top:8px;">
                        <strong style="font-size:0.9rem; display:block; color:#FFF; border-bottom:1px solid var(--border-subtle); padding-bottom:4px; margin-bottom:6px;">${c.metric}</strong>
                        ${c.old_value !== undefined ? `
                            <span style="font-size:0.85rem; color:var(--color-danger); display:block;">Old: ${c.old_value}</span>
                            <span style="font-size:0.85rem; color:var(--color-success); display:block;">New: ${c.new_value} (Diff: ${c.difference > 0 ? '+' + c.difference : c.difference})</span>
                        ` : `
                            <span style="font-size:0.85rem; color:var(--text-secondary); line-height:1.4;">${c.details || ''}</span>
                        `}
                    </div>
                `;
            }
        });

        content.innerHTML = diffHTML;
    } catch (err) {
        console.error(err);
        content.innerHTML = '<p style="color:var(--color-danger);">Failed to parse comparison report.</p>';
    }
}

// EXPOSE UTILITIES TO WINDOW SCOPE (SAFE HYBRID SPA PATTERN)
window.handleLogout = handleLogout;
window.triggerDeleteAccount = triggerDeleteAccount;
window.submitWeeklyCheckin = submitWeeklyCheckin;
window.saveWorkspaceSettings = saveWorkspaceSettings;
window.sendUserChatMessage = sendUserChatMessage;
window.triggerNextFutureLetter = triggerNextFutureLetter;
window.showLetterDetails = showLetterDetails;
window.updateProjectStatus = updateProjectStatus;
window.toggleTaskCompletion = toggleTaskCompletion;
window.postponeTask = postponeTask;
window.skipTask = skipTask;

// Expose hydration for modular navigation callbacks
window.hydrateHistoryTab = hydrateHistoryTab;
window.compareSelectedReports = compareSelectedReports;