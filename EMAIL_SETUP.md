# Molaris Email Template Setup

Supabase is configured to send via Resend SMTP (`noreply@beanstack.studio`).
Update templates at:
https://supabase.com/dashboard/project/gigjvywfqguqpipovfyd/auth/templates

---

## Required redirect URLs

Go to: **Authentication → URL Configuration → Redirect URLs**

Add both of the following:
- `https://molaris-app-opal.vercel.app/join`
- `https://molaris-app-opal.vercel.app/reset-password`

---

## Template 1 — Confirm signup

**Subject:** `Confirm your Molaris account`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your email — Molaris</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg,hsl(205,62%,56%) 0%,hsl(175,52%,52%) 50%,hsl(150,42%,55%) 100%);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;">
    <tr>
      <td align="center" valign="middle" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
          <tr>
            <td style="background:rgba(255,255,255,0.97);border-radius:20px;padding:40px 36px;box-shadow:0 24px 80px rgba(0,0,0,0.18),0 4px 16px rgba(59,130,246,0.12);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,hsl(210,58%,36%) 0%,hsl(210,58%,54%) 100%);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                      <span style="color:white;font-size:24px;font-weight:800;line-height:1;">M</span>
                    </div>
                    <br />
                    <span style="font-size:22px;font-weight:800;color:#1e293b;letter-spacing:-0.5px;">Molaris</span>
                    <br />
                    <span style="font-size:13px;color:#64748b;">Clinic Management Portal</span>
                  </td>
                </tr>
              </table>
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(59,130,246,0.20),transparent);margin-bottom:28px;"></div>
              <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#1e293b;text-align:center;">Confirm your email</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#64748b;text-align:center;line-height:1.6;">
                Thanks for signing up for Molaris! Click the button below to confirm your email and finish setting up your clinic account.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,hsl(210,58%,36%) 0%,hsl(210,58%,54%) 100%);color:#ffffff;text-decoration:none;border-radius:999px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(59,130,246,0.35);">
                      Confirm Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
                Button not working? Copy and paste this link:<br />
                <a href="{{ .ConfirmationURL }}" style="color:hsl(210,58%,44%);word-break:break-all;">{{ .ConfirmationURL }}</a>
              </p>
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(59,130,246,0.15),transparent);margin:28px 0 20px;"></div>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                This link expires in 60 minutes. If you didn&rsquo;t create a Molaris account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:20px;">
              <span style="font-size:12px;color:rgba(255,255,255,0.70);">Powered by </span>
              <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.90);">Beanstack Studio · Molaris Clinic Management</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Template 2 — Invite user

**Subject:** `You've been invited to join {{ .Data.clinic_name }} on Molaris`

