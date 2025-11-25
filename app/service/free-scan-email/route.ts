import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  // Vérification de la configuration SMTP
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USERNAME;
  const smtpPass = process.env.SMTP_PASSWORD;
  const mailFrom = process.env.SMTP_SENDER_EMAIL;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !mailFrom) {
    // Si la configuration SMTP est manquante, retourner une erreur.
    console.error('SMTP configuration is missing in environment variables.');
    return NextResponse.json({ error: 'Email service not configured.' }, { status: 500 });
  }

  try {
    const { email, url, cms_label, risk_level } = await request.json();
    if (!email || !url) {
      return NextResponse.json({ error: 'Email and url are required.' }, { status: 400 });
    }

    // Créer le transporteur pour envoyer l'e-mail
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // Si le port est 465, utiliser une connexion sécurisée
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Sujet et contenu de l'e-mail
    const subject = `CyberScan — ${risk_level ? `Risk: ${risk_level}` : 'Your instant scan'}`;
    const html = `
      <p>Hello,</p>
      <p>You requested the full CyberScan report for <strong>${url}</strong>.</p>
      <p>${risk_level ? `Detected risk level: <strong>${risk_level}</strong>.` : ''}</p>
      <p>${cms_label ? `Detected CMS: <strong>${cms_label}</strong>.` : ''}</p>
      <p>This is a preview — create your free account to unlock remediation guidance:</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://cyberscan.fr/register'}" target="_blank">Create my account</a></p>
      <p>— CyberScan Team</p>
    `;

    // Envoi de l'e-mail
    await transporter.sendMail({
      from: mailFrom,
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending free scan email:', error);
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}