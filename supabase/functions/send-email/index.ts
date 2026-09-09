// @ts-nocheck
import nodemailer from 'npm:nodemailer@6.9.13';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailPayload {
  to: string;
  recipientName?: string;
  senderName?: string;
  senderEmail?: string;
  docTitle: string;
  signingUrl: string;
  customMessage?: string;
}

function buildInkyEmailHtml({
  recipientName,
  senderName,
  docTitle,
  signingUrl,
  customMessage,
}: {
  recipientName: string;
  senderName: string;
  docTitle: string;
  signingUrl: string;
  customMessage?: string;
}) {
  const safeDocTitle = docTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeRecipient = (recipientName || 'there').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeSender = (senderName || 'Someone').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeCustomMessage = customMessage
    ? customMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Signature Requested: ${safeDocTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Philosopher:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Philosopher:ital,wght@0,400;0,700;1,400;1,700&display=swap');

    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    .font-inky {
      font-family: 'Philosopher', Georgia, 'Times New Roman', serif;
    }
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1A1D17 !important; }
      .email-card { background-color: #1E2219 !important; border-color: rgba(255, 255, 255, 0.08) !important; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4) !important; }
      .email-title { color: #E8E5DC !important; }
      .email-sub { color: #B0ADA2 !important; }
      .email-doc-box { background-color: #2A2E24 !important; border-color: rgba(255, 255, 255, 0.08) !important; }
      .email-doc-icon-tile { background-color: #1E2219 !important; border-color: rgba(255, 255, 255, 0.1) !important; }
      .email-doc-title { color: #E8E5DC !important; }
      .email-doc-meta { color: #8A8A7E !important; }
      .email-quote-box { background-color: rgba(193, 140, 93, 0.12) !important; color: #D4CEBF !important; }
      .email-footer { color: #8A8A7E !important; }
      .email-badge { background-color: rgba(93, 112, 82, 0.25) !important; color: #A5C299 !important; border-color: rgba(93, 112, 82, 0.35) !important; }
      .email-divider { background-color: rgba(255, 255, 255, 0.08) !important; }
      .email-dashed-border { border-color: rgba(255, 255, 255, 0.1) !important; }
    }
    @media only screen and (max-width: 600px) {
      .email-card-td { padding: 28px 20px !important; }
      .btn-cta { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; padding: 15px 20px !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin: 0; padding: 36px 12px; background-color: #FDFCF8; font-family: 'Philosopher', Georgia, 'Times New Roman', serif; -webkit-font-smoothing: antialiased; color: #2C2C24;">
  
  <!-- Preheader snippet -->
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #FDFCF8; mso-hide: all;">
    ${safeSender} requested your signature on "${safeDocTitle}". Review and sign securely with Inky.
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 550px; margin: 0 auto;">
    <tr>
      <td>
        <!-- ── Main Card (Inky Rice Paper & Timber Border) ── -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="background-color: #FEFEFA; border-radius: 26px; border: 1px solid #DED8CF; box-shadow: 0 10px 40px -10px rgba(193, 140, 93, 0.18), 0 4px 20px -2px rgba(93, 112, 82, 0.12); overflow: hidden;">
          <tr>
            <td class="email-card-td" style="padding: 40px 34px;">
              
              <!-- ── Brand Header (Moss Green Emblem + Inky Logo) ── -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Inky Moss Squircle Icon -->
                        <td style="width: 38px; height: 38px; background-color: #5D7052; border-radius: 13px; text-align: center; vertical-align: middle; box-shadow: 0 4px 14px rgba(93, 112, 82, 0.28);">
                          <span style="color: #F3F4F1; font-size: 19px; line-height: 38px; display: block;">✍</span>
                        </td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <span class="email-title" style="font-family: 'Philosopher', Georgia, serif; font-size: 23px; font-weight: 700; color: #2C2C24; letter-spacing: -0.4px;">
                            Inky
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <span class="email-badge" style="display: inline-block; background-color: rgba(93, 112, 82, 0.12); color: #5D7052; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 10.5px; font-weight: 700; padding: 5px 13px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.6px; border: 1px solid rgba(93, 112, 82, 0.2);">
                      Signature Request
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Divider line (Raw Timber tone) -->
              <div class="email-divider" style="height: 1px; background-color: #DED8CF; margin: 26px 0 24px 0; opacity: 0.75;"></div>

              <!-- Greeting & Headline (Philosopher Serif) -->
              <h1 class="email-title font-inky" style="margin: 0; font-family: 'Philosopher', Georgia, serif; font-size: 23px; font-weight: 700; color: #2C2C24; line-height: 1.3; letter-spacing: -0.3px;">
                Review and sign document
              </h1>
              <p class="email-sub font-inky" style="margin: 12px 0 0 0; font-family: 'Philosopher', Georgia, serif; font-size: 15px; color: #5A5A4E; line-height: 1.65;">
                Hello <strong>${safeRecipient}</strong>,<br/>
                <strong>${safeSender}</strong> has invited you to securely sign <strong>"${safeDocTitle}"</strong>.
              </p>

              <!-- Optional Custom Message (Terracotta / Clay Accent) -->
              ${
                safeCustomMessage
                  ? `<div class="email-quote-box font-inky" style="background-color: rgba(193, 140, 93, 0.08); border-left: 3px solid #C18C5D; padding: 13px 18px; border-radius: 0 14px 14px 0; margin-top: 18px; font-size: 14px; color: #4A4A40; font-style: italic; line-height: 1.55;">
                      "${safeCustomMessage}"
                    </div>`
                  : ''
              }

              <!-- Document Card (Inky Stone surface with subtle Timber border) -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px;">
                <tr>
                  <td class="email-doc-box" style="background-color: #F0EBE5; border: 1px solid #DED8CF; border-radius: 18px; padding: 18px 20px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width: 42px; vertical-align: top;">
                          <div class="email-doc-icon-tile" style="width: 36px; height: 42px; background-color: #FEFEFA; border: 1px solid #DED8CF; border-radius: 9px; text-align: center; line-height: 42px; font-size: 18px; box-shadow: 0 2px 6px rgba(44, 44, 36, 0.05);">
                            📄
                          </div>
                        </td>
                        <td style="padding-left: 14px; vertical-align: top;">
                          <div class="email-doc-title font-inky" style="font-family: 'Philosopher', Georgia, serif; font-size: 15px; font-weight: 700; color: #2C2C24; line-height: 1.35;">
                            ${safeDocTitle}
                          </div>
                          <div class="email-doc-meta" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #78786C; margin-top: 5px; line-height: 1.4;">
                            Requested by <strong style="color: inherit;">${safeSender}</strong> &bull; Legally-binding e-signature
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Action Button (Iconic Inky Moss Green Pill) -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 28px;">
                <tr>
                  <td style="text-align: center;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${signingUrl}" style="height:50px;v-text-anchor:middle;width:270px;" arcsize="50%" stroke="f" fillcolor="#5D7052">
                    <w:anchorlock/>
                    <center style="color:#F3F4F1;font-family:Georgia,serif;font-size:16px;font-weight:bold;">Review &amp; Sign Document &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <a href="${signingUrl}" target="_blank" rel="noopener noreferrer" class="btn-cta font-inky" style="mso-hide:all; display: inline-block; background-color: #5D7052; color: #F3F4F1; font-family: 'Philosopher', Georgia, serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 15px 38px; border-radius: 9999px; box-shadow: 0 6px 24px -2px rgba(93, 112, 82, 0.35); text-align: center; letter-spacing: 0.2px;">
                      Review &amp; Sign Document &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Trust & Security Seal -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
                <tr>
                  <td style="text-align: center;">
                    <span class="email-footer" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #78786C; font-weight: 500;">
                      🔒 256-Bit SSL Encrypted &bull; Audit Trail Recorded &bull; No Login Required
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Direct Link Fallback (Raw Timber dashed divider) -->
              <div class="email-dashed-border" style="margin-top: 24px; padding-top: 20px; border-top: 1px dashed #DED8CF;">
                <p class="email-footer" style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #78786C; line-height: 1.5; text-align: center;">
                  Button not working? Copy and paste this secure link directly:<br/>
                  <a href="${signingUrl}" style="color: #5D7052; word-break: break-all; text-decoration: underline; font-weight: 600;">
                    ${signingUrl}
                  </a>
                </p>
              </div>

            </td>
          </tr>
        </table>

        <!-- ── Footer ── -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
          <tr>
            <td class="email-footer font-inky" style="text-align: center; font-family: 'Philosopher', Georgia, serif; font-size: 12px; color: #78786C; line-height: 1.65;">
              Delivered securely via <strong>Inky</strong> — Electronic Signatures.<br/>
              Intended exclusively for <strong>${safeRecipient}</strong>. Do not forward this link.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

Deno.serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GMAIL_USER = Deno.env.get('GMAIL_USER');
    const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD in Supabase Secrets');
      return new Response(
        JSON.stringify({
          error:
            'Gmail credentials not configured in Supabase Secrets. Please set GMAIL_USER and GMAIL_APP_PASSWORD.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: SendEmailPayload = await req.json();

    if (!payload.to || !payload.signingUrl || !payload.docTitle) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, docTitle, or signingUrl' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cleanPassword = GMAIL_APP_PASSWORD.replace(/\s+/g, '');
    const senderName = payload.senderName || 'Inky Document Signatures';
    const recipientName = payload.recipientName || '';
    const subject = `Signature requested: ${payload.docTitle}`;

    // 2. Setup Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: cleanPassword,
      },
    });

    // 3. Build HTML and text fallbacks
    const html = buildInkyEmailHtml({
      recipientName,
      senderName,
      docTitle: payload.docTitle,
      signingUrl: payload.signingUrl,
      customMessage: payload.customMessage,
    });

    const text = `Hello ${recipientName || 'there'},\n\n${senderName} has requested your signature on "${payload.docTitle}".\n\nPlease click the secure signing link below:\n${payload.signingUrl}\n\n— Sent securely via Inky`;

    // 4. Send Email via Gmail SMTP
    const info = await transporter.sendMail({
      from: `"${senderName}" <${GMAIL_USER}>`,
      to: payload.to,
      subject,
      text,
      html,
    });

    console.log(`✅ Email sent successfully to ${payload.to}: ${info.messageId}`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
        recipient: payload.to,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error sending email through Gmail SMTP:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Failed to dispatch email via Gmail SMTP',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
