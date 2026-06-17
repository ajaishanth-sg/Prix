const nodemailer = require('nodemailer');

async function testGmailSmtp() {
  console.log("Testing Gmail SMTP credentials from .env...\n");

  const smtpHost = "smtp.gmail.com";
  const smtpPort = "465";
  const smtpUser = "ajaishanth22@gmail.com";
  const smtpPass = "cgpz oveu rmkh sjxj";

  try {
    console.log("Creating transporter with Gmail SMTP...");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    console.log("Verifying SMTP connection...");
    const verification = await transporter.verify();
    console.log("   ✓ SMTP connection verified:", verification);

    const info = await transporter.sendMail({
      from: '"Prix Secure Messenger" <ajaishanth22@gmail.com>',
      to: smtpUser,
      subject: "Test Invitation",
      text: "If you see this, Gmail SMTP is working!"
    });

    console.log("   ✓ Test email sent! Message ID:", info.messageId);
  } catch (err) {
    console.error("   ✗ SMTP Error:", err.message);
    console.log("\n   Note: For real invitations, use a valid Gmail App Password");
    console.log("   Current password may be expired - generate new one at:");
    console.log("   https://myaccount.google.com/apppasswords");
  }
}

testGmailSmtp();