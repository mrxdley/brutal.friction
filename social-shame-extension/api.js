// API client for Digital Willpower backend
// Update BACKEND_URL to your deployed server

const BACKEND_URL = 'http://localhost:3000'; // Change this in production!

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
async function registerUser(userName, friendEmail) {
  const deviceId = await getDeviceId();
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, userName, friendEmail })
    });
    
    if (!response.ok) {
      throw new Error('Registration failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to register with backend:', error);
    // Don't block extension setup if backend is down
    return { success: false, error: error.message };
  }
}

// Sync stats with backend
async function syncStats() {
  const deviceId = await getDeviceId();
  const data = await chrome.storage.local.get(['monthlyStats', 'isConfigured']);
  
  if (!data.isConfigured) return;
  
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const monthlyStats = data.monthlyStats?.[monthKey] || {};
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, monthlyStats, monthKey })
    });
    
    if (!response.ok) {
      throw new Error('Sync failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to sync with backend:', error);
    return { success: false, error: error.message };
  }
}

// Update uninstall URL to point to backend shame page
async function updateShameUrl() {
  const deviceId = await getDeviceId();
  const shameUrl = `${BACKEND_URL}/shame?deviceId=${deviceId}`;
  
  try {
    chrome.runtime.setUninstallURL(shameUrl);
    console.log('Uninstall URL set:', shameUrl);
  } catch (error) {
    console.error('Failed to set uninstall URL:', error);
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined') {
  module.exports = { getDeviceId, registerUser, syncStats, updateShameUrl, BACKEND_URL };
}
