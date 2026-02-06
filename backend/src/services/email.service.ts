import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export const emailService = {
  async sendEmail(to: string, subject: string, html: string) {
    try {
      if (!config.smtp.user || !config.smtp.pass) {
        logger.warn('SMTP credentials not configured, skipping email');
        return;
      }
      
      await transporter.sendMail({
        from: config.smtp.from,
        to,
        subject,
        html,
      });
      
      logger.info(`✅ Email sent to ${to}: ${subject}`);
    } catch (error: any) {
      // Log error but don't throw - allow operations to continue without email
      logger.error(`❌ Failed to send email to ${to}: ${error.message}`);
      logger.warn('⚠️ Email sending failed. Check SMTP settings or network/firewall.');
      // Don't throw - let the operation continue
    }
  },
  
  async sendOnboardingInvite(email: string, token: string, inviterName: string) {
    const link = `${config.urls.adminApp}/onboarding/${token}`;
    // Log onboarding link for development when SMTP is not configured
    logger.info(`📧 Onboarding link for ${email}: ${link}`);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to PaymentGateway</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You have been invited by <strong>${inviterName}</strong> to join the PaymentGateway platform.</p>
              <p>To complete your registration and verify your identity, please click the button below:</p>
              <p style="text-align: center;">
                <a href="${link}" class="button">Complete Onboarding</a>
              </p>
              <p>This link will expire in 24 hours.</p>
              <p>If you did not expect this invitation, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} PaymentGateway. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    await this.sendEmail(email, 'Complete Your Onboarding - PaymentGateway', html);
  },
  
  async sendOTP(email: string, otp: string) {
    // Log OTP for development when SMTP is not configured
    logger.info(`📧 OTP for ${email}: ${otp}`);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .otp { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; text-align: center; padding: 20px; background: #f0f4ff; border-radius: 10px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Email Verification</h2>
            <p>Your one-time password (OTP) for email verification is:</p>
            <div class="otp">${otp}</div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you did not request this verification, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;
    
    await this.sendEmail(email, 'Email Verification OTP - PaymentGateway', html);
  },
  
  async sendPasswordReset(email: string, token: string) {
    const link = `${config.urls.mainApp}/reset-password?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <p style="text-align: center;">
              <a href="${link}" class="button">Reset Password</a>
            </p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;
    
    await this.sendEmail(email, 'Password Reset - PaymentGateway', html);
  },
  
  async sendApprovalNotification(email: string, approved: boolean, reason?: string) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .status { padding: 15px; border-radius: 8px; margin: 20px 0; }
            .approved { background: #d4edda; color: #155724; }
            .rejected { background: #f8d7da; color: #721c24; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Account Status Update</h2>
            <div class="status ${approved ? 'approved' : 'rejected'}">
              ${approved 
                ? '<strong>Congratulations!</strong> Your account has been approved. You can now log in and start using the platform.'
                : `<strong>Account Not Approved</strong><br>${reason || 'Your account registration was not approved. Please contact support for more information.'}`
              }
            </div>
            ${approved ? `<p><a href="${config.urls.mainApp}/login">Click here to login</a></p>` : ''}
          </div>
        </body>
      </html>
    `;
    
    await this.sendEmail(
      email, 
      approved ? 'Account Approved - PaymentGateway' : 'Account Status Update - PaymentGateway',
      html
    );
  },
  
  async sendTransactionNotification(email: string, transaction: {
    type: string;
    amount: number;
    status: string;
    transactionId: string;
  }) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .details table { width: 100%; }
            .details td { padding: 8px 0; }
            .details td:first-child { font-weight: 600; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Transaction ${transaction.status === 'SUCCESS' ? 'Successful' : 'Update'}</h2>
            <div class="details">
              <table>
                <tr><td>Transaction ID</td><td>${transaction.transactionId}</td></tr>
                <tr><td>Type</td><td>${transaction.type}</td></tr>
                <tr><td>Amount</td><td>₹${transaction.amount.toFixed(2)}</td></tr>
                <tr><td>Status</td><td>${transaction.status}</td></tr>
              </table>
            </div>
          </div>
        </body>
      </html>
    `;
    
    await this.sendEmail(email, `Transaction ${transaction.status} - PaymentGateway`, html);
  },
};

