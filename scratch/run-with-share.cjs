const { spawn } = require('child_process');
const path = require('path');

console.log("Starting Prix Secure Messenger server...\n");

// Start the server
const server = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

// Helper to show ngrok setup instructions
console.log(`
=== PRiX SECURE MESSENGER - SETUP FOR FRIEND ===

When server is ready at http://localhost:3000:

OPTION 1 - Use ngrok (if installed):
  npx ngrok http 3000
  Share the HTTPS URL with your friend

OPTION 2 - Use local network (easiest):
  Find your IP: ipconfig | findstr IPv4
  Share: http://[YOUR_IP]:3000
  Both connect from same network

OPTION 3 - Use Cloudflare Tunnel:
  npx cloudflared tunnel --url http://localhost:3000
  Shares a public HTTPS URL

OPTION 4 - Quick test locally:
  Open two browser windows to http://localhost:3000
  Sign in on both (same network for Firebase)

The app uses Firebase for real-time sync. Both users need Google accounts.
`);