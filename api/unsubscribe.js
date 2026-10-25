import { getSql } from './_lib/db.js';

const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsubscribed</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Nunito:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    font-family: 'Nunito', sans-serif;
    color: #2C2547;
    padding: 24px;
  }
  .card {
    max-width: 440px;
    width: 100%;
    text-align: center;
    background: #ffffff;
    border: 1px solid #eee6f7;
    border-radius: 20px;
    padding: 40px 32px;
    box-shadow: 0 10px 30px rgba(44, 37, 71, 0.08);
  }
  .icon {
    font-size: 42px;
    margin-bottom: 8px;
  }
  h1 {
    font-family: 'Poppins', sans-serif;
    font-size: 24px;
    color: #2C2547;
    margin: 0 0 12px;
  }
  p {
    font-size: 16px;
    line-height: 1.5;
    margin: 0 0 24px;
    color: #2C2547;
  }
  .accent {
    color: #7C5CBF;
    font-weight: 700;
  }
  a.button {
    display: inline-block;
    background: #4BAE8A;
    color: #ffffff;
    text-decoration: none;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    font-size: 15px;
    padding: 12px 28px;
    border-radius: 999px;
    transition: opacity 0.15s ease;
  }
  a.button:hover {
    opacity: 0.9;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">💜</div>
    <h1>You've been unsubscribed</h1>
    <p>We're sorry to see you go! You won't receive any more emails from the <span class="accent">Molding Minds of the Future</span> community.</p>
    <a class="button" href="https://moldingmindsofthefuture.com">Back to the site</a>
  </div>
</body>
</html>
`;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const token = Array.isArray(req.query?.token) ? req.query.token[0] : req.query?.token;

  if (token) {
    try {
      const sql = getSql();
      await sql`
        UPDATE leads
        SET status = 'unsubscribed', unsubscribed_at = now()
        WHERE unsubscribe_token = ${token} AND status != 'unsubscribed'
      `;
    } catch (err) {
      // Never let a lookup/update failure surface to the visitor — the page
      // must always render the same friendly confirmation regardless of
      // whether the token was valid, already used, or malformed.
      console.error('unsubscribe: db update failed', err);
    }
  }

  res.setHeader('Content-Type', 'text/html').status(200).send(PAGE_HTML);
}
