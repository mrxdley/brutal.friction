// Background service worker for Digital Willpower extension

// ============================================
// BACKEND CONFIGURATION - CHANGE THIS!
// ============================================
const BACKEND_URL = 'https://brutal-friction-production.up.railway.app'; // Update to your deployed URL

// Default tracked sites - stored in chrome.storage so user can modify
const DEFAULT_TRACKED_SITES = [
  { id: 'twitter', pattern: 'twitter.com|x.com', name: 'X (Twitter)', enabled: true },
  { id: 'instagram', pattern: 'instagram.com', name: 'Instagram', enabled: true },
  { id: 'reddit', pattern: 'reddit.com', name: 'Reddit', enabled: true },
  { id: 'tiktok', pattern: 'tiktok.com', name: 'TikTok', enabled: true },
  { id: 'youtube', pattern: 'youtube.com', name: 'YouTube', enabled: true },
  { id: 'facebook', pattern: 'facebook.com', name: 'Facebook', enabled: true }
];

// Default settings
const DEFAULT_SETTINGS = {
  userName: '',
  friendEmail: '',
  timeLimitMinutes: 10,
  isConfigured: false,
  trackedSites: DEFAULT_TRACKED_SITES,
  monthlyStats: {},
  dailyTime: {},
  unlockedUntil: {}
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set(DEFAULT_SETTINGS);
    chrome.tabs.create({ url: 'setup.html' });
  }
  
  //build uninstall URL
  const data = await chrome.storage.local.get(['deviceId', 'isConfigured']);
  const shameUrl = `${BACKEND_URL}/shame?deviceId=${data.deviceId}`;
  chrome.runtime.setUninstallURL(shameUrl);

});

// Get or generate device ID
async function getDeviceId() {
  const data = await chrome.storage.local.get(['deviceId']);
  
  if (data.deviceId) {
    return data.deviceId;
  }
  
  // Generate new device ID
  const deviceId = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId });
  return deviceId;
}

// Register user with backend
async function registerWithBackend(userName, friendEmail) {
  const deviceId = await getDeviceId();
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, userName, friendEmail })
    });
    
    if (!response.ok) {
      console.error('Backend registration failed');
    }
  } catch (error) {
    console.error('Failed to register with backend:', error);
  }
}

