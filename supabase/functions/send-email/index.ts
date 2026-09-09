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
  <style>
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
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #141412 !important; }
      .email-card { background-color: #20201D !important; border-color: rgba(255, 255, 255, 0.12) !important; }
      .email-title { color: #FFFFFF !important; }
      .email-sub { color: #B3B3A6 !important; }
      .email-doc-box { background-color: #2A2A26 !important; border-color: rgba(255, 255, 255, 0.1) !important; }
      .email-doc-title { color: #FFFFFF !important; }
      .email-doc-meta { color: #9E9E92 !important; }
      .email-footer { color: #7E7E73 !important; }
    }
    @media only screen and (max-width: 600px) {
      .email-card-td { padding: 28px 20px !important; }
      .btn-cta { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin: 0; padding: 32px 12px; background-color: #F6F4EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #2C2C24;">
  
  <!-- Preheader preview snippet -->
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #F6F4EE; mso-hide: all;">
    ${safeSender} requested your signature on "${safeDocTitle}". Review and sign securely.
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; margin: 0 auto;">
    <tr>
      <td>
        <!-- ── Main Card ── -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="background-color: #FFFFFF; border-radius: 24px; border: 1px solid rgba(44, 44, 36, 0.1); box-shadow: 0 12px 36px rgba(44, 44, 36, 0.06); overflow: hidden;">
          <tr>
            <td class="email-card-td" style="padding: 36px 32px;">
              
              <!-- Top Bar: Brand & Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Inky Logo Icon -->
                        <td style="width: 36px; height: 36px; background-color: #B85A3C; border-radius: 12px; text-align: center; vertical-align: middle; box-shadow: 0 4px 10px rgba(184, 90, 60, 0.28);">
                          <span style="color: #FFFFFF; font-size: 18px; font-weight: bold; line-height: 36px; display: block;">✍</span>
                        </td>
                        <td style="padding-left: 10px; vertical-align: middle;">
                          <span class="email-title" style="font-size: 19px; font-weight: 800; color: #2C2C24; letter-spacing: -0.4px;">Inky</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <span style="display: inline-block; background-color: rgba(184, 90, 60, 0.12); color: #B85A3C; font-size: 10.5px; font-weight: 700; padding: 5px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.6px;">
                      Signature Request
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Divider line -->
              <div style="height: 1px; background-color: rgba(44, 44, 36, 0.08); margin: 24px 0 20px 0;"></div>

              <!-- Greeting & Headline -->
              <h1 class="email-title" style="margin: 0; font-size: 21px; font-weight: 700; color: #2C2C24; line-height: 1.35; letter-spacing: -0.3px;">
                Review and sign document
              </h1>
              <p class="email-sub" style="margin: 10px 0 0 0; font-size: 14px; color: #64645A; line-height: 1.6;">
                Hello <strong>${safeRecipient}</strong>,<br/>
                <strong>${safeSender}</strong> has invited you to securely sign <strong>"${safeDocTitle}"</strong>.
              </p>

              ${
                safeCustomMessage
                  ? `<div style="background-color: rgba(184, 90, 60, 0.06); border-left: 3px solid #B85A3C; padding: 12px 16px; border-radius: 0 12px 12px 0; margin-top: 16px; font-size: 13px; color: #4B4B40; font-style: italic; line-height: 1.5;">
                      "${safeCustomMessage}"
                    </div>`
                  : ''
              }

              <!-- Document Summary Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 22px;">
                <tr>
                  <td class="email-doc-box" style="background-color: #F8F6F1; border: 1px solid rgba(44, 44, 36, 0.09); border-radius: 16px; padding: 16px 18px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="width: 38px; vertical-align: top;">
                          <div style="width: 32px; height: 38px; background-color: #FFFFFF; border: 1px solid rgba(44, 44, 36, 0.12); border-radius: 8px; text-align: center; line-height: 38px; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.04);">
                            📄
                          </div>
                        </td>
                        <td style="padding-left: 12px; vertical-align: top;">
                          <div class="email-doc-title" style="font-size: 14px; font-weight: 700; color: #2C2C24; line-height: 1.3;">
                            ${safeDocTitle}
                          </div>
                          <div class="email-doc-meta" style="font-size: 11.5px; color: #7B7B70; margin-top: 4px; line-height: 1.4;">
                            Requested by <strong>${safeSender}</strong> &bull; Legally-binding electronic signature
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Action Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 26px;">
                <tr>
                  <td style="text-align: center;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${signingUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="50%" stroke="f" fillcolor="#B85A3C">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Review &amp; Sign Document &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <a href="${signingUrl}" target="_blank" rel="noopener noreferrer" class="btn-cta" style="mso-hide:all; display: inline-block; background-color: #B85A3C; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 9999px; box-shadow: 0 4px 16px rgba(184, 90, 60, 0.35); text-align: center; letter-spacing: -0.2px;">
                      Review &amp; Sign Document &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Seal Note -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 18px;">
                <tr>
                  <td style="text-align: center;">
                    <span class="email-footer" style="font-size: 11px; color: #8A8A7E; font-weight: 500;">
                      🔒 256-Bit SSL Encrypted &bull; No login or account required
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Direct Link Fallback -->
              <div style="margin-top: 22px; padding-top: 18px; border-top: 1px dashed rgba(44, 44, 36, 0.1);">
                <p class="email-footer" style="margin: 0; font-size: 11px; color: #8A8A7E; line-height: 1.5; text-align: center;">
                  Button not working? Copy and paste this secure link directly:<br/>
                  <a href="${signingUrl}" style="color: #B85A3C; word-break: break-all; text-decoration: underline;">
                    ${signingUrl}
                  </a>
                </p>
              </div>

            </td>
          </tr>
        </table>

        <!-- ── Footer ── -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 18px;">
          <tr>
            <td class="email-footer" style="text-align: center; font-size: 11px; color: #9E9E90; line-height: 1.6;">
              This invitation was sent securely via <strong>Inky Electronic Signatures</strong>.<br/>
              Intended exclusively for <strong>${safeRecipient}</strong>. Do not forward this email.
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
