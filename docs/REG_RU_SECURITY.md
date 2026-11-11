# REG.RU security follow-up — 2026-10-16

## Verified production state

GET and HEAD https://app.sale-trener.ru/ return HTTP 200, served by nginx.
All five headers in scripts/check-security-headers.py are absent. The repository's
_headers file does not cause REG.RU to emit them. No hosting configuration was
changed in this follow-up. The active backend (nginx-only or nginx with Apache)
cannot be established from the Server header alone.

## Apply only to the application virtual host

Preserve existing routing, redirects and access rules. There are two alternative
snippets; apply only the one corresponding to the actual hosting configuration:

- Apache behind nginx: merge ops/reg-ru/security-headers.apache.conf into the
  existing document-root .htaccess. Confirm mod_headers is enabled and that the
  front nginx does not strip the headers.
- nginx-only: include ops/reg-ru/security-headers.nginx.conf in the HTTPS
  virtual host or the final app-serving location. Check existing add_header
  directives and avoid duplicate policies. Run nginx -t before reload.

Do not upload both snippets as public site assets. They intentionally live outside
./deploy so the existing manual frontend deployment cannot overwrite an unknown
production .htaccess. Do not replace the entire site's configuration.

The CSP currently protects framing, base URL and embedded objects only; it does
not claim to prevent all XSS. Inline scripts/styles and existing Supabase/AI
connections remain permitted. Same-origin microphone access remains enabled.
HSTS is deferred until the HTTP-to-HTTPS redirect and domain setup are verified.

After applying, run:

    python scripts/check-security-headers.py

Also check login, password recovery, invitation registration and a voice call in
the real browser; the read-only header checker does not exercise those flows.
Apache/nginx binaries were unavailable locally, so syntax must also be checked
on the target server before activating the configuration.

## Supabase Auth

Project: svxykakyrloqzloerygb (K2-trener). Project listing works via the Dimas
connection. The connector does not expose Auth configuration read/update, and
get_advisors returned permission denied. Do not interpret this as evidence that
Auth protection is disabled, or that project defaults are its current values.

A bounded password-login check used a nonexistent example.invalid address. It
received 20 HTTP 400 invalid_credentials responses before a network error. No
429 was observed, but request timing/network failure make this inconclusive;
this is not evidence that the limiter is absent. No real account was tested.

Current official documentation describes IP-based token-bucket limits and HTTP
429 responses. The token endpoint includes password and refresh-token requests;
reducing its quota indiscriminately can break normal session refresh.

Check actual settings in:
https://supabase.com/dashboard/project/svxykakyrloqzloerygb/auth/rate-limits
https://supabase.com/dashboard/project/svxykakyrloqzloerygb/auth/protection

Review sign-up limits, token limits, password policy, leaked-password protection
and CAPTCHA availability. CAPTCHA requires client integration before enabling;
the local custom client currently does not send a CAPTCHA token. A client-only
login cooldown is not a security boundary and is intentionally not added.

References:
https://supabase.com/docs/guides/auth/rate-limits
https://httpd.apache.org/docs/2.4/mod/mod_headers.html
https://nginx.org/en/docs/http/ngx_http_headers_module.html

## Scope and verification

Frontend syntax/assets, the AI request guard and invitation privacy regression
checks pass. No real accounts, emails, paid AI or Live calls were used. No Auth
settings, production files or frontend behavior were changed. A strict duration
cap for an established direct Live connection remains unresolved, as documented
in AI_REQUEST_SECURITY.md.
