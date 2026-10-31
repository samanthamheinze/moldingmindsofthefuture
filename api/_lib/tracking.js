const TPT_HREF_RE = /href="(https:\/\/www\.teacherspayteachers\.com\/[^"]*)"/g;

// Rewrites every TPT link in an HTML email body to go through /api/go, so
// clicks can be attributed back to the email that drove them. Only touches
// teacherspayteachers.com links — everything else in the HTML is untouched.
export function wrapTptLinks(html, { source, campaignId, leadId } = {}) {
  const siteUrl = process.env.SITE_URL || '';

  return html.replace(TPT_HREF_RE, (match, target) => {
    const params = new URLSearchParams({ u: target });
    if (source) params.set('src', source);
    if (campaignId) params.set('c', campaignId);
    if (leadId) params.set('l', leadId);
    return `href="${siteUrl}/api/go?${params.toString()}"`;
  });
}
