/**
 * AI Generation Service for FutureMe OS onboarding.
 * Handles calls to Gemini API with retry logic, exponential backoff, and graceful fallbacks.
 */

const {
  coreStrategyPrompt,
  brandingPrompt,
  portfolioAndCurriculumPrompt,
  futureLetterPrompt
} = require('../prompts/templates');
const { callGemini } = require('./gemini');

// Helper to format date
function getFutureDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

/**
 * Executes a Gemini API function with exponential backoff retry.
 * Retries up to 3 times on HTTP 503 errors.
 */
async function callGeminiWithRetry(promptFn, profileData, retries = 3, initialDelayMs = 2000) {
  let attempt = 0;
  let delay = initialDelayMs;
  
  while (true) {
    try {
      const promptText = promptFn(profileData);
      return await callGemini(promptText);
    } catch (error) {
      attempt++;
      
      const is503 = error.status === 503 || 
                    (error.message && error.message.includes('503')) ||
                    (error.message && error.message.toLowerCase().includes('service unavailable'));
      
      console.error(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [ERROR] Attempt ${attempt} failed: ${error.message}`);
      
      if (is503 && attempt <= retries) {
        console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [RETRYING] HTTP 503 encountered. Retrying attempt ${attempt}/${retries} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Double the delay
      } else {
        throw error; // Propagate non-503 or exceeded retry errors
      }
    }
  }
}

/**
 * Fallback template for Core Strategy & Roadmap when AI is offline.
 */
function getFallbackCoreData(profile) {
  return {
    career_summary: `[Pending AI Generation] A custom roadmap strategy for ${profile.full_name} will be generated once AI systems are online. Currently utilizing foundational career guidance.`,
    roadmap: {
      phases: [
        {
          phase_number: 1,
          title: "Phase 1: Foundations (Pending Generation)",
          description: "Establish core goals, verify required tools/languages, and outline developmental milestones.",
          estimated_date: getFutureDate(30),
          milestones: [
            "Complete profile configuration",
            "Establish solid daily study routine",
            "Research primary language syntax"
          ]
        },
        {
          phase_number: 2,
          title: "Phase 2: Project Architecture (Pending Generation)",
          description: "Build intermediate application prototypes using simple REST API patterns.",
          estimated_date: getFutureDate(90),
          milestones: [
            "Build beginner portfolio website",
            "Develop local API service",
            "Publish project structures on GitHub"
          ]
        },
        {
          phase_number: 3,
          title: "Phase 3: Integration & Launch (Pending Generation)",
          description: "Refine resume structures, compile portfolio projects, and initiate active recruitment outreach.",
          estimated_date: getFutureDate(180),
          milestones: [
            "Optimize resume wording",
            "Conduct mock interview training",
            "Begin target company applications"
          ]
        }
      ]
    },
    plan_30_day: [
      { week: 1, focus: "Establish workspace environment & checklists", milestones: ["Review daily sprint lists", "Test code editor configurations"] },
      { week: 2, focus: "Foundational coding practices", milestones: ["Solve basic algorithmic problems", "Study design architecture docs"] },
      { week: 3, focus: "Intermediate REST principles", milestones: ["Build micro Express API", "Connect local JSON state stores"] },
      { week: 4, focus: "Consolidate learning milestones", milestones: ["Complete week-4 weekly audit checkin"] }
    ],
    plan_90_day: [
      { month: 1, focus: "Language core mastery", milestones: ["Complete beginner project configurations"] },
      { month: 2, focus: "SQL and relational storage integrations", milestones: ["Integrate local database stores (SQLite/PostgreSQL)"] },
      { month: 3, focus: "Advanced API styling", milestones: ["Secure route payloads using session JWT keys"] }
    ],
    plan_one_year: [
      { quarter: 1, focus: "Consolidate object-oriented principles" },
      { quarter: 2, focus: "Deploy full portfolio repository" },
      { quarter: 3, focus: "Establish professional LinkedIn branding and networks" },
      { quarter: 4, focus: "Execute direct applications and interview loops" }
    ],
    skill_gap_analysis: [
      { skill_name: "Core Coding Fundamentals", current_proficiency: 30, target_proficiency: 80, action_steps: "Complete online coding tutorials and solve algorithmic challenges." },
      { skill_name: "Database Schema Design", current_proficiency: 20, target_proficiency: 75, action_steps: "Study relational mappings and configure local sqlite stores." },
      { skill_name: "API Routing & HTTP", current_proficiency: 40, target_proficiency: 85, action_steps: "Implement RESTful controller routes and request validators." }
    ],
    weekly_routine: [
      { day: "Monday", tasks: ["Focus learning: study documentation and syntax", "Practice: write basic functional routines"] },
      { day: "Tuesday", tasks: ["Focus learning: watch architecture videos"] },
      { day: "Wednesday", tasks: ["Focus learning: study relational database models", "Practice: configure sqlite queries"] },
      { day: "Thursday", tasks: ["Focus learning: secure backend routes"] },
      { day: "Friday", tasks: ["Practice: compile weekly development code review"] },
      { day: "Saturday", tasks: ["Weekly check-in: submit accountability reviews"] },
      { day: "Sunday", tasks: ["Rest and planning: configure tasks for next sprint"] }
    ],
    daily_routine: [
      { time_slot: "Morning", description: "Review daily missions checklist & documentation (30 mins)" },
      { time_slot: "Evening", description: "Write practical modules & save progress (1.5 hours)" }
    ],
    motivation: "Your path is set. Although AI generation is pending, consistency remains the primary key to mastery.",
    personal_advice: `Set aside focused blocks daily to overcome: ${profile.biggest_struggles || 'staying consistent'}.`,
    common_mistakes: [
      "Skipping daily coding slots",
      "Focusing on styling instead of core logic",
      "Copy-pasting code without analyzing syntax"
    ]
  };
}

/**
 * Fallback template for Branding & Recruitment when AI is offline.
 */
function getFallbackBrandingData(profile) {
  return {
    resume_improvements: [
      {
        current_wording: "Assisted in code development",
        suggested_wording: `Optimized backend services matching target ${profile.dream_role} guidelines`,
        impact_reason: "Demonstrates proactive engineering ownership."
      }
    ],
    linkedin_headline: `Developer pursuing ${profile.dream_role} milestones | Future ${profile.dream_company} team member`,
    linkedin_about: `Focused developer training to build robust applications as a ${profile.dream_role}. I am mapping skills to meet requirements at ${profile.dream_company}.`,
    networking_strategy: [
      { action_item: "Identify profile benchmarks", description: `Research software profiles at ${profile.dream_company} to align professional styles.` }
    ],
    interview_preparation: [
      {
        question: "Describe a project challenge.",
        type: "Behavioral",
        strategy_hint: "Detail the problem, architecture constraints, action items, and final metrics.",
        example_answer: "In my recent developer tasks, I resolved database lock failures by decoupling controllers..."
      }
    ]
  };
}

/**
 * Fallback template for Portfolio Projects when AI is offline.
 */
function getFallbackPortfolioData(profile) {
  return {
    portfolio_projects: {
      beginner: {
        title: "Developer Portfolio Workspace",
        problem: "No centralized platform exists to present capabilities and target designs.",
        architecture: "Responsive frontend layout styled with vanilla CSS rules.",
        features: ["Dynamic project panel grid", "Contact response handler", "Self-profile description"],
        folder_structure: "index.html\ncss/app.css\njs/portfolio.js",
        tech_stack: "HTML, CSS, JavaScript",
        difficulty: "Beginner",
        timeline: "1 week",
        resume_bullet_points: ["Deployed clean responsive portfolio landing pages to serve project reviews."]
      },
      intermediate: {
        title: "Local Database File REST API",
        problem: "Need database backend capability to store checklist telemetry.",
        architecture: "Express router server utilizing file database serialization.",
        features: ["Task status CRUD routes", "Mock authentication headers", "JSON payload validators"],
        folder_structure: "server.js\nroutes/tasks.js\ncontrollers/taskController.js\ndata/store.json",
        tech_stack: "Node.js, Express, FS module",
        difficulty: "Intermediate",
        timeline: "3 weeks",
        resume_bullet_points: ["Configured intermediate Express backend architecture running custom JSON persistence."]
      },
      advanced: {
        title: "Relational Career OS Database Interface",
        problem: "Workspace requires secure user relations and transaction control.",
        architecture: "Express MVC structure with transactional database queries.",
        features: ["Hashed key checks", "SQLite foreign key validations", "Transaction rollbacks"],
        folder_structure: "config/db.js\ndatabase/init.js\ncontrollers/authController.js",
        tech_stack: "Node.js, Express, SQLite",
        difficulty: "Advanced",
        timeline: "4 weeks",
        resume_bullet_points: ["Implemented SQLite database relations with full transaction checks to ensure data integrity."]
      },
      flagship: {
        title: `AI-Driven Career OS (${profile.dream_role} Edition)`,
        problem: `Onboarding workflows must run reliably even when external AI API engines fail.`,
        architecture: "Decoupled service modules integrating automatic retry delays and fallbacks.",
        features: ["Parallel promise resolution", "Exponential retry routines", "Fallback payload generation"],
        folder_structure: "services/aiService.js\nservices/dbService.js\ncontrollers/profileController.js",
        tech_stack: "Node.js, Express, SQLite, JWT, Gemini API",
        difficulty: "Flagship",
        timeline: "8 weeks",
        resume_bullet_points: ["Engineered robust AI-driven onboarding pipelines with backoff retry handlers and automated database transactions."]
      }
    },
    recommended_courses: [
      { title: `Software Development Fundamentals`, provider: "Coursera", rationale: "Solidifies core computer science concepts." }
    ],
    books: [
      { title: "Clean Architecture", author: "Robert C. Martin", rationale: "Teaches separation of concerns." }
    ],
    certifications: [
      { title: "Full Stack Developer", issuer: "AWS/Google/Microsoft", rationale: "Validates cloud developer capabilities." }
    ]
  };
}

/**
 * Fallback template for Future Self Letter when AI is offline.
 */
function getFallbackLetterData(profile) {
  return {
    future_letter: `Dear ${profile.full_name || 'self'},

I am writing this to you from the future, where I am successfully working at ${profile.dream_company} as a ${profile.dream_role}. I know you are working hard right now and sometimes struggle with ${profile.biggest_struggles || 'staying consistent'}, but please know that every small step counts.

Even though our initial AI generation was delayed, the placeholder roadmap you have in front of you is a perfect start. The primary key to reaching where I am today is not complex algorithms—it is showing up day after day and building your skills step by step.

I believe in you. Focus on the daily tasks, submit your weekly check-ins, and keep your vision clear. I am waiting for you here in the future!

Your Future Self`
  };
}

/**
 * Coordinates the full AI generation process.
 * Decouples AI generation from database writes, falling back gracefully if AI is offline.
 */
async function generateOnboardingAI(profileData) {
  console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [START] Initiating parallel Gemini API calls...`);
  
  const [coreResult, brandingResult, portfolioResult] = await Promise.allSettled([
    callGeminiWithRetry(coreStrategyPrompt, profileData),
    callGeminiWithRetry(brandingPrompt, profileData),
    callGeminiWithRetry(portfolioAndCurriculumPrompt, profileData)
  ]);
  
  let coreData;
  let brandingData;
  let portfolioData;
  
  let coreFailed = false;
  let brandingFailed = false;
  let portfolioFailed = false;
  
  if (coreResult.status === 'fulfilled') {
    coreData = coreResult.value;
    console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [SUCCESS] Core Strategy generated successfully.`);
  } else {
    coreFailed = true;
    coreData = getFallbackCoreData(profileData);
    console.error(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [FALLBACK] Core Strategy failed. Fallback applied:`, coreResult.reason.message);
  }
  
  if (brandingResult.status === 'fulfilled') {
    brandingData = brandingResult.value;
    console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [SUCCESS] Branding Audit generated successfully.`);
  } else {
    brandingFailed = true;
    brandingData = getFallbackBrandingData(profileData);
    console.error(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [FALLBACK] Branding Audit failed. Fallback applied:`, brandingResult.reason.message);
  }
  
  if (portfolioResult.status === 'fulfilled') {
    portfolioData = portfolioResult.value;
    console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [SUCCESS] Portfolio Projects generated successfully.`);
  } else {
    portfolioFailed = true;
    portfolioData = getFallbackPortfolioData(profileData);
    console.error(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [FALLBACK] Portfolio Projects failed. Fallback applied:`, portfolioResult.reason.message);
  }
  
  // Future Self Letter generation
  let letterData;
  if (!coreFailed && !brandingFailed && !portfolioFailed) {
    try {
      console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [START] Generating Future Self letter...`);
      letterData = await callGeminiWithRetry((data) => futureLetterPrompt(data, 0, 0), profileData);
      console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [SUCCESS] Future Self letter generated successfully.`);
    } catch (err) {
      letterData = getFallbackLetterData(profileData);
      console.error(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [FALLBACK] Future Self letter failed. Fallback applied:`, err.message);
    }
  } else {
    letterData = getFallbackLetterData(profileData);
    console.log(`[ONBOARDING_LOG] [${new Date().toISOString()}] [AI_GENERATION] [FALLBACK] Main AI generation components failed. Using fallback Future Self letter.`);
  }
  
  const isPending = coreFailed || brandingFailed || portfolioFailed;
  
  return {
    coreData,
    brandingData,
    portfolioData,
    letterData,
    aiGenerated: !isPending
  };
}

module.exports = {
  generateOnboardingAI,
  getFallbackCoreData,
  getFallbackBrandingData,
  getFallbackPortfolioData,
  getFallbackLetterData
};
