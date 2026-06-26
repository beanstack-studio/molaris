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

## Color notes (teal-sage gradient)

The app background gradient uses `hsl(175 52% 52%)` (teal) → `hsl(150 42% 55%)` (sage green).
These are too light for button text. For email CTA buttons, darkened equivalents are used:
- Teal: `#0d9488` (≈ hsl(175, 68%, 31%))
- Sage green: `#2d8b55` (≈ hsl(150, 51%, 36%))

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
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);padding:40px 36px;">
              <!-- Header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <img src="{{ .SiteURL }}/web-app-manifest-192x192.png" width="64" height="64"
                         alt="Molaris"
                         style="border-radius:14px;display:block;margin:0 auto 12px;object-fit:cover;" />
                    <span style="display:block;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Molaris</span>
                    <span style="display:block;font-size:12px;color:#6b7280;margin-top:4px;">Clinic Management Portal</span>
                  </td>
                </tr>
              </table>
              <!-- Title -->
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;text-align:center;">
                Confirm your email address
              </h1>
              <!-- Body -->
              <p style="margin:0 0 28px;font-size:14px;color:#4b5563;text-align:center;line-height:1.65;">
                Thanks for signing up for Molaris! Click the button below to confirm your email and finish setting up your clinic account.
              </p>
              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;background:linear-gradient(135deg,#0d9488,#2d8b55);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.2px;">
                      Confirm Email Address →
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <div style="border-top:1px solid #f3f4f6;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                  This link expires in 60 minutes. If you didn't sign up for Molaris, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:16px 32px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                Powered by Beanstack Studio &middot; Molaris Clinic Management
              </p>
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

> Also set the redirect URL in Supabase for this template to: `https://molaris-app-opal.vercel.app/join`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited — Molaris</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);padding:40px 36px;">
              <!-- Header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <img src="{{ .SiteURL }}/web-app-manifest-192x192.png" width="64" height="64"
                         alt="Molaris"
                         style="border-radius:14px;display:block;margin:0 auto 12px;object-fit:cover;" />
                    <span style="display:block;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Molaris</span>
                    <span style="display:block;font-size:12px;color:#6b7280;margin-top:4px;">Clinic Management Portal</span>
                  </td>
                </tr>
              </table>
              <!-- Title -->
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;text-align:center;">
                You've been invited!
              </h1>
              <!-- Body -->
              <p style="margin:0 0 28px;font-size:14px;color:#4b5563;text-align:center;line-height:1.65;">
                {{ .Data.inviter_name }} has invited you to join <strong>{{ .Data.clinic_name }}</strong> on Molaris as a team member. Click the button below to set up your password and access the clinic portal.
              </p>
              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;background:linear-gradient(135deg,#0d9488,#2d8b55);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.2px;">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <div style="border-top:1px solid #f3f4f6;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                  This link expires in 7 days. If you weren't expecting this invite, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:16px 32px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                Powered by Beanstack Studio &middot; Molaris Clinic Management
              </p>
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
  <title>Reset your password — Molaris</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);padding:40px 36px;">
              <!-- Header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <img src="{{ .SiteURL }}/web-app-manifest-192x192.png" width="64" height="64"
                         alt="Molaris"
                         style="border-radius:14px;display:block;margin:0 auto 12px;object-fit:cover;" />
                    <span style="display:block;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Molaris</span>
                    <span style="display:block;font-size:12px;color:#6b7280;margin-top:4px;">Clinic Management Portal</span>
                  </td>
                </tr>
              </table>
              <!-- Title -->
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;text-align:center;">
                Reset your password
              </h1>
              <!-- Body -->
              <p style="margin:0 0 28px;font-size:14px;color:#4b5563;text-align:center;line-height:1.65;">
                We received a request to reset the password for your Molaris account. Click the button below to choose a new password.
              </p>
              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;background:linear-gradient(135deg,#0d9488,#2d8b55);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.2px;">
                      Reset Password →
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <div style="border-top:1px solid #f3f4f6;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                  This link expires in 60 minutes. If you didn't request a password reset, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:16px 32px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                Powered by Beanstack Studio &middot; Molaris Clinic Management
              </p>
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