> ⚠️ Also set the redirect URL in this template to: `https://molaris-app-opal.vercel.app/join`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to Molaris</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg,hsl(205,62%,56%) 0%,hsl(175,52%,52%) 50%,hsl(150,42%,55%) 100%);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;">
    <tr>
      <td align="center" valign="middle" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
          <tr>
            <td style="background:rgba(255,255,255,0.97);border-radius:20px;padding:40px 36px;box-shadow:0 24px 80px rgba(0,0,0,0.18),0 4px 16px rgba(59,130,246,0.12);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,hsl(210,58%,36%) 0%,hsl(210,58%,54%) 100%);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                      <span style="color:white;font-size:24px;font-weight:800;line-height:1;">M</span>
                    </div>
                    <br />
                    <span style="font-size:22px;font-weight:800;color:#1e293b;letter-spacing:-0.5px;">Molaris</span>
                    <br />
                    <span style="font-size:13px;color:#64748b;">Clinic Management Portal</span>
                  </td>
                </tr>
              </table>
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(59,130,246,0.20),transparent);margin-bottom:28px;"></div>
              <div style="background:linear-gradient(135deg,rgba(219,234,254,0.8) 0%,rgba(191,219,254,0.6) 100%);border:1px solid rgba(59,130,246,0.20);border-radius:12px;padding:14px 18px;margin-bottom:24px;text-align:center;">
                <span style="font-size:13px;font-weight:600;color:hsl(210,58%,38%);">You've been invited to join a clinic</span>
              </div>
              <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#1e293b;text-align:center;">You're invited!</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#64748b;text-align:center;line-height:1.6;">
                {{ .Data.inviter_name }} has invited you to join {{ .Data.clinic_name }} on Molaris as a team member. Click the button below to set up your password and access the clinic portal.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,hsl(210,58%,36%) 0%,hsl(210,58%,54%) 100%);color:#ffffff;text-decoration:none;border-radius:999px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(59,130,246,0.35);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="background:rgba(241,245,249,0.80);border-radius:12px;padding:16px 18px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.8px;">What happens next</p>
                    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.7;">
                      1. Click &ldquo;Accept Invitation&rdquo;<br />
                      2. Set your password<br />
                      3. Sign in to the clinic portal<br />
                      4. Your admin will assign your role and access
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
                Button not working? Copy and paste this link:<br />
                <a href="{{ .ConfirmationURL }}" style="color:hsl(210,58%,44%);word-break:break-all;">{{ .ConfirmationURL }}</a>
              </p>
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(59,130,246,0.15),transparent);margin:24px 0 20px;"></div>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                This link expires in 7 days. If you didn&rsquo;t expect this invite, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:20px;">
              <span style="font-size:12px;color:rgba(255,255,255,0.70);">Powered by </span>
              <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.90);">Beanstack Studio · Molaris Clinic Management</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Template 3 — Reset password

**Subject:** `Reset your Molaris password`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Molaris password</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg,hsl(205,62%,56%) 0%,hsl(175,52%,52%) 50%,hsl(150,42%,55%) 100%);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;">
    <tr>
      <td align="center" valign="middle" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
          <tr>
            <td style="background:rgba(255,255,255,0.97);border-radius:20px;padding:40px 36px;box-shadow:0 24px 80px rgba(0,0,0,0.18),0 4px 16px rgba(59,130,246,0.12);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,hsl(210,58%,36%) 0%,hsl(210,58%,54%) 100%);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                      <span style="color:white;font-size:24px;font-weight:800;line-height:1;">M</span>
                    </div>
                    <br />
                    <span style="font-size:22px;font-weight:800;color:#1e293b;letter-spacing:-0.5px;">Molaris</span>
                    <br />
                    <span style="font-size:13px;color:#64748b;">Clinic Management Portal</span>
                  </td>
                </tr>
              </table>
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(59,130,246,0.20),transparent);margin-bottom:28px;"></div>
              <h1 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#1e293b;text-align:center;">Reset your password</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#64748b;text-align:center;line-height:1.6;">
                We received a request to reset the password for your Molaris account. Click the button below to choose a new password.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,hsl(210,58%,36%) 0%,hsl(210,58%,54%) 100%);color:#ffffff;text-decoration:none;border-radius:999px;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(59,130,246,0.35);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
                Button not working? Copy and paste this link:<br />
                <a href="{{ .ConfirmationURL }}" style="color:hsl(210,58%,44%);word-break:break-all;">{{ .ConfirmationURL }}</a>
              </p>
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(59,130,246,0.15),transparent);margin:28px 0 20px;"></div>
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                This link expires in 60 minutes. If you didn&rsquo;t request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:20px;">
              <span style="font-size:12px;color:rgba(255,255,255,0.70);">Powered by </span>
              <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.90);">Beanstack Studio · Molaris Clinic Management</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## How to apply

1. Go to [Supabase Auth Templates](https://supabase.com/dashboard/project/gigjvywfqguqpipovfyd/auth/templates)
2. Select each template tab (Confirm signup, Invite user, Reset password)
3. Paste the corresponding HTML above
4. Update the subject line
5. Save
6. Go to **Authentication → URL Configuration** and add the two redirect URLs listed above
7. Test by triggering each email flow end-to-end with a real email address
