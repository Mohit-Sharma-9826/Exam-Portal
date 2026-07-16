const nodemailer = require('nodemailer');

const sendOtpEmail = async (email, otp, name) => {
  // Always log to console for easy local debugging/testing
  console.log(`\n==============================================`);
  console.log(`[OTP Verification] Code generated for ${name} (${email}):`);
  console.log(`==============================================\n`);

  // Check if SMTP credentials are set
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.FROM_EMAIL;

  if (!host || !user || !pass) {
    console.warn('[Mailer Warning] SMTP details not fully set in .env. Falling back to console logging.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port == 465,
    auth: {
      user,
      pass
    }
  });

  const mailOptions = {
    from: `"ExamPortal Support" <${from}>`,
    to: email,
    subject: 'Verify Your ExamPortal Registration OTP',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>OTP Verification</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            margin: 0;
            padding: 0;
          }
          .email-wrapper {
            width: 100%;
            background-color: #f8fafc;
            padding: 40px 0;
          }
          .email-content {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            overflow: hidden;
            border: 1px solid #e2e8f0;
          }
          .email-header {
            background: linear-gradient(135deg, #4f46e5, #6366f1);
            color: #ffffff;
            padding: 30px;
            text-align: center;
          }
          .email-header h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          .email-body {
            padding: 40px 30px;
          }
          .email-body p {
            font-size: 16px;
            line-height: 24px;
            margin: 0 0 20px 0;
            color: #475569;
          }
          .otp-container {
            background-color: #f1f5f9;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
            border: 1px dashed #cbd5e1;
          }
          .otp-code {
            font-family: "Courier New", Courier, monospace;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 0.25em;
            color: #4f46e5;
            margin: 0;
          }
          .email-footer {
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-content">
            <div class="email-header">
              <h2>ExamPortal</h2>
            </div>
            <div class="email-body">
              <p>Hello <strong>${name}</strong>,</p>
              <p>Thank you for registering at ExamPortal. Please use the following 6-digit One-Time Password (OTP) to verify your email address. This code is valid for <strong>2 minutes</strong> and can only be used once.</p>
              
              <div class="otp-container">
                <div class="otp-code">${otp}</div>
              </div>
              
              <p>If you did not initiate this registration request, you can safely ignore this email.</p>
            </div>
            <div class="email-footer">
              &copy; 2026 ExamPortal. All rights reserved.
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer Success] Email sent successfully: ${info.messageId}`);
  } catch (err) {
    console.error('[Mailer Error] Failed to send email via SMTP:', err.message);
  }
};

module.exports = { sendOtpEmail };
