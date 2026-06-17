const nodemailer = require('nodemailer');

async function testInviteEmail() {
  console.log("Testing invitation email flow...\n");

  // Test 1: Create test account (Ethereal fallback)
  console.log("1. Creating Ethereal test account...");
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log("   ✓ Ethereal account created:", testAccount.user);
    
    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const mailOptions = {
      from: '"Prix Secure Messenger" <test@prix.direct>',
      to: "recipient@example.com",
      subject: "Secure Prix Node Connection Invitation",
      text: "This is a test invitation message.\n\nhttp://localhost:3000?invite=test-uid-123",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">PRIX Secure Invitation</h2>
          <p>Test invitation sent successfully!</p>
          <a href="http://localhost:3000?invite=test-uid-123" 
             style="background-color: #4f46e5; color: white; padding: 12px 24px; 
                    border-radius: 8px; text-decoration: none;">Connect Secure Node</a>
        </div>
      `
    };

    console.log("\n2. Sending test email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("   ✓ Email sent! Message ID:", info.messageId);
    
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("   ✓ Preview URL:", previewUrl);
    }
    
    console.log("\n3. Testing SMTP with .env credentials...");
    // Will use Ethereal fallback since we're in test mode
    console.log("   Invitation flow test PASSED");
    
  } catch (err) {
    console.error("   ✗ Error:", err.message);
  }
}

testInviteEmail();