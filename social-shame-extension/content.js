// Content script for Digital Willpower extension

let currentSite = null;
let isBlocked = false;
let challengeHash = null;

// Determine which site we're on
async function detectSite() {
  const hostname = window.location.hostname;
  
  try {
    const data = await chrome.storage.local.get(['trackedSites']);
    const sites = data.trackedSites || [];
    
    for (const site of sites) {
      if (site.enabled && new RegExp(site.pattern, 'i').test(hostname)) {
        return site.name;
      }
    }
  } catch (e) {
    // Fallback to hardcoded patterns if storage fails
    if (/twitter\.com|x\.com/i.test(hostname)) return 'X (Twitter)';
    if (/instagram\.com/i.test(hostname)) return 'Instagram';
    if (/reddit\.com/i.test(hostname)) return 'Reddit';
    if (/tiktok\.com/i.test(hostname)) return 'TikTok';
    if (/youtube\.com/i.test(hostname)) return 'YouTube';
    if (/facebook\.com/i.test(hostname)) return 'Facebook';
  }
  
  return null;
}

// Generate a random SHA256-style hash
function generateHash() {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Create canvas image of the hash with matched letter highlighting
function createHashImage(hash, matchedCount = 0) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // 2 rows of 32 characters each
  canvas.width = 640;
  canvas.height = 70;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '18px "SF Mono", "Monaco", "Inconsolata", "Fira Code", monospace';
  ctx.textBaseline = 'middle';
  
  const charWidth = canvas.width / 32;
  
  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 32);
    const col = i % 32;
    ctx.fillStyle = i < matchedCount ? '#4ecdc4' : '#ffffff';
    ctx.fillText(hash[i], col * charWidth + 4, row * 32 + 20);
  }
  
  return canvas.toDataURL('image/png');
}

// Create the blocker overlay
function createBlockerOverlay(timeSpent) {
  // Remove existing overlay if any
  const existing = document.getElementById('dw-blocker-overlay');
  if (existing) existing.remove();
  
  challengeHash = generateHash();
  const hashImage = createHashImage(challengeHash);
  
  const overlay = document.createElement('div');
  overlay.id = 'dw-blocker-overlay';
  overlay.innerHTML = `
    <div class="dw-container">
      <div class="dw-glitch-wrapper">
        <h1 class="dw-title" data-text="TIME'S UP">TIME'S UP</h1>
      </div>
      
      <p class="dw-subtitle">
        You've spent <span class="dw-highlight">${timeSpent} minutes</span> on ${currentSite} today.
      </p>
      
      <div class="dw-challenge-box">
        <p class="dw-instruction">Type this hash exactly to continue:</p>
        
        <div class="dw-hash-display">
          <img src="${hashImage}" alt="Challenge hash" class="dw-hash-image" id="dw-hash-img" draggable="false" />
        </div>
        
        <div class="dw-input-wrapper">
          <input 
            type="text" 
            id="dw-hash-input" 
            class="dw-input" 
            placeholder="Enter the hash..."
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </div>
        
        <p id="dw-error-msg" class="dw-error"></p>
        
        <button id="dw-submit-btn" class="dw-submit-btn">
          <span class="dw-btn-text">UNLOCK</span>
        </button>
      </div>
      
      <p class="dw-warning">
        <span class="dw-warning-icon">⚠</span>
        Uninstalling the extension will notify your accountability partner.
      </p>
    </div>
    
    <div class="dw-particles" id="dw-particles"></div>
  `;
  
  document.documentElement.appendChild(overlay);
  
  // Create floating particles
  createParticles();
  
  // Set up event listeners
  const input = document.getElementById('dw-hash-input');
  const submitBtn = document.getElementById('dw-submit-btn');
  const errorMsg = document.getElementById('dw-error-msg');
  
  // Focus input after animation
  setTimeout(() => input.focus(), 500);
  
  // Real-time validation with green letter feedback
  input.addEventListener('input', () => {
    const value = input.value.toLowerCase();
    
    // Count consecutive matching characters
    let matchedCount = 0;
    for (let i = 0; i < value.length && i < 64; i++) {
      if (value[i] === challengeHash[i]) {
        matchedCount++;
      } else {
        break;
      }
    }
    
    // Update hash image with highlighting
    const hashImg = document.getElementById('dw-hash-img');
    hashImg.src = createHashImage(challengeHash, matchedCount);
    
    // Border feedback for complete input
    if (value.length === 64) {
      if (value === challengeHash) {
        input.classList.add('dw-valid');
        input.classList.remove('dw-invalid');
      } else {
        input.classList.add('dw-invalid');
        input.classList.remove('dw-valid');
      }
    } else {
      input.classList.remove('dw-valid', 'dw-invalid');
    }
  });
  
  // Handle submit
  async function handleSubmit() {
    const value = input.value.toLowerCase().trim();
    
    if (value === challengeHash) {
      // Success animation
      overlay.classList.add('dw-success');
      
      // Notify background script
      chrome.runtime.sendMessage({ 
        action: 'challengeComplete',
        site: currentSite 
      });
      
      // Remove overlay after animation
      setTimeout(() => {
        overlay.remove();
        isBlocked = false;
      }, 800);
    } else {
      // Error shake animation
      input.classList.add('dw-shake');
      errorMsg.textContent = 'Incorrect. Please try again.';
      errorMsg.classList.add('dw-visible');
      
      setTimeout(() => {
        input.classList.remove('dw-shake');
        input.value = '';
        input.focus();
      }, 500);
      
      // Generate new hash after 3 failures
      if (!overlay.dataset.attempts) overlay.dataset.attempts = '0';
      overlay.dataset.attempts = String(parseInt(overlay.dataset.attempts) + 1);
      
      if (parseInt(overlay.dataset.attempts) >= 3) {
        overlay.dataset.attempts = '0';
        challengeHash = generateHash();
        document.getElementById('dw-hash-img').src = createHashImage(challengeHash);
        errorMsg.textContent = 'New hash generated. Focus harder.';
      }
    }
  }
  
  submitBtn.addEventListener('click', handleSubmit);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
  
  // Prevent closing/navigation
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      input.focus();
    }
  });
  
  isBlocked = true;
}

// Create floating particle effect
function createParticles() {
  const container = document.getElementById('dw-particles');
  if (!container) return;
  
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'dw-particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 20 + 's';
    particle.style.animationDuration = (15 + Math.random() * 20) + 's';
    container.appendChild(particle);
  }
}

// Check time status on page load and periodically
async function checkTimeStatus() {
  if (!currentSite) return;
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'getTimeStatus',
      site: currentSite 
    });
    
    if (response && response.shouldBlock && !isBlocked) {
      createBlockerOverlay(response.timeSpent);
    }
  } catch (e) {
    // Extension context invalidated
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showBlocker' && message.site === currentSite) {
    if (!isBlocked) {
      createBlockerOverlay(message.timeSpent);
    }
  }
});

// Initialize
async function init() {
  currentSite = await detectSite();
  if (currentSite) {
    checkTimeStatus();
    
    // Periodic check every minute
    setInterval(checkTimeStatus, 60000);
    
    // Check on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkTimeStatus();
      }
    });
  }
}

init();
