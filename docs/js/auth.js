async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.querySelector('input[type="email"]').value;
  const password = form.querySelector('input[type="password"]').value;
  const submitBtn = form.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.innerText = "Verifying Identity...";

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      // Write the JWT token cookie for page authorizations
      document.cookie = `token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
      
      // Redirect based on profile status
      const statusRes = await fetch('/api/auth/me');
      const statusData = await statusRes.json();
      if (statusData.onboarded) {
        window.location.href = 'app.html';
      } else {
        window.location.href = 'onboarding.html';
      }
    } else {
      alert(data.error || 'Authentication failed. Please verify credentials.');
      submitBtn.disabled = false;
      submitBtn.innerText = "Initialize Identity Session";
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Server connection failure. Please verify Node.js console logs.');
    submitBtn.disabled = false;
    submitBtn.innerText = "Initialize Identity Session";
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.target;
  const full_name = form.querySelector('input[type="text"]').value;
  const email = form.querySelector('input[type="email"]').value;
  const password = form.querySelector('input[type="password"]').value;
  const submitBtn = form.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.innerText = "Deploying Workspace...";

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name })
    });
    const data = await res.json();
    
    if (res.ok) {
      document.cookie = `token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
      window.location.href = 'onboarding.html';
    } else {
      alert(data.error || 'Failed to initialize account.');
      submitBtn.disabled = false;
      submitBtn.innerText = "Deploy Core Platform Profile";
    }
  } catch (error) {
    console.error('Signup error:', error);
    alert('Server connection failure. Please verify Node.js console logs.');
    submitBtn.disabled = false;
    submitBtn.innerText = "Deploy Core Platform Profile";
  }
}

// Redirect on landing if session is already active
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.onboarded) {
        window.location.href = 'app.html';
      } else {
        window.location.href = 'onboarding.html';
      }
    }
  } catch (err) {
    // Silence expected unauthenticated errors
  }
});

async function handleGoogleLogin(event) {
  if (event) event.preventDefault();
  
  try {
    const res = await fetch('/api/auth/google-mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    
    if (res.ok) {
      document.cookie = `token=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
      
      const statusRes = await fetch('/api/auth/me');
      const statusData = await statusRes.json();
      if (statusData.onboarded) {
        window.location.href = 'app.html';
      } else {
        window.location.href = 'onboarding.html';
      }
    } else {
      alert(data.error || 'Google login failed.');
    }
  } catch (error) {
    console.error('Google login error:', error);
    alert('Server connection failure.');
  }
}
