// Popup script for Digital Willpower
// Hash gate required to access any settings

const SITE_ICONS = {
  'X (Twitter)': '𝕏',
  'Instagram': '📷',
  'Reddit': '🔴',
  'TikTok': '🎵',
  'YouTube': '▶️',
  'Facebook': '📘',
  'default': '🌐'
};

let currentHash = '';
let trackedSites = [];

// Generate random hash
function generateHash() {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Draw hash on canvas with matched highlighting
function drawHash(canvas, hash, matchedCount = 0) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  
  // Draw in 2 rows of 32 chars
  const charWidth = canvas.width / 32;
  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 32);
    const col = i % 32;
    ctx.fillStyle = i < matchedCount ? '#4ecdc4' : '#ffffff';
    ctx.fillText(hash[i], col * charWidth + 2, row * 28 + 16);
  }
}

// Format time for display
function formatTime(minutes) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

// Initialize hash gate
function initHashGate() {
  currentHash = generateHash();
  const canvas = document.getElementById('hashCanvas');
  const input = document.getElementById('hashInput');
  const submitBtn = document.getElementById('hashSubmit');
  
  drawHash(canvas, currentHash);
  
  input.addEventListener('input', () => {
    const val = input.value.toLowerCase();
    let matched = 0;
    for (let i = 0; i < val.length && i < 64; i++) {
      if (val[i] === currentHash[i]) matched++;
      else break;
    }
    drawHash(canvas, currentHash, matched);
  });
  
  submitBtn.addEventListener('click', verifyHash);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyHash();
  });
  
  // Focus input
  setTimeout(() => input.focus(), 100);
}

// Verify hash and show main content
function verifyHash() {
  const input = document.getElementById('hashInput');
  const val = input.value.toLowerCase().trim();
  
  if (val === currentHash) {
    document.getElementById('hashGate').style.display = 'none';
    document.getElementById('mainContent').classList.add('active');
    loadMainContent();
  } else {
    input.classList.add('error');
    setTimeout(() => {
      input.classList.remove('error');
      input.value = '';
      // Generate new hash after failed attempt
      currentHash = generateHash();
      drawHash(document.getElementById('hashCanvas'), currentHash);
    }, 300);
  }
}

// Load main content after hash verified
async function loadMainContent() {
  try {
    const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
    const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
    
    trackedSites = stats.trackedSites || [];
    
    renderStats(stats);
    renderSettings(settings, stats.timeLimit);
    renderSites(trackedSites);
    initTabs();
    initSettingsHandlers(stats.timeLimit);
    initSitesHandlers();
  } catch (e) {
    console.error('Failed to load:', e);
  }
}

