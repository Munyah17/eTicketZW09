// One-off: installs E-TicketsZW-branded GoTrue email templates on the project
// via the Management API.   node --env-file=.env.local scripts/_set-auth-templates.mjs
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) { console.error("Missing SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN"); process.exit(1); }

const wrap = (heading, body, cta) => `<div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f6f8;padding:32px 16px;color:#0f172a;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<div style="height:4px;background:#059669;"></div>
<div style="padding:24px 28px 0;">
<p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#059669;">E-TicketsZW</p>
<h1 style="margin:8px 0 0;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#0f172a;">${heading}</h1>
</div>
<div style="padding:20px 28px 28px;font-size:15px;line-height:1.6;color:#334155;">
${body}
${cta ? `<div style="text-align:center;margin:24px 0 8px;"><a href="${cta.href}" style="display:inline-block;background:#059669;color:#ffffff;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px;text-decoration:none;">${cta.label}</a></div>` : ""}
</div>
</div>
<div style="max-width:520px;margin:16px auto 0;text-align:center;">
<p style="margin:0;font-size:12px;color:#94a3b8;">E-TicketsZW &middot; <a href="https://eticket.co.zw" style="color:#059669;text-decoration:none;">eticket.co.zw</a> &middot; info@eticket.co.zw</p>
<p style="margin:6px 0 0;font-size:11px;color:#b6c0cc;">Replies to this email reach our team directly.</p>
</div>
</div>`;

const patch = {
  mailer_subjects_confirmation: "Confirm your E-TicketsZW account",
  mailer_subjects_recovery: "Reset your E-TicketsZW password",
  mailer_subjects_email_change: "Confirm your new email — E-TicketsZW",
  mailer_subjects_magic_link: "Your E-TicketsZW sign-in link",
  mailer_subjects_invite: "You're invited to E-TicketsZW",
  mailer_subjects_reauthentication: "{{ .Token }} is your E-TicketsZW verification code",

  mailer_templates_confirmation_content: wrap(
    "Confirm your email address",
    `<p>Welcome aboard! One last step — confirm that <strong>{{ .Email }}</strong> is yours and your account is ready.</p>`,
    { href: "{{ .ConfirmationURL }}", label: "Confirm my account" }
  ),
  mailer_templates_recovery_content: wrap(
    "Reset your password",
    `<p>We received a request to reset the password for <strong>{{ .Email }}</strong>.</p><p>If you didn't request this, you can safely ignore this email — your password stays unchanged.</p>`,
    { href: "{{ .ConfirmationURL }}", label: "Reset password" }
  ),
  mailer_templates_email_change_content: wrap(
    "Confirm your new email",
    `<p>You asked to change the email on your E-TicketsZW account to <strong>{{ .NewEmail }}</strong>. Confirm it below to finish the change.</p><p>If you didn't request this, contact support immediately.</p>`,
    { href: "{{ .ConfirmationURL }}", label: "Confirm new email" }
  ),
  mailer_templates_magic_link_content: wrap(
    "Your sign-in link",
    `<p>Here's your one-time sign-in link for <strong>{{ .Email }}</strong>. It expires shortly and can only be used once.</p>`,
    { href: "{{ .ConfirmationURL }}", label: "Sign in to E-TicketsZW" }
  ),
  mailer_templates_invite_content: wrap(
    "You're invited",
    `<p>You've been invited to create an E-TicketsZW account for <strong>{{ .Email }}</strong>. Accept below to get started.</p>`,
    { href: "{{ .ConfirmationURL }}", label: "Accept invitation" }
  ),
  mailer_templates_reauthentication_content: wrap(
    "Your verification code",
    `<p>Use this code to verify it's you. It expires shortly.</p><p style="text-align:center;font-size:28px;font-weight:700;letter-spacing:0.3em;color:#0f172a;margin:16px 0;">{{ .Token }}</p><p>If you didn't request this code, secure your account by changing your password.</p>`,
    null
  ),
};

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(patch),
});
console.log("Status:", r.status);
if (!r.ok) console.log((await r.text()).slice(0, 1000));
else console.log("Templates installed:", Object.keys(patch).length);
