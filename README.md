# FutureMe OS — The AI Career Operating System

FutureMe OS is a production-ready career planning and development platform. Instead of a basic chatbot, it acts as a **living AI mentor** that designs customized learning schedules, portfolio projects, and resume refinements. The system continuously adapts your roadmap as you check off daily tasks and submit weekly accountability check-ins.

---

## Technical Stack

- **Frontend**: HTML, CSS (Vanilla CSS), Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite (development), with modular driver queries scaling easily to PostgreSQL
- **AI Service**: Google Gemini AI (using `@google/generative-ai` SDK)
- **Authentication**: JWT (JSON Web Tokens), cookies, and bcryptjs password hashing
- **File System**: Multpart uploads via Multer (for resume analyses)
- **Exports**: PDFKit (direct streaming for PDF files), Markdown, and JSON formats

---

## Project Structure

The codebase is organized according to the Model-View-Controller (MVC) pattern to separate operational concerns:

```
FutureMe OS/
├── config/
│   └── db.js                 # SQLite database connection manager
├── controllers/
│   ├── authController.js     # Signup, login, and token state management
│   ├── exportController.js   # JSON, Markdown, and PDFKit report compilations
│   ├── letterController.js   # Generates letters from your future self
│   ├── mentorController.js   # Context-aware AI Mentor conversation loops
│   ├── profileController.js  # Onboarding wizards and full dashboard state compilers
│   └── taskController.js     # Daily missions (Complete/Skip/Postpone) and weekly reviews
├── database/
│   ├── init.js               # Creates and seeds database schemas
│   └── futureme.sqlite       # Generated runtime database (on startup)
├── middleware/
│   └── auth.js               # JWT route protection middleware (Header / Cookies)
├── prompts/
│   └── templates.js          # Customized prompts requesting simple English JSON responses
├── public/                   # Serves all static HTML/CSS/JS frontend files
│   ├── css/
│   │   ├── app.css
│   │   ├── global.css
│   │   ├── landing.css
│   │   └── onboarding.css
│   ├── js/
│   │   ├── app.js            # Hydrates all views and triggers API requests
│   │   ├── auth.js           # Submits login/signup actions and cookies
│   │   ├── demo.js           # Live terminal simulation animation
│   │   └── onboarding.js     # Collects files and details, handles loading bars
│   ├── app.html              # Core desktop dashboard viewport
│   ├── index.html            # Landing page and auth modal panels
│   └── onboarding.html       # Onboarding wizard form step steps
├── routes/
│   ├── auth.js
│   ├── export.js
│   ├── history.js
│   ├── mentor.js
│   ├── profile.js
│   ├── projects.js
│   ├── settings.js
│   └── tasks.js
├── uploads/                  # User resume files uploaded via Multer
├── utils/
│   └── helpers.js            # General sanitizations and utility blocks
├── .env                      # Local server secrets (Not committed)
├── .env.example              # Secret key templates
├── package.json              # List of Node packages and start scripts
├── server.js                 # Express server entry point
└── README.md                 # Setup guidelines (This file)
```

---

## Schema Overview

The database contains normalized tables supporting the complete ecosystem:
1. **`users`**: Secure email login and hashed passwords.
2. **`profiles`**: Onboarding details, expected salary, availability, and resume paths.
3. **`skills` & `skill_progress`**: Granular proficiency metrics that increment when daily tasks are completed.
4. **`weekly_plans` & `daily_tasks`**: Dynamic calendar events and micro tasks.
5. **`roadmaps`**: Main timeline checkpoints and estimated completion dates.
6. **`projects`**: Custom Beginner, Intermediate, Advanced, and Flagship portfolio specifications.
7. **`reports`**: Snapsots of history comparisons and weekly AI reviews.
8. **`future_letters`**: Letters written by your Future Self.
9. **`mentor_conversations`**: Chat logs for persistent AI mentoring.
10. **`settings`**: Visual themes, notification times, and remind triggers.

---

## Setup & Running Instructions

### 1. Prerequisite
Ensure you have [Node.js](https://nodejs.org/) installed (v16.x or higher recommended).

### 2. Installation
Open your terminal in the project directory and install dependencies:
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory. You can copy the example file:
```bash
cp .env.example .env
```
Fill in your secrets:
- Set `JWT_SECRET` to a secure string.
- Obtain a Gemini API key from [Google AI Studio](https://aistudio.google.com/) and paste it in `GEMINI_API_KEY`.

### 4. Run the Application
Start the Node.js server:
```bash
npm start
```

This will:
1. Initialize the SQLite database schema automatically.
2. Spin up the server on port `3000`.

### 5. Access the Platform
Open your browser and navigate to:
```
http://localhost:3000
```
- Click **Get Started** or **Get Started** button to Sign Up.
- Complete the Onboarding Wizard (optionally uploading a sample resume file).
- The loading screen will display step status tickers while Gemini parallelizes requests to compile your roadmap, planner, portfolio, and future self letter.
- Explore your interactive dashboard, check off tasks, and consult your AI Mentor!
