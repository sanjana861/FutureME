/* ==========================================================================
   INTERACTIVE LIVE DEMO TERMINAL CONTROLLER
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const promptString = "I want to become an AI Engineer.";
    const terminalInput = document.getElementById('demo-text-input');
    const logs = [
        { id: 'log-roadmap', delay: 1000 },
        { id: 'log-projects', delay: 2500 },
        { id: 'log-routine', delay: 3800 },
        { id: 'log-letter', delay: 5000 }
    ];

    let charIndex = 0;

    function runTypingSimulation() {
        if (charIndex < promptString.length) {
            terminalInput.textContent += promptString.charAt(charIndex);
            charIndex++;
            setTimeout(runTypingSimulation, 60);
        } else {
            setTimeout(triggerDashboardOutputs, 500);
        }
    }

    function triggerDashboardOutputs() {
        logs.forEach(log => {
            setTimeout(() => {
                const element = document.getElementById(log.id);
                if (element) element.classList.add('visible');
            }, log.delay);
        });
    }

    // Trigger auto execution after view initialization
    setTimeout(runTypingSimulation, 1200);
});