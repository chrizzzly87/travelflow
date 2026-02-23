# Contributing to TravelFlow

Thank you for contributing to TravelFlow! This document provides guidelines for maintaining code quality and legal compliance.

## Cookie Compliance

TravelFlow is subject to GDPR and ePrivacy regulations. **Before setting any new cookies**, follow this mandatory workflow:

### 1. Add to Cookie Registry

Update `lib/legal/cookies.config.ts`:

```typescript
export const COOKIE_REGISTRY: CookieRegistry = {
  // For essential cookies (no consent required):
  essential: [
    {
      name: 'your_cookie_name',
      purpose: 'Clear description of what this cookie does',
      duration: '7 days' | 'Session' | 'Persistent',
      provider: 'TravelFlow' | 'Third-party name',
      category: 'essential',
    },
  ],

  // For analytics cookies (consent required):
  analytics: [
    // Add here
  ],

  // For marketing cookies (consent required):
  marketing: [
    // Add here
  ],
};
```

### 2. Determine Category

**Essential cookies:**
- Strictly necessary for core functionality
- Cannot be disabled by user
- Examples: session, CSRF token, authentication

**Analytics cookies:**
- Measure usage, performance, user behavior
- Require opt-in consent
- Examples: tracking scripts, heatmaps

**Marketing cookies:**
- Advertising, retargeting, third-party marketing
- Require opt-in consent
- Examples: ad networks, conversion pixels

### 3. Update Consent Logic

If your cookie is **not essential**, update the consent handling:

**Location:** `services/consentService.ts` or respective analytics loading logic

Ensure the cookie is only set after user consent via the cookie banner.

### 4. Update Legal Pages

Add cookie description to `locales/*/legal.json`:

```json
{
  "cookies": {
    "notes": [
      "Describe your new cookie here"
    ]
  }
}
```

### 5. GDPR Compliance Checklist

Before deploying:

- [ ] Cookie is documented in `cookies.config.ts`
- [ ] Correct category assigned (essential/analytics/marketing)
- [ ] Consent logic implemented if non-essential
- [ ] Legal translation updated in all supported languages
- [ ] If third-party: Data Processing Agreement (DPA) exists
- [ ] Cookie duration is as short as possible (GDPR principle of data minimization)

### 6. Validation

Run the validation script (if implemented):

```bash
pnpm lint:cookies
```

Or manually check:

```typescript
import { validateCookieRegistry } from './lib/legal/cookies.config';
const { valid, errors } = validateCookieRegistry();
if (!valid) console.error(errors);
```

## Environment Variables

Legal data (name, address, email) is injected via environment variables to keep personal information out of Git.

**Required variables** (see `.env.example`):
- `VITE_LEGAL_NAME`
- `VITE_LEGAL_ADDRESS`
- `VITE_LEGAL_EMAIL`
- `VITE_LEGAL_RESPONSIBLE`

**Optional:**
- `VITE_LEGAL_BUSINESS_NAME`
- `VITE_LEGAL_PHONE`
- `VITE_LEGAL_VAT_ID`

**Production deployment:**
Ensure these are set in your hosting environment (Netlify, Vercel, etc.).

## Code Style

- Use TypeScript strict mode
- Follow existing code conventions
- Run `pnpm lint` and `pnpm typecheck` before committing
- Write meaningful commit messages

## Testing

- Add tests for new features
- Ensure existing tests pass: `pnpm test`
- Test in multiple browsers (Chrome, Firefox, Safari)

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Test thoroughly
4. Open a PR with clear description
5. Link related issues

Thank you for helping build TravelFlow! 🚀
