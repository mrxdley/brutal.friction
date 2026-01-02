// Setup script for Brutal Friction

// Backend URL - CHANGE THIS IN PRODUCTION
const BACKEND_URL = 'https://brutal-friction-production.up.railway.app';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const steps = document.querySelectorAll('.step');
  const dots = document.querySelectorAll('.step-dot');
  const userNameInput = document.getElementById('userName');
  const friendEmailInput = document.getElementById('friendEmail');
  const timeSliderInput = document.getElementById('timeSlider');
  const timeValueDisplay = document.getElementById('timeValue');
  const timeUnitDisplay = document.getElementById('timeUnit');
  const presetBtns = document.querySelectorAll('.preset-btn');

  let currentStep = 1;

  // Get or generate device ID
  async function getDeviceId() {
    const data = await chrome.storage.local.get(['deviceId']);
    if (data.deviceId) return data.deviceId;
    
    const deviceId = crypto.randomUUID();
    await chrome.storage.local.set({ deviceId });
    return deviceId;
  }

  // Register with backend
  async function registerWithBackend(userName, friendEmail) {
    const deviceId = await getDeviceId();
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, userName, friendEmail })
      });
      
      if (response.ok) {
        console.log('Registered with backend successfully');
      }
    } catch (error) {
      console.error('Failed to register with backend:', error);
      // Don't block setup if backend is down
    }
  }

  // Set uninstall URL
  async function setUninstallURL() {
    const deviceId = await getDeviceId();
    const shameUrl = `${BACKEND_URL}/shame?deviceId=${deviceId}`;
    chrome.runtime.setUninstallURL(shameUrl);
  }

  // Update time display
  function updateTimeDisplay(minutes) {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (mins === 0) {
        timeValueDisplay.textContent = hours;
        timeUnitDisplay.textContent = hours === 1 ? 'hour' : 'hours';
      } else {
        timeValueDisplay.textContent = `${hours}h ${mins}m`;
        timeUnitDisplay.textContent = '';
      }
    } else {
      timeValueDisplay.textContent = minutes;
      timeUnitDisplay.textContent = minutes === 1 ? 'minute' : 'minutes';
    }

    // Update preset buttons
    presetBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.minutes) === minutes);
    });
  }

  // Navigate to step
  function goToStep(step) {
    steps.forEach(s => s.classList.remove('active'));
    dots.forEach(d => {
      const dotStep = parseInt(d.dataset.step);
      d.classList.remove('active', 'completed');
      if (dotStep < step) d.classList.add('completed');
      if (dotStep === step) d.classList.add('active');
    });

    document.querySelector(`.step[data-step="${step}"]`).classList.add('active');
    currentStep = step;
  }

  // Validate email
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Event listeners
  userNameInput.addEventListener('input', () => {
    document.getElementById('step1Next').disabled = userNameInput.value.trim().length === 0;
  });

  friendEmailInput.addEventListener('input', () => {
    document.getElementById('step2Next').disabled = !isValidEmail(friendEmailInput.value);
  });

  timeSliderInput.addEventListener('input', () => {
    updateTimeDisplay(parseInt(timeSliderInput.value));
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.minutes);
      timeSliderInput.value = minutes;
      updateTimeDisplay(minutes);
    });
  });

  // Navigation
  document.getElementById('step1Next').addEventListener('click', () => goToStep(2));
  document.getElementById('step2Back').addEventListener('click', () => goToStep(1));
  document.getElementById('step2Next').addEventListener('click', () => goToStep(3));
  document.getElementById('step3Back').addEventListener('click', () => goToStep(2));
  
  document.getElementById('step3Next').addEventListener('click', async () => {
    const userName = userNameInput.value.trim();
    const friendEmail = friendEmailInput.value.trim();
    const timeLimitMinutes = parseInt(timeSliderInput.value);

    // Save settings locally
    await chrome.storage.local.set({
      userName,
      friendEmail,
      timeLimitMinutes,
      isConfigured: true
    });

    // Register with backend
    await registerWithBackend(userName, friendEmail);
    
    // Set uninstall URL to point to backend shame page
    await setUninstallURL();

    goToStep(4);
  });

  document.getElementById('closeSetup').addEventListener('click', () => {
    window.close();
  });

  // Initialize
  updateTimeDisplay(10);
});
