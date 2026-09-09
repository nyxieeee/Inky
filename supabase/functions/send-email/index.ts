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
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signature Requested: ${safeDocTitle}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .card { border-radius: 16px !important; padding: 24px 18px !important; }
      .btn-cta { display: block !important; width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 30px 12px; background-color: #f4efe9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #2C2C24;">
  
  <!-- Preheader snippet for inbox previews -->
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f4efe9;">
    ${safeSender} has requested your signature on "${safeDocTitle}". Review and sign securely via Inky.
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; margin: 0 auto;">
    <tr>
      <td>
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="card" style="background-color: #ffffff; border-radius: 24px; border: 1px solid rgba(44, 44, 36, 0.08); box-shadow: 0 10px 30px rgba(44, 44, 36, 0.06); padding: 36px 32px;">
          
          <!-- Logo & Header -->
          <tr>
            <td>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="display: inline-block; background-color: #b85a3c; color: #ffffff; width: 36px; height: 36px; line-height: 36px; border-radius: 10px; text-align: center; font-weight: bold; font-size: 18px; letter-spacing: -0.5px;">
                      ✦
                    </div>
                    <span style="font-size: 20px; font-weight: 700; color: #2C2C24; margin-left: 10px; vertical-align: middle; letter-spacing: -0.3px;">
                      Inky
                    </span>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <span style="display: inline-block; background-color: rgba(184, 90, 60, 0.1); color: #b85a3c; font-size: 11px; font-weight: 700; padding: 5px 11px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Signature Request
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td height="28"></td></tr>

          <!-- Greeting & Headline -->
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #2C2C24; line-height: 1.3;">
                Review and sign document
              </h1>
              <p style="margin: 12px 0 0 0; font-size: 14px; color: #64645A; line-height: 1.55;">
                Hello <strong>${safeRecipient}</strong>,<br/>
                <strong>${safeSender}</strong> has invited you to securely review and sign <strong>"${safeDocTitle}"</strong>.
              </p>
            </td>
          </tr>

          ${
            safeCustomMessage
              ? `<!-- Custom Message Box -->
          <tr>
            <td style="padding-top: 16px;">
              <div style="background-color: #f7f4ee; border-left: 3px solid #b85a3c; padding: 12px 16px; border-radius: 0 12px 12px 0; font-size: 13px; color: #4B4B40; font-style: italic; line-height: 1.5;">
                "${safeCustomMessage}"
              </div>
            </td>
          </tr>`
              : ''
          }

          <!-- Document Preview Card -->
          <tr>
            <td style="padding-top: 24px;">
              <div style="background-color: #faf8f5; border: 1px solid rgba(44, 44, 36, 0.08); border-radius: 16px; padding: 18px 20px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="width: 38px; vertical-align: top;">
                      <div style="width: 32px; height: 38px; background-color: #ffffff; border: 1px solid rgba(44, 44, 36, 0.12); border-radius: 6px; text-align: center; line-height: 38px; font-size: 16px;">
                        📄
                      </div>
                    </td>
                    <td style="vertical-align: top; padding-left: 10px;">
                      <div style="font-size: 14px; font-weight: 700; color: #2C2C24;">
                        ${safeDocTitle}
                      </div>
                      <div style="font-size: 12px; color: #7B7B70; margin-top: 3px;">
                        Requested by ${safeSender} &bull; Legally-binding electronic signature
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td style="padding-top: 28px; text-align: center;">
              <a href="${signingUrl}" target="_blank" rel="noopener noreferrer" class="btn-cta" style="display: inline-block; background-color: #b85a3c; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 34px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(184, 90, 60, 0.35); transition: all 0.2s ease;">
                Review &amp; Sign Document &rarr;
              </a>
            </td>
          </tr>

          <!-- Direct Link Fallback -->
          <tr>
            <td style="padding-top: 24px; border-top: 1px solid rgba(44, 44, 36, 0.08); margin-top: 28px;">
              <p style="margin: 0; font-size: 11.5px; color: #8C8C80; line-height: 1.5; text-align: center;">
                Button not working? Copy and paste this link into your browser:<br/>
                <a href="${signingUrl}" style="color: #b85a3c; word-break: break-all; text-decoration: underline;">
                  ${signingUrl}
                </a>
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
          <tr>
            <td style="text-align: center; font-size: 11px; color: #8C8C80; line-height: 1.5;">
              Delivered securely via Inky Electronic Signatures.<br/>
              No account creation or password required to sign.
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
