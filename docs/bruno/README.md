# Bruno API Collection

Bruno collection for the `golang-restapi` service. It covers every HTTP route the
API exposes: auth (login, registration, refresh, password recovery, sessions,
permissions), users (list, update, delete, profile picture), audit log, health
and metrics.

Open the `docs/bruno` folder as a collection in [Bruno](https://www.usebruno.com/).

## Prerequisites

- API running: `make dev` (and `make dev:worker` if you want outbox emails such
  as registration / password-recovery links to actually be sent).
- The API must be reachable at the collection's `BASE_URL`
  (`http://localhost:8081` by default).

## Where the variables live

Values are declared next to where they are used, not all in the environment:

| Scope | File | Variables |
| --- | --- | --- |
| Environment | `environments/ENV.bru` | `BASE_URL`, `METRICS_URL` |
| Auth | `Auth/folder.bru` | `authPath`, `email`, `password` |
| Registration | `Auth/Registration/folder.bru` | `token` |
| Password | `Auth/Password/folder.bru` | `recoveryToken` |
| Session | `Auth/Session/folder.bru` | `userID` |
| Revoke Session | `Auth/Session/Revoke Session.bru` | `sessionId` |
| User | `User/folder.bru` | `userPath`, `userID` |
| Audit | `Audit/folder.bru` | `auditPath`, `userID` |

Each resource owns its path prefix (`authPath: api/auth`, `userPath: api/users`,
`auditPath: api/audit`), so URLs read `{{BASE_URL}}/{{authPath}}/login` and a
prefix change is a one-line edit in the folder. Nested folders inherit their
parent's path (`Auth/Password/*` uses `{{authPath}}`).

Only `BASE_URL` / `METRICS_URL` are deployment-level. **Pick `ENV` in Bruno's
environment selector** (top-right) before running anything, or those two are
undefined; the rest resolve from the folder or request they belong to.

## Auth flow

1. Run **Login** first. The API sets `access_token` / `refresh_token` cookies.
2. Bruno's cookie jar carries those cookies to every request whose auth mode is
   `inherit`, so there is no manual token paste. Endpoints that opt out
   (`Register`, `Login`, `Forgot Password`, `Registration Token`, `Health`,
   `Metrics`, ...) use `auth: none`.

## Single-use tokens

`token` and `recoveryToken` are hashed in the database and single-use, so the
values in `ENV.bru` are only placeholders. To get a live one:

1. Call **Register** (or **Forgot Password**).
2. Copy the raw token from the outbox email (or the API log / email sink)
   immediately — the DB only stores the hash.
3. Paste it into the folder that owns it — `token` in
   `Auth/Registration/folder.bru`, `recoveryToken` in
   `Auth/Password/folder.bru` — then run **Registration Token** /
   **Complete Registration** or **Get Forgot Password Token** /
   **Reset Password**.

## Change Profile Picture

The request body uses `image: @file(./profile-picture.png)`. Drop your own
JPEG/PNG/WebP image named `profile-picture.png` into `docs/bruno/` (same folder
as `bruno.json`), or edit the path. Field name is `image`, max 2 MB.

## Metrics

`Metrics.bru` calls `{{METRICS_URL}}/metrics`. The exporter is production-only
and runs in a sidecar on the API port + 1 (default `http://localhost:8082`), so
it will not answer during local development.

## Error catalogue

Every failure uses the same envelope:

```json
{ "error": { "message": "...", "details": null, "code": "..." } }
```

`details` is `null` unless the error carries structured context (a failed field,
a path parameter, upload limits, ...). Codes are stable and safe to branch on.

| Status | Code | Message | When |
| --- | --- | --- | --- |
| 400 | `REQ_MALFORMED_JSON` | `Request body contains badly-formed JSON (at position N)` / `Request body must not be empty` | malformed or empty JSON |
| 400 | `INVALID_PARAMETER` | `invalid value '<value>' for parameter '<name>'` | bad path param |
| 400 | `MULTIPART_FORM` | `invalid multipart form` (also `request 'Content-Type' header must be multipart/form-data`, `profile picture is required`) | upload issues |
| 400 | `UPLOAD_MAX_SIZE` | `file size exceeds maximum allowed` | file over limit |
| 400 | `UPLOAD_MIME_TYPES` | `invalid file mime types` | disallowed type |
| 401 | `REQ_UNAUTHORIZED` | `authentication required` | no access token |
| 401 | `AUTH_EXPIRED` | `access token expired` | expired JWT |
| 401 | `AUTH_INVALID` | `invalid access token` | bad JWT |
| 401 | `AUTH_INVALID_SESSION` | `session has been expired or revoked` | revoked session |
| 401 | `AUTH_CREDENTIALS` | `check your credentials` | wrong password |
| 401 | `AUTH_INVALID_REGISTRATION_TOKEN` | `invalid or expired registration token` | bad/used/expired invite |
| 401 | `AUTH_INVALID_RECOV_TOKEN` | `invalid or expired password recovery token` | bad/used/expired reset token |
| 403 | `RBAC_UNAUTHORIZED_PERM` | `unauthorized action` | authenticated, not permitted |
| 404 | `RESOURCE_NOT_FOUND` | `the requested resource was not found` | missing resource |
| 409 | `USER_EMAIL_CONFLICT` | `email already exists` | duplicate email |
| 422 | `VALIDATION` | `the request contains invalid data` | binding/field validation |
| 429 | `AUTH_RECOVERY_THROTTLED` | `too many password reset requests, please try again later` | per-email recovery throttle (sets `Retry-After`) |

`422 VALIDATION` is the only validation failure the API returns, and it comes
from the request binder. Domain validation is a **second layer** that re-checks
the entity before persisting (`user.Validate()` → `USER_VALIDATION`;
`apperr.ValidationErr` → `DOMAIN_VALIDATION`). The binder rejects the same inputs
first, so that layer is a safety net for internal callers and is not reachable
over HTTP — which is why it has no example.

Route-independent errors: `404 HANDLER_NOT_FOUND`
(`the requested resource could not be found`), `405 HANDLER_METHOD_NOT_ALLOWED`
(`the method is not allowed for the requested url`), `429 REQ_RATE_LIMIT`
(`too many request try again latter`, in-process limiter), `413 BODY_TOO_LARGE`
(`request body too large`), `500 INTERNAL`, `504 SERVER_TIMEOUT`, and `499`
(client closed request). These can come back from any endpoint.
