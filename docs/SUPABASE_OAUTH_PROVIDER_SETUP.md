# Supabase OAuth Provider Setup (Google, Apple, Facebook)

This guide is a practical checklist for setting up social login in Supabase for this project, using your current deployment domain.

## Scope

This app currently supports:

1. Email + password login
2. OAuth login with Google, Apple, Facebook

This app does not yet include a passwordless email (magic-link/OTP) UI flow.

## Your concrete URLs (use these)

1. Production URL: `https://travelflowapp.netlify.app`
2. Local URL: `http://localhost:5173`
3. Supabase callback URL format: `https://<project-ref>.supabase.co/auth/v1/callback`

To find `<project-ref>`:

1. Open your `VITE_SUPABASE_URL`
2. Example: `https://abcdefghijklmno.supabase.co`
3. Then `<project-ref>` is `abcdefghijklmno`

## Direct Supabase dashboard links (replace `<project-ref>`)

1. URL Configuration page:
   - <https://supabase.com/dashboard/project/<project-ref>/auth/url-configuration>
2. Providers page:
   - <https://supabase.com/dashboard/project/<project-ref>/auth/providers>
3. Users page (for verification):
   - <https://supabase.com/dashboard/project/<project-ref>/auth/users>

## Step 1: Configure Supabase Auth URL settings (exact fields)

Open:

- `Authentication` -> `URL Configuration`
- Direct link: <https://supabase.com/dashboard/project/<project-ref>/auth/url-configuration>

Set fields exactly like this:

1. Field: `Site URL`
2. Value: `https://travelflowapp.netlify.app`

3. Field: `Redirect URLs`
4. Add each entry (one line each):
   - `http://localhost:5173/**`
   - `https://travelflowapp.netlify.app/**`
   - `https://**--travelflowapp.netlify.app/**`

Why each one:

1. `localhost` is required for local development OAuth callback.
2. `travelflowapp.netlify.app` is required for production.
3. `**--travelflowapp.netlify.app` is required for Netlify preview deploy URLs.

Important:

1. This project sends OAuth users back to `/login`, so `/login` must match your allowed redirect patterns.
2. `Site URL` is also used for default email confirmation/password reset links.

Official doc:

- Redirect URLs: <https://supabase.com/docs/guides/auth/redirect-urls>

## Step 2: Google OAuth setup

### A) Create Google OAuth credentials

1. Open Google Cloud Console: <https://console.cloud.google.com/>
2. Configure OAuth consent screen.
3. Create OAuth Client ID.
4. Application type: `Web application`.

Add in Google field `Authorized JavaScript origins`:

1. `http://localhost:5173`
2. `https://travelflowapp.netlify.app`

Add in Google field `Authorized redirect URIs`:

1. `https://<project-ref>.supabase.co/auth/v1/callback`

Save and copy:

1. `Client ID`
2. `Client Secret`

### B) Paste into Supabase provider fields

Open:

- `Authentication` -> `Providers` -> `Google`
- Direct link: <https://supabase.com/dashboard/project/<project-ref>/auth/providers>

Fill exact Supabase fields:

1. Toggle: `Enable sign in with Google` -> ON
2. Field: `Client ID` -> paste Google Client ID
3. Field: `Client Secret` -> paste Google Client Secret
4. Click `Save`

Official docs:

- Supabase Google provider: <https://supabase.com/docs/guides/auth/social-login/auth-google>

## Step 3: Facebook OAuth setup

### A) Create Facebook app credentials

1. Open Facebook Developers: <https://developers.facebook.com/>
2. Create app.
3. Add `Facebook Login`.
4. Go to Facebook Login settings and add exact redirect URI:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
5. In `Use Cases` / auth settings, ensure permissions are enabled:
   - `public_profile`
   - `email`
6. Open `Settings` -> `Basic` and copy:
   - `App ID`
   - `App Secret`

### B) Paste into Supabase provider fields

Open:

- `Authentication` -> `Providers` -> `Facebook`
- Direct link: <https://supabase.com/dashboard/project/<project-ref>/auth/providers>

Fill exact Supabase fields:

1. Toggle: `Enable sign in with Facebook` -> ON
2. Field: `Client ID` -> paste Facebook `App ID`
3. Field: `Client Secret` -> paste Facebook `App Secret`
4. Click `Save`

Before production launch:

1. Set Facebook app mode to `Live`.

Official docs:

- Supabase Facebook provider: <https://supabase.com/docs/guides/auth/social-login/auth-facebook>

## Step 4: Apple OAuth setup

Apple is strict and requires a paid Apple Developer account.

### A) Configure in Apple Developer

1. Open Apple Developer: <https://developer.apple.com/>
2. Create/confirm App ID with `Sign in with Apple` capability.
3. Create a `Services ID` (this is your Apple OAuth client ID).
4. In Services ID web config, set:
   - Domain: `<project-ref>.supabase.co`
   - Return URL: `https://<project-ref>.supabase.co/auth/v1/callback`
5. Create Sign in with Apple key and download `.p8`.
6. Generate Apple client secret JWT using:
   - Team ID
   - Key ID
   - Services ID
   - `.p8`

### B) Paste into Supabase provider fields

Open:

- `Authentication` -> `Providers` -> `Apple`
- Direct link: <https://supabase.com/dashboard/project/<project-ref>/auth/providers>

Fill exact Supabase fields:

1. Toggle: `Enable sign in with Apple` -> ON
2. Field: `Client ID` -> your Apple Services ID
3. Field: `Client Secret` -> generated Apple client secret JWT
4. Click `Save`

Operational note:

1. Apple secret expires and must be rotated (commonly every 6 months).

Official docs:

- Supabase Apple provider: <https://supabase.com/docs/guides/auth/social-login/auth-apple>

## Step 5: Final provider checks in Supabase

On `Authentication` -> `Providers` make sure these are enabled:

1. `Email`
2. `Google`
3. `Facebook`
4. `Apple`
5. `Anonymous` (keep enabled for your guest queue flow)

## Step 6: Test checklist (exact order)

1. Open `https://travelflowapp.netlify.app/login`.
2. Test Google login.
3. Test Facebook login.
4. Test Apple login.
5. Test local login flow at `http://localhost:5173/login`.
6. Verify user appears in Supabase users page:
   - <https://supabase.com/dashboard/project/<project-ref>/auth/users>

## Step 7: Admin account + no-password clarification

Current project behavior:

1. Email login in UI requires password.
2. No passwordless email login UI is implemented yet.

What works now without password:

1. Use Google/Apple/Facebook with your admin email address.

If admin role does not apply automatically for existing user, run once in SQL editor:

```sql
update public.profiles p
set
  system_role = 'admin',
  tier_key = 'tier_premium',
  role_updated_at = now(),
  role_updated_by = p.id
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('xxxfanta@googlemail.com');
```

If you want true email-only login later:

1. Implement `signInWithOtp` flow.

Reference:

- Passwordless email: <https://supabase.com/docs/guides/auth/auth-email-passwordless>
