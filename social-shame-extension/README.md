# Digital Willpower 🔒

A Chrome/Edge extension that helps you build self-control through social accountability. When you spend too much time on distracting sites, you'll need to manually type a SHA256-style hash to continue. The twist? Uninstalling the extension triggers an embarrassing message to your accountability partner.

## Features

- **Time Tracking**: Monitors time spent on Twitter/X, Instagram, Reddit, TikTok, YouTube, and Facebook
- **Customizable Limits**: Set daily limits from 1 minute to 4 hours per site
- **Friction Mechanism**: When limit is reached, you must manually type a 64-character hash (rendered as an image to prevent copy-paste)
- **Social Accountability**: Uninstalling triggers a 30-second countdown before an embarrassing message is sent to your designated friend
- **Beautiful UI**: Dark, minimalist design with smooth animations

## Installation

### For Chrome:
1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `social-shame-extension` folder
5. The extension will install and open the setup page

### For Microsoft Edge:
1. Open Edge and navigate to `edge://extensions`
2. Enable "Developer mode" (toggle in left sidebar)
3. Click "Load unpacked"
4. Select the `social-shame-extension` folder
5. The extension will install and open the setup page

## Setup

1. **Enter your name** - This will be used in accountability messages
2. **Add your friend's email** - Your accountability partner who will receive the shame message if you cheat
3. **Set your time limit** - Choose how long you can spend on each tracked site before the blocker activates (1 min to 4 hours)

## How It Works

### Normal Usage
1. Browse tracked sites normally
2. Extension tracks time in the background
3. When you hit your daily limit, the screen blacks out
4. Type the displayed 64-character hash exactly to unlock (10 more minutes)
5. The hash is rendered as an image - no copy-pasting allowed!

### The Uninstall Trap
1. If you uninstall the extension to bypass the blocker...
2. You're redirected to a shame page with a 30-second countdown
3. If you don't reinstall in time, an embarrassing message is sent to your friend
4. The message includes how many hours you've wasted this month

## Email Integration (Required for Full Functionality)

The shame message feature requires a backend service to send emails. Options include:

### Option 1: EmailJS (Easiest)
1. Sign up at [emailjs.com](https://www.emailjs.com/)
2. Create an email service and template
3. Update `shame.html` with your EmailJS credentials:
```javascript
emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
  to_email: email,
  user_name: name,
  hours: hours,
  site: site
});
```

### Option 2: Custom Backend
Deploy a simple serverless function (AWS Lambda, Vercel, etc.) that receives the shame data and sends an email via SendGrid, Mailgun, or similar.

### Option 3: No Email (Psychological Effect Only)
The extension works without email integration - the threat itself provides friction. Users don't know if the email actually sends!

## File Structure

```
social-shame-extension/
├── manifest.json      # Extension configuration
├── background.js      # Service worker for time tracking
├── content.js         # Blocker overlay injection
├── blocker.css        # Styles for the blocker
├── popup.html/js      # Extension popup UI
├── setup.html         # Initial configuration wizard
├── shame.html         # Uninstall redirect page
└── images/            # Extension icons
```

## Tracked Sites

- Twitter / X (twitter.com, x.com)
- Instagram (instagram.com)
- Reddit (reddit.com)
- TikTok (tiktok.com)
- YouTube (youtube.com)
- Facebook (facebook.com)

## Customization

### Adding More Sites
Edit `manifest.json` to add new domains to:
- `host_permissions`
- `content_scripts.matches`

Then update `background.js` and `content.js` with the new site patterns.

### Changing the Hash Length
In `content.js`, modify the `generateHash()` function to change the challenge difficulty.

## Privacy

- All data is stored locally in your browser
- No data is sent anywhere except the optional shame email
- Time statistics never leave your device

## License

MIT License - Feel free to modify and distribute.

## Disclaimer

This extension is designed to help with self-control but should not be used as a substitute for professional help if you're struggling with internet addiction. The shame mechanic is intended as a lighthearted deterrent, not genuine harassment.