// Render stats panel
function renderStats(stats) {
  const { todayStats, monthlyStats, timeLimit } = stats;
  
  // Time limit display
  document.getElementById('timeLimitValue').textContent = formatTime(timeLimit);
  
  // Today's usage
  const statsContainer = document.getElementById('siteStats');
  const sites = Object.entries(todayStats);
  
  if (sites.length === 0) {
    statsContainer.innerHTML = '<div class="empty-state">No activity yet today</div>';
  } else {
    statsContainer.innerHTML = sites.map(([site, time]) => {
      const percentage = Math.min(100, (time / timeLimit) * 100);
      let statusClass = '';
      if (percentage >= 100) statusClass = 'danger';
      else if (percentage >= 75) statusClass = 'warning';
      
      const icon = SITE_ICONS[site] || SITE_ICONS.default;
      
      return `
        <div class="site-stat">
          <div class="site-info">
            <div class="site-icon">${icon}</div>
            <div class="site-name">${site}</div>
          </div>
          <div class="site-time">
            <span class="time-text ${statusClass}">${formatTime(time)}</span>
            <div class="progress-bar">
              <div class="progress-fill ${statusClass}" style="width: ${percentage}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // Monthly total
  let monthlyTotal = 0;
  for (const mins of Object.values(monthlyStats)) {
    monthlyTotal += mins;
  }
  document.getElementById('monthlyValue').textContent = formatTime(monthlyTotal);
}

// Render settings panel
function renderSettings(settings, timeLimit) {
  document.getElementById('settingName').value = settings.userName || '';
  document.getElementById('settingEmail').value = settings.friendEmail || '';
  document.getElementById('settingTimeSlider').value = timeLimit;
  updateTimeDisplay(timeLimit);
}

// Update time display in settings
function updateTimeDisplay(minutes) {
  document.getElementById('settingTimeDisplay').textContent = formatTime(minutes);
}

// Render sites panel
function renderSites(sites) {
  const container = document.getElementById('sitesList');
  
  container.innerHTML = sites.map((site, index) => {
    const icon = SITE_ICONS[site.name] || SITE_ICONS.default;
    return `
      <div class="site-item" data-index="${index}">
        <div class="site-item-info">
          <div class="site-item-icon">${icon}</div>
          <div class="site-item-name">${site.name}</div>
        </div>
        <label class="toggle">
          <input type="checkbox" ${site.enabled ? 'checked' : ''} data-site-id="${site.id}">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }).join('');
}

// Initialize tabs
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab + 'Panel';
      
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

// Initialize settings handlers
function initSettingsHandlers(currentTimeLimit) {
  const slider = document.getElementById('settingTimeSlider');
  const saveBtn = document.getElementById('saveSettings');
  
  slider.addEventListener('input', () => {
    updateTimeDisplay(parseInt(slider.value));
  });
  
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    const settings = {
      userName: document.getElementById('settingName').value.trim(),
      friendEmail: document.getElementById('settingEmail').value.trim(),
      timeLimitMinutes: parseInt(slider.value),
      isConfigured: true
    };
    
    await chrome.runtime.sendMessage({ action: 'updateSettings', settings });
    
    saveBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }, 1500);
    
    // Update stats display
    document.getElementById('timeLimitValue').textContent = formatTime(settings.timeLimitMinutes);
  });
}

// Initialize sites handlers
function initSitesHandlers() {
  const container = document.getElementById('sitesList');
  const addBtn = document.getElementById('addSiteBtn');
  const modal = document.getElementById('addSiteModal');
  const cancelBtn = document.getElementById('cancelAddSite');
  const confirmBtn = document.getElementById('confirmAddSite');
  
  // Toggle site enabled/disabled
  container.addEventListener('change', async (e) => {
    if (e.target.type === 'checkbox') {
      const siteId = e.target.dataset.siteId;
      const enabled = e.target.checked;
      
      const site = trackedSites.find(s => s.id === siteId);
      if (site) {
        site.enabled = enabled;
        await chrome.runtime.sendMessage({ 
          action: 'updateSettings', 
          settings: { trackedSites } 
        });
      }
    }
  });
  
  // Add site modal
  addBtn.addEventListener('click', () => {
    modal.classList.add('active');
    document.getElementById('newSiteName').focus();
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    document.getElementById('newSiteName').value = '';
    document.getElementById('newSitePattern').value = '';
  });
  
  confirmBtn.addEventListener('click', async () => {
    const name = document.getElementById('newSiteName').value.trim();
    const pattern = document.getElementById('newSitePattern').value.trim();
    
    if (!name || !pattern) return;
    
    const newSite = {
      id: 'custom_' + Date.now(),
      name: name,
      pattern: pattern,
      enabled: true
    };
    
    trackedSites.push(newSite);
    
    await chrome.runtime.sendMessage({ 
      action: 'updateSettings', 
      settings: { trackedSites } 
    });
    
    renderSites(trackedSites);
    
    modal.classList.remove('active');
    document.getElementById('newSiteName').value = '';
    document.getElementById('newSitePattern').value = '';
  });
}

// Check if extension is configured
async function checkConfiguration() {
  const settings = await chrome.storage.local.get(['isConfigured']);
  
  if (!settings.isConfigured) {
    // Skip hash gate for unconfigured extension
    document.getElementById('hashGate').innerHTML = `
      <div class="not-configured">
        <div class="gate-icon">🔒</div>
        <p>Extension not configured yet.</p>
        <button class="setup-btn" id="openSetup">Set Up Now</button>
      </div>
    `;
    document.getElementById('openSetup').addEventListener('click', () => {
      chrome.tabs.create({ url: 'setup.html' });
    });
  } else {
    initHashGate();
  }
}

// Start
checkConfiguration();
