/* ==========================================================================
   SIMPLE ONBOARDING STATE MANAGEMENT
   ========================================================================== */

let activeStepIndex = 1;
const globalStepsTotalCount = 7;

// Storage for custom selected elements
const dataPipelineMap = {
    selectedMentorPersonality: "Strict Mentor"
};

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is authenticated and if they already onboarded
    try {
        const res = await fetch('/api/auth/me');
        if (res.status === 401) {
            window.location.href = 'index.html';
            return;
        }
        const data = await res.json();
        if (data.onboarded) {
            window.location.href = 'app.html';
        }
    } catch (err) {
        console.error('Auth verification failed:', err);
        window.location.href = 'index.html';
    }
});

function selectMentorOption(element, selectedValue) {
    document.querySelectorAll('#mentor-grid .select-card').forEach(card => card.classList.remove('selected'));
    element.classList.add('selected');
    dataPipelineMap.selectedMentorPersonality = selectedValue;
}

function processStepNavigation(direction) {
    if (direction === 1 && !validateCurrentStepFields()) {
        alert("Please fill in the required fields before moving to the next step.");
        return;
    }

    // Hide current step
    document.querySelector(`.step-panel[data-step="${activeStepIndex}"]`).classList.remove('active');
    
    activeStepIndex += direction;
    if (activeStepIndex < 1) activeStepIndex = 1;
    if (activeStepIndex > globalStepsTotalCount) activeStepIndex = globalStepsTotalCount;

    // Show next step
    document.querySelector(`.step-panel[data-step="${activeStepIndex}"]`).classList.add('active');
    
    synchronizeControlMetricsUI();
}

function validateCurrentStepFields() {
    const currentContainer = document.querySelector(`.step-panel[data-step="${activeStepIndex}"]`);
    const inputs = currentContainer.querySelectorAll('input[required], select[required]');
    let passState = true;
    inputs.forEach(el => {
        if (!el.value.trim()) passState = false;
    });
    return passState;
}

function synchronizeControlMetricsUI() {
    // Update progress bar percentage
    const percentage = Math.round((activeStepIndex / globalStepsTotalCount) * 100);
    document.getElementById('display-step-meta').innerText = `Step ${activeStepIndex} of ${globalStepsTotalCount}`;
    document.getElementById('display-step-percentage').innerText = `${percentage}%`;
    document.getElementById('ui-indicator-fill').style.width = `${percentage}%`;

    // Button visibility logic
    const prevBtn = document.getElementById('action-prev');
    const nextBtn = document.getElementById('action-next');
    const submitBtn = document.getElementById('action-submit');

    prevBtn.style.visibility = (activeStepIndex === 1) ? 'hidden' : 'visible';

    if (activeStepIndex === globalStepsTotalCount) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-flex';
        compileReviewSummary();
    } else {
        nextBtn.style.display = 'inline-flex';
        submitBtn.style.display = 'none';
    }
}

function compileReviewSummary() {
    const summaryBox = document.getElementById('ui-summary-mount');
    
    const cache = {
        "Your Name": document.getElementById('in-name').value || "Sarah Jenkins",
        "Target Job Title": document.getElementById('in-target-title').value || "AI Engineer",
        "Dream Company": document.getElementById('in-target-company').value || "OpenAI",
        "Daily Study Time": document.getElementById('in-hours').value || "2 Hours",
        "Mentor Style": dataPipelineMap.selectedMentorPersonality
    };

    summaryBox.innerHTML = '';
    for (const [key, value] of Object.entries(cache)) {
        summaryBox.innerHTML += `
            <div class="summary-row">
                <span class="summary-key">${key}</span>
                <span class="summary-value">${value}</span>
            </div>
        `;
    }
}

async function executeSystemGenerationPipeline(event) {
    event.preventDefault();

    // Show loading overlay
    document.getElementById('ui-wizard-container').style.display = 'none';
    document.getElementById('ui-loading-overlay').classList.add('active');

    const tickerStrings = [
        "Analyzing your unique strengths...",
        "Looking up target requirements for your dream company...",
        "Building your customized career roadmap...",
        "Designing personalized portfolio projects...",
        "Setting up your optimal daily schedule...",
        "Writing a personalized letter from your future self..."
    ];

    let stringTickerIndex = 0;
    const intervalTimerId = setInterval(() => {
        if (stringTickerIndex < tickerStrings.length) {
            document.getElementById('ui-ticker-message').innerText = tickerStrings[stringTickerIndex];
            stringTickerIndex++;
        }
    }, 900);

    // Prepare multi-part form data upload
    const formData = new FormData();
    formData.append('full_name', document.getElementById('in-name').value);
    formData.append('age', document.getElementById('in-age').value);
    formData.append('country', document.getElementById('in-country').value);
    formData.append('current_role', document.getElementById('in-role').value);
    formData.append('current_projects', document.getElementById('in-current-projects').value);
    formData.append('dream_role', document.getElementById('in-target-title').value);
    formData.append('dream_company', document.getElementById('in-target-company').value);
    formData.append('target_year', document.getElementById('in-target-year').value);
    formData.append('expected_salary', document.getElementById('in-salary').value);
    formData.append('current_skills', document.getElementById('in-languages').value);
    formData.append('weak_skills', document.getElementById('in-weakness').value);
    formData.append('confidence_level', document.getElementById('in-confidence').value);
    formData.append('biggest_struggles', document.getElementById('in-struggles').value);
    formData.append('learning_time', document.getElementById('in-hours').value);
    formData.append('learning_style', document.getElementById('in-learning-style').value);
    formData.append('github_url', document.getElementById('in-github').value);
    formData.append('linkedin_url', document.getElementById('in-linkedin').value);
    formData.append('portfolio_url', document.getElementById('in-portfolio').value);
    formData.append('preferred_mentor_style', dataPipelineMap.selectedMentorPersonality);

    const resumeInput = document.getElementById('in-resume');
    if (resumeInput.files.length > 0) {
        formData.append('resume', resumeInput.files[0]);
    }

    try {
        const response = await fetch('/api/profile/setup', {
            method: 'POST',
            body: formData
        });

        clearInterval(intervalTimerId);
        const result = await response.json();

        if (response.ok) {
            // Save local metadata backup
            localStorage.setItem('fm_name', document.getElementById('in-name').value);
            localStorage.setItem('fm_target_title', document.getElementById('in-target-title').value);
            localStorage.setItem('fm_target_company', document.getElementById('in-target-company').value);
            localStorage.setItem('fm_hours', document.getElementById('in-hours').value);
            localStorage.setItem('fm_weakness', document.getElementById('in-weakness').value);
            localStorage.setItem('fm_mentor', dataPipelineMap.selectedMentorPersonality);

            window.location.href = "app.html";
        } else {
            // Restore form and show error
            document.getElementById('ui-loading-overlay').classList.remove('active');
            document.getElementById('ui-wizard-container').style.display = 'block';
            alert("Onboarding generation error: " + (result.error || "Failed to contact AI system. Make sure your API keys are configured."));
        }
    } catch (error) {
        clearInterval(intervalTimerId);
        document.getElementById('ui-loading-overlay').classList.remove('active');
        document.getElementById('ui-wizard-container').style.display = 'block';
        console.error('Setup error:', error);
        alert("Network failure or AI engine timeout. Please check your Node.js console logs.");
    }
}