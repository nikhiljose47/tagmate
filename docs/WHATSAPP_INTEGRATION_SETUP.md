# WhatsApp integration — Meta Developer Dashboard setup

Covers the manual configuration needed for `functions/api/integrations/whatsapp/*`
and `functions/api/webhooks/whatsapp.js` (Step 3). Kept separate from the
application code, same as `docs/INSTAGRAM_INTEGRATION_SETUP.md`.

> Re-verify against Meta's current docs
> ([developers.facebook.com/docs/whatsapp/embedded-signup](https://developers.facebook.com/docs/whatsapp/embedded-signup))
> before production — Embedded Signup's exact config screens and required
> permissions have changed across Meta API versions.

## 1. Meta app + WhatsApp product

1. Use the same Meta app as Instagram (developers.facebook.com/apps), or a
   dedicated one — either works, they don't need to be the same app.
2. Add the **WhatsApp** product to the app.
3. Under **App Roles → Business Verification**, associate the app with a
   **Meta Business Portfolio** (Business Manager) — required for Embedded
   Signup to work at all, since WABAs are owned by a Business Portfolio, not
   an individual app.

## 2. Embedded Signup configuration

In the WhatsApp product's **Embedded Signup** setup (sometimes called
"WhatsApp Business Platform → Configuration" depending on the dashboard
version):

1. Create a **Signup Configuration** — this produces the
   `WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID` used by `FB.login({config_id: ...})`
   in `facebook-sdk.service.ts`.
2. Set the **App Domains** / **Valid OAuth Redirect URIs** in Facebook Login
   settings to your app's actual domain (Embedded Signup's popup runs on
   `facebook.com` but posts back to your page via the JS SDK, so your domain
   needs to be an allowed App Domain).
3. Permissions requested by this implementation (see
   `functions/api/integrations/whatsapp/_provider.js`'s `WHATSAPP_SCOPES`):
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management`

## 3. Webhook configuration

In the WhatsApp product's **Configuration → Webhook** section:

- **Callback URL**: `https://<your-domain>/api/webhooks/whatsapp`
- **Verify token**: any random string you choose — set the SAME value as
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your environment. Meta calls your GET
  endpoint once with this token to confirm ownership before subscribing.
- **Webhook fields**: subscribe to `messages` only — this implementation
  doesn't process any other field (no `message_template_status_update`,
  no `account_alerts`, etc. — add those later only if you build features that
  need them).

Note: subscribing the **app** to webhook fields (this dashboard step) is
different from subscribing a specific **WABA** to your app
(`POST /{WABA_ID}/subscribed_apps`, done automatically, per-business, in
`functions/api/integrations/whatsapp/complete.js` right after a business
connects) — both are required; this dashboard step alone does not make a
newly-connected business's messages start arriving.

## 4. Environment variables → where they come from

| Env var | Source |
|---|---|
| `META_APP_ID` | App's Basic Settings → App ID |
| `META_APP_SECRET` | App's Basic Settings → App Secret. Server-side only — never in `environment.ts`. |
| `META_BUSINESS_ID` | Business Settings → Business Info → Business ID (documented for reference/future use; not currently read by any code path — see §7) |
| `META_GRAPH_API_VERSION` | Shared with Instagram (Step 2) — same var, same value |
| `WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID` | WhatsApp product → Embedded Signup → your Signup Configuration's ID. Not secret — also set as `environment.whatsappEmbeddedSignupConfigId` for the frontend SDK call. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | You choose this value; set it identically in both the environment and the Meta webhook dashboard field |
| `INTEGRATION_ENCRYPTION_KEY` | Already required since Step 1 |

Also set `environment.metaAppId` / `environment.metaGraphApiVersion` /
`environment.whatsappEmbeddedSignupConfigId` in
`src/app/environments/environment.ts` (and `.prod.ts`/`.staging.ts`) — these
are **not secret** (Meta's own JS SDK requires the App ID and Config ID
client-side to open the Embedded Signup popup at all), but they do need real
values per environment; they currently ship as empty-string placeholders.

## 5. What works immediately in Development Mode

Same as Instagram: only **testers** added to the app (App Roles → Roles) can
complete Embedded Signup while the app is in Development mode. This is
enough to fully exercise:

- Embedded Signup connect/disconnect
- Webhook verification + signature validation
- Inbound message storage, conversation creation
- Outbound text replies within the 24-hour window
- Delivery/read status updates
- Approved template sending (templates must still be created and approved in
  WhatsApp Manager first — this app only retrieves and sends them, it does
  not create/submit templates)

Use a WhatsApp test phone number (Meta provides free test numbers under
WhatsApp → API Setup for exactly this) so you don't need a live production
number to develop against.

## 6. What's required before arbitrary businesses can connect

1. **App Review**: submit for `whatsapp_business_management` and
   `whatsapp_business_messaging` under App Review → Permissions and Features.
   `business_management` may already be Standard Access depending on your
   app type — check its current tier in the dashboard before assuming it
   needs review too.
2. **Business Verification**: Meta requires your Business Portfolio to
   complete verification for Advanced Access to these permissions.
3. **Display name / number verification**: each connecting business's phone
   number goes through Meta's own display-name approval independently — this
   app can't skip or automate that; it's a per-business step in the
   Embedded Signup flow itself.
4. Same **Privacy Policy URL** and **Data Deletion** requirements noted in
   `docs/INSTAGRAM_INTEGRATION_SETUP.md` apply here too (one app-level
   configuration covers both products).

Until App Review is approved, only your added testers can complete Embedded
Signup — standard Meta process, not specific to this implementation.

## 7. Billing / credit-line decision — explicitly NOT automated

Meta's Embedded Signup, when operated as a **Tech Provider**, offers an
option to share your own payment method / line of credit across connected
customer WABAs, so customer businesses never have to enter their own billing
details with Meta. **This implementation does not do that.** Each connected
business's WABA uses its own Meta-side billing relationship (the standard,
non-shared setup) — no credit-line sharing code exists here, and
`META_BUSINESS_ID` is documented but not currently read by any code path.

This was a deliberate choice, not an oversight: enabling credit-line sharing
is a commercial/legal decision (you'd be financially responsible for every
connected business's WhatsApp usage) that shouldn't be made implicitly by
application code. If you decide you want that model, it requires:
1. Confirming your Meta Business Portfolio is set up as a Tech
   Provider/Solution Partner.
2. Following Meta's current documented process for enabling shared billing
   in the Embedded Signup configuration (a dashboard-side setting, not
   something `complete.js` currently touches).
3. Adding whatever usage-tracking/internal-billing logic you'd then need to
   recoup those costs from your own customers — out of scope for Step 3.
