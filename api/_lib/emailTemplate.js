// Centralizes the branded wrapper for every outbound email (welcome +
// newsletter). This is the ONLY place that renders the CAN-SPAM footer
// (mailing address + unsubscribe link), so nothing calling wrapEmail() can
// accidentally ship without it.

const PURPLE = '#7C5CBF';
const DARK = '#2C2547';
const GREEN_PALE = '#E8F7F1';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

export function wrapEmail({ subject, preheader, bodyHtml, unsubscribeUrl, logoUrl }) {
  const safeSubject = escapeHtml(subject ?? '');
  const mailingAddress = process.env.COMPANY_MAILING_ADDRESS;
  const addressLine = mailingAddress
    ? `<p style="margin:0 0 8px;">${escapeHtml(mailingAddress)}</p>`
    : '';
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl ?? '#');
  // Hidden preview text shown next to the subject line in most inbox lists.
  // Padded so clients don't fall back to rendering visible body text instead.
  const preheaderHtml = preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; font-size:1px; line-height:1px; color:#f5f3fa; opacity:0;">
         ${escapeHtml(preheader)}${'&nbsp;'.repeat(60)}
       </div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeSubject}</title>
<!--[if !mso]><!-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
<!--<![endif]-->
</head>
<body style="margin:0; padding:0; background:#ffffff; font-family: 'Poppins', Arial, sans-serif;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="background:${GREEN_PALE}; padding:38px 20px;">
        ${logoUrl
          ? `<img src="${logoUrl}" width="104" height="110" alt="Molding Minds of the Future" style="display:block; margin:0 auto;">`
          : ''}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:32px 20px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="font-family: 'Nunito', Arial, sans-serif; font-size:16px; line-height:1.6; color:${DARK};">
              ${bodyHtml ?? ''}
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px; margin-top:24px; border-top:1px solid #eee6f7; font-family: 'Nunito', Arial, sans-serif; font-size:12px; line-height:1.6; color:#6b6480;">
              ${addressLine}
              <p style="margin:0;">
                <a href="${safeUnsubscribeUrl}" style="color:${PURPLE}; text-decoration:underline;">Unsubscribe</a>
                from these emails at any time.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
