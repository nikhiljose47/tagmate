# Auth and email setup

The username login and duplicate-account checks use Cloudflare Pages Functions. Configure these as encrypted Pages secrets before deploying:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` is used only in `functions/api/auth/`; never place it in an Angular environment file or expose it to the browser. Add a production WAF/rate-limit rule for `/api/auth/*` in addition to the per-edge-instance guard in the functions.

Run the Supabase migrations before deploying the front end. The `users_name_ci_unique` index remains the final username guarantee; Supabase Auth remains the final email guarantee. The availability endpoint only provides early feedback, so a concurrent signup still receives a clear conflict result rather than creating a duplicate.

## Confirmation-email opt-out link

For the Supabase **Confirm signup** email template, include this link for non-essential communication preferences:

```html
<a href="{{ .SiteURL }}/login/opt-out?token={{ .Data.email_opt_out_token }}">
  Manage email preferences
</a>
```

The signup flow creates a random UUID token, the profile trigger stores only its SHA-256 hash, and the public opt-out page calls `unsubscribe_email`. The link must not be removed from the query string by an email redirector. Keep required transactional confirmation and security messages separate from optional marketing or product mail.
