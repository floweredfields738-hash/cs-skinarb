import { logger } from '../utils/logging';

let resend: any = null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'CSkinArb <noreply@csskin.io>';

async function getResend() {
  if (!resend) {
    const { Resend } = await import('resend');
    resend = new Resend(process.env.RESEND_API_KEY || '');
  }
  return resend;
}

export async function sendVerificationEmail(to: string, token: string, username: string): Promise<boolean> {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;

  try {
    const r = await getResend();
    await r.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Verify your email — CSkinArb',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a0f; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 40px; color: #e5e7eb;">
          <h1 style="color: #00e5ff; font-size: 20px; margin: 0 0 8px;">CSkinArb</h1>
          <p style="color: #9ca3af; font-size: 13px; margin: 0 0 24px;">Professional Trading Platform</p>
          <p style="margin: 0 0 16px;">Hey ${username},</p>
          <p style="margin: 0 0 24px;">Click the button below to verify your email address:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(to right, #0891b2, #00e5ff); color: #000; font-weight: 700; font-size: 14px; padding: 12px 32px; border-radius: 12px; text-decoration: none;">
            Verify Email
          </a>
          <p style="color: #6b7280; font-size: 11px; margin: 24px 0 0;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
        </div>
      `,
    });
    logger.info(`Verification email sent to ${to}`);
    return true;
  } catch (error: any) {
    logger.error(`Failed to send verification email: ${error.message}`);
    return false;
  }
}

export async function sendMagicLinkEmail(to: string, token: string): Promise<boolean> {
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/magic-link?token=${token}`;

  try {
    const r = await getResend();
    await r.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Your login link — CSkinArb',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a0f; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 40px; color: #e5e7eb;">
          <h1 style="color: #00e5ff; font-size: 20px; margin: 0 0 8px;">CSkinArb</h1>
          <p style="color: #9ca3af; font-size: 13px; margin: 0 0 24px;">Professional Trading Platform</p>
          <p style="margin: 0 0 24px;">Click the button below to sign in:</p>
          <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(to right, #0891b2, #00e5ff); color: #000; font-weight: 700; font-size: 14px; padding: 12px 32px; border-radius: 12px; text-decoration: none;">
            Sign In
          </a>
          <p style="color: #6b7280; font-size: 11px; margin: 24px 0 0;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
    logger.info(`Magic link sent to ${to}`);
    return true;
  } catch (error: any) {
    logger.error(`Failed to send magic link: ${error.message}`);
    return false;
  }
}
