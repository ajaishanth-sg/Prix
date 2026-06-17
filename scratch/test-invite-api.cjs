const fetch = require('node-fetch');

async function testInviteApi() {
  console.log("Testing /api/send-invite endpoint...\n");

  try {
    const res = await fetch('http://localhost:3000/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'gmail',
        recipient: 'test@example.com',
        message: 'Test invitation message from API test',
        inviteLink: 'http://localhost:3000?invite=test-uid-123'
      })
    });

    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log("\n✓ API invite endpoint working!");
    } else {
      console.log("\n✗ API returned success=false");
    }
  } catch (err) {
    console.error("✗ Error calling API:", err.message);
    console.log("\nMake sure server is running: npm run dev");
  }
}

testInviteApi();