// Vercel serverless function: /api/send
// Needs env var RESEND_API_KEY (set in Vercel project settings, never in the HTML).
// Optional env vars: TO_EMAIL, FROM_EMAIL.

const TO = process.env.TO_EMAIL || 'r2h.discharge.me@gmail.com';
// Until you verify a domain in Resend, use onboarding@resend.dev.
// That sender can only deliver to the email your Resend account was registered with.
const FROM = process.env.FROM_EMAIL || 'R2H Discharge Requests <onboarding@resend.dev>';

const ALLOWED = [
  'Complete guide: all modules A to F',
  'A: Medical and Health',
  'B: Modification and Equipment',
  'C: Personal Care and Support',
  'D: Mobility and Transport',
  'E: Ongoing Therapy',
  'F: Life Beyond Rehab: Health and Wellness',
];

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { modules, email, message, website } = req.body || {};

  // Honeypot: bots fill this, humans don't. Pretend success.
  if (website) return res.status(200).json({ ok: true });

  const mods = Array.isArray(modules) ? modules.filter(m => ALLOWED.includes(m)) : [];
  const msg = typeof message === 'string' ? message.trim().slice(0, 1500) : '';
  const mail = typeof email === 'string' ? email.trim().slice(0, 254) : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return res.status(400).json({ error: 'Invalid email' });
  if (!mods.length && !msg) return res.status(400).json({ error: 'Nothing to send' });

  const subject = mods.length
    ? (mods[0].startsWith('Complete')
        ? 'Module request: complete guide (A-F)'
        : `Module request: ${mods.map(m => m[0]).join(', ')}`)
    : 'Discharge guide enquiry';

  const html = `
    <h2>Discharge Checklist request</h2>
    <p><b>From:</b> ${esc(mail)}</p>
    <p><b>Modules requested:</b></p>
    ${mods.length ? `<ul>${mods.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : '<p><i>None selected</i></p>'}
    <p><b>Message:</b></p>
    <p>${msg ? esc(msg).replace(/\n/g, '<br>') : '<i>None</i>'}</p>
  `;
  const text = `From: ${mail}\nModules: ${mods.join('; ') || 'none'}\n\nMessage:\n${msg || 'none'}`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: mail, subject, html, text }),
    });
    if (!r.ok) {
      console.error('Resend error', r.status, await r.text());
      return res.status(502).json({ error: 'Email service error' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
