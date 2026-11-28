# Google OAuth branding submission

| Field | Value |
| --- | --- |
| Application name | AGUS AI |
| Application logo | [oauth-logo.png](../../apps/web/public/assets/oauth-logo.png), 120 × 120 PNG, original orbital ghost on Void |
| Homepage | https://agusai.grindcity.app/ |
| Privacy Policy | https://agusai.grindcity.app/privacy |
| Terms of Service | https://agusai.grindcity.app/terms |
| Authorized domain | `grindcity.app` |
| Web OAuth redirect URI | `https://agusai.grindcity.app/api/v1/auth/google/callback` |
| Existing web return | `https://agusai.grindcity.app/console.html` |
| Current identity scopes | `openid`, `email`, `profile` |

The existing login code uses the Google userinfo endpoint and binds a verified email and Google subject to an AGUS AI account. Access is governed by the configured registration policy and the existing browser and server PKCE exchange. The homepage and authentication screen link to the privacy policy and terms.

## Owner submission steps

1. Review the legal copy, entity and operating disclosures. Confirm the approved AGUS logo, an owner-managed user support email, a monitored private data-request channel, and the developer contact entries for the Google project. Set the approved private contact in [site.config.mjs](../../apps/web/site.config.mjs).
2. Verify ownership of `grindcity.app` in Google Search Console with an account associated with the existing Google project. Enter the approved branding fields and the current callback URI in Google Auth Platform.
3. After approving deployment of this candidate, check that the homepage, policy and terms load publicly over HTTPS. Validate Google consent, cancellation and fresh sign-in with an invited test account. Verify email OTP separately with the authorized delivery provider.
4. Submit the existing project for brand verification and review any feedback against the same data flows.

Official references are Google’s [brand verification requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), and [Google Identity branding guidance](https://developers.google.com/identity/branding-guidelines).
