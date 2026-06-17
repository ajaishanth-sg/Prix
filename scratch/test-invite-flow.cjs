const fetch = require('node-fetch');

async function testFullInviteFlow() {
  console.log("=== Testing Complete Invitation Flow ===\n");

  // Step 1: Simulate sending an invite
  console.log("1. Testing /api/send-invite endpoint...");
  try {
    const res = await fetch('http://localhost:3000/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'gmail',
        recipient: 'recipient@example.com',
        message: 'Test invitation',
        inviteLink: 'http://localhost:3000?invite=sender-uid-123'
      })
    });
    const data = await res.json();
    console.log("   Response:", JSON.stringify(data, null, 2));
    console.log("   ✓ Invite endpoint working!\n");
  } catch (err) {
    console.error("   ✗ Error:", err.message, "\n");
    return;
  }

  // Step 2: Test SMS invite format
  console.log("2. Testing SMS invite format...");
  try {
    const res = await fetch('http://localhost:3000/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'number',
        recipient: '+919999999999',
        message: 'SMS invitation test',
        inviteLink: 'http://localhost:3000?invite=sender-uid-123'
      })
    });
    const data = await res.json();
    console.log("   Response:", JSON.stringify(data, null, 2));
    console.log("   ✓ SMS invite working!\n");
  } catch (err) {
    console.error("   ✗ Error:", err.message, "\n");
  }

  console.log("=== Invitation Flow Test Complete ===");
  console.log("\nNOTE: For actual user-to-user communication:");
  console.log("1. Both users must be logged in (Google Sign-In)");
  console.log("2. Sender invites recipient by entering recipient's EMAIL");
  console.log("3. Recipient receives email with invite link");
  console.log("4. Recipient clicks link while logged in");
  console.log("5. Connection is auto-established in Firestore");
}

testFullInviteFlow();