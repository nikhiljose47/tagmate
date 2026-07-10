# Security deployment requirements

The browser is not an authorization boundary. Keep the following controls in
Supabase and Cloudflare in sync with the Angular guards.

## Supabase

- Apply `supabase/migrations/20260710000000_security_hardening.sql`.
- Resolve duplicate usernames before applying the case-insensitive unique index.
- Assign administrators only through trusted `app_metadata.role = "admin"`.
  Users must never be able to update this claim themselves.
- Keep RLS enabled and test owner-only writes for `tags`, participant-only reads
  for `direct_messages`, owner-only reads for `notifications`, and per-user rows
  such as saved/hidden posts. The client-side checks are only UX safeguards.
- Restrict the `tag-images` bucket by authenticated owner/path policies and
  validate MIME type and file-size limits in storage policies or a server upload
  endpoint.

## Cloudflare and public browser keys

- Configure Cloudflare's distributed rate limiting for `/api/nominatim/*`.
  The in-worker token bucket is only a per-isolate secondary safeguard.
- Restrict the MapTiler browser key to production and staging origins and rotate
  it if it has ever been used without origin restrictions.
- The Supabase anon key is public by design; its safety depends entirely on RLS.