// Sync stats with backend
async function syncWithBackend() {
  const data = await chrome.storage.local.get(['deviceId', 'monthlyStats', 'isConfigured']);
  
  if (!data.isConfigured || !data.deviceId) return;
  
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const monthlyStats = data.monthlyStats?.[monthKey] || {};
  
  try {
    await fetch(`${BACKEND_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        deviceId: data.deviceId, 
        monthlyStats, 
        monthKey 
      })
    });
  } catch (error) {
    console.error('Failed to sync with backend:', error);
  }
}

// Get tracked site from URL
async function getTrackedSite(url) {
  if (!url) return null;
  
  const data = await chrome.storage.local.get(['trackedSites']);
  const sites = data.trackedSites || DEFAULT_TRACKED_SITES;
  
  for (const site of sites) {
    if (site.enabled && new RegExp(site.pattern, 'i').test(url)) {
      return site.name;
    }
  }
  return null;
}

// Time tracking state
let activeTabId = null;
let activeStartTime = null;
let activeSite = null;

// Tab tracking
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await saveCurrentSession();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await startTracking(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tabId === activeTabId) {
    await saveCurrentSession();
    await startTracking(tab);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await saveCurrentSession();
    activeTabId = null;
    activeSite = null;
    activeStartTime = null;
  } else {
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs[0]) {
      await startTracking(tabs[0]);
    }
  }
});

async function startTracking(tab) {
  const site = await getTrackedSite(tab.url);
  
  if (site) {
    activeTabId = tab.id;
    activeSite = site;
    activeStartTime = Date.now();
  } else {
    activeTabId = null;
    activeSite = null;
    activeStartTime = null;
  }
}

async function saveCurrentSession() {
  if (!activeSite || !activeStartTime) return;
  
  const duration = Date.now() - activeStartTime;
  const minutes = duration / 1000 / 60;
  
  if (minutes < 0.1) return;
  
  const data = await chrome.storage.local.get(['monthlyStats', 'dailyTime']);
  const stats = data.monthlyStats || {};
  const dailyTime = data.dailyTime || {};
  
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const dayKey = now.toISOString().split('T')[0];
  
  // Update monthly stats
  if (!stats[monthKey]) stats[monthKey] = {};
  if (!stats[monthKey][activeSite]) stats[monthKey][activeSite] = 0;
  stats[monthKey][activeSite] += minutes;
  
  // Update daily time
  if (!dailyTime[dayKey]) dailyTime[dayKey] = {};
  if (!dailyTime[dayKey][activeSite]) dailyTime[dayKey][activeSite] = 0;
  dailyTime[dayKey][activeSite] += minutes;
  
  await chrome.storage.local.set({ monthlyStats: stats, dailyTime });
  
  // Update uninstall URL and sync with backend
  updateUninstallURL();
  syncWithBackend();
  
  // Check if should block
  const settings = await chrome.storage.local.get(['timeLimitMinutes', 'isConfigured', 'unlockedUntil']);
  if (settings.isConfigured) {
    const todayTotal = dailyTime[dayKey][activeSite] || 0;
    const unlockedUntil = settings.unlockedUntil || {};
    const unlockExpiry = unlockedUntil[activeSite] ? new Date(unlockedUntil[activeSite]) : null;
    const isUnlocked = unlockExpiry && unlockExpiry > now;
    
    if (todayTotal >= settings.timeLimitMinutes && !isUnlocked) {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        const tabSite = await getTrackedSite(tab.url);
        if (tabSite === activeSite) {
          try {
            chrome.tabs.sendMessage(tab.id, { 
              action: 'showBlocker',
              site: activeSite,
              timeSpent: Math.round(todayTotal)
            });
          } catch (e) {}
        }
      }
    }
  }
}

// Periodic save
chrome.alarms.create('saveSession', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'saveSession') {
    await saveCurrentSession();
    if (activeSite) {
      activeStartTime = Date.now();
    }
  }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'getTimeStatus':
      return await getTimeStatus(message.site);
    
    case 'challengeComplete':
      return await handleChallengeComplete(message.site);
    
    case 'getStats':
      return await getStats();
    
    case 'getSettings':
      return await chrome.storage.local.get(['timeLimitMinutes', 'trackedSites', 'userName', 'friendEmail']);
    
    case 'updateSettings':
      await chrome.storage.local.set(message.settings);
      // If user info updated, sync with backend
      if (message.settings.userName || message.settings.friendEmail) {
        const data = await chrome.storage.local.get(['userName', 'friendEmail']);
        await registerWithBackend(data.userName, data.friendEmail);
      }
      updateUninstallURL();
      return { success: true };
    
    case 'getBlockStatus':
      return await getBlockStatus();
    
    default:
      return { error: 'Unknown action' };
  }
}

async function getTimeStatus(site) {
  const data = await chrome.storage.local.get(['dailyTime', 'timeLimitMinutes', 'isConfigured', 'unlockedUntil']);
  
  if (!data.isConfigured) {
    return { shouldBlock: false, reason: 'not_configured' };
  }
  
  const now = new Date();
  const dayKey = now.toISOString().split('T')[0];
  const dailyTime = data.dailyTime || {};
  const todayTime = dailyTime[dayKey] || {};
  const timeSpent = todayTime[site] || 0;
  const timeLimit = data.timeLimitMinutes || 10;
  
  // Check unlock status first
  const unlockedUntil = data.unlockedUntil || {};
  if (unlockedUntil[site]) {
    const unlockExpiry = new Date(unlockedUntil[site]);
    if (unlockExpiry > now) {
      return { 
        shouldBlock: false, 
        reason: 'unlocked',
        timeSpent: Math.round(timeSpent),
        timeRemaining: Math.round((unlockExpiry - now) / 1000 / 60)
      };
    }
  }
  
  if (timeSpent >= timeLimit) {
    return { 
      shouldBlock: true, 
      timeSpent: Math.round(timeSpent),
      timeLimit 
    };
  }
  
  return { 
    shouldBlock: false, 
    timeSpent: Math.round(timeSpent),
    timeLimit,
    timeRemaining: Math.round(timeLimit - timeSpent)
  };
}

async function handleChallengeComplete(site) {
  const data = await chrome.storage.local.get(['unlockedUntil', 'timeLimitMinutes']);
  const unlockedUntil = data.unlockedUntil || {};
  const bonusMinutes = data.timeLimitMinutes || 10;
  
  const unlockTime = new Date();
  unlockTime.setMinutes(unlockTime.getMinutes() + bonusMinutes);
  unlockedUntil[site] = unlockTime.toISOString();
  
  await chrome.storage.local.set({ unlockedUntil });
  
  return { success: true, unlockedUntil: unlockTime.toISOString() };
}

async function getStats() {
  const data = await chrome.storage.local.get(['monthlyStats', 'dailyTime', 'timeLimitMinutes', 'trackedSites']);
  
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const dayKey = now.toISOString().split('T')[0];
  
  return {
    monthlyStats: data.monthlyStats?.[monthKey] || {},
    todayStats: data.dailyTime?.[dayKey] || {},
    timeLimit: data.timeLimitMinutes || 10,
    trackedSites: data.trackedSites || DEFAULT_TRACKED_SITES
  };
}

async function getBlockStatus() {
  const data = await chrome.storage.local.get(['dailyTime', 'timeLimitMinutes', 'isConfigured', 'unlockedUntil']);
  
  if (!data.isConfigured) {
    return { isBlocked: false, reason: 'not_configured' };
  }
  
  const now = new Date();
  const dayKey = now.toISOString().split('T')[0];
  const dailyTime = data.dailyTime?.[dayKey] || {};
  const timeLimit = data.timeLimitMinutes || 10;
  const unlockedUntil = data.unlockedUntil || {};
  
  for (const [site, time] of Object.entries(dailyTime)) {
    if (time >= timeLimit) {
      const unlockExpiry = unlockedUntil[site] ? new Date(unlockedUntil[site]) : null;
      if (!unlockExpiry || unlockExpiry <= now) {
        return { isBlocked: true, site, timeSpent: Math.round(time) };
      }
    }
  }
  
  return { isBlocked: false };
}
