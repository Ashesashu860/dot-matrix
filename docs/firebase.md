# Deploying to Firebase

Development runs entirely on the Emulator Suite (`demo-dots-matrix`). Real deployments use two isolated projects:

| Environment | Project ID | Web config | Functions config |
| --- | --- | --- | --- |
| Staging | `dot-matrix-staging` | `apps/web/apphosting.staging.yaml` | `functions/.env.dot-matrix-staging` |
| Production | `dot-matrix-a83f6` | `apps/web/apphosting.production.yaml` (+ `apps/web/.env.production` for local builds) | `functions/.env.dot-matrix-a83f6` |

## 1. Project setup (repeat for each project)

1. In the [Firebase console](https://console.firebase.google.com), upgrade to the **Blaze** plan: Cloud Functions requires it.
2. Enable the services:
   - **Authentication** → Sign-in method → **Anonymous**
   - **Firestore** (Native mode)
   - **Realtime Database**. Production: `https://dot-matrix-a83f6-default-rtdb.firebaseio.com`. If the staging database URL isn't `https://dot-matrix-staging-default-rtdb.firebaseio.com` (for example, it was created outside us-central1), update `apphosting.staging.yaml`.
   - **App Check** with **reCAPTCHA Enterprise** for the web app (note the site key)
3. Aliases in `.firebaserc`:

```json
{
  "projects": {
    "default": "demo-dots-matrix",
    "staging": "dot-matrix-staging",
    "production": "dot-matrix-a83f6"
  }
}
```

`default` stays on the demo project, so a bare `firebase deploy` can't reach a real project by accident. Always name the target.

## 2. Functions configuration

`functions/.env.<projectId>` is loaded when you deploy to that project:

```
ENFORCE_APP_CHECK=false   # set to true once that project's reCAPTCHA site key is configured
PRESENCE_GRACE_MS=60000
```

These files are copied into `functions/dist` at build time. Don't commit secrets. None are needed today: the web config is public, and access is protected by Security Rules (and App Check once it's enforced).

## 3. Deploy the backend

```bash
firebase deploy --project staging --only firestore:rules,firestore:indexes,database,functions
```

`--project staging` picks the alias from `.firebaserc`; it's the same as running `firebase use staging` first. Once staging checks out, repeat with `--project production`.

The predeploy step runs `pnpm --filter @dots/functions build`. That bundles the workspace packages into `functions/dist` and writes a `package.json` there with only runtime dependencies.

The indexes file also sets a **TTL policy** on `rooms.expiresAt`, so abandoned rooms are deleted automatically. Game records in `games/` are kept as history.

## 4. Deploy the web app (App Hosting)

1. Run `firebase apphosting:backends:create --project staging`, and again with `--project production`. Connect the GitHub repo and set the **root directory** to `apps/web`.
2. In each backend's settings, set **Environment name** to `production` or `staging`. App Hosting merges `apphosting.yaml` with the matching `apphosting.<env>.yaml`.
3. After App Check is set up, uncomment `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` in that environment's `apphosting.<env>.yaml` and set `ENFORCE_APP_CHECK=true` in its `functions/.env.<projectId>`.
4. Push to the live branch. App Hosting builds and deploys the Next.js app.

## 5. Verify

- Open the site, install the PWA, then play a CPU game offline.
- Play an online game in two browsers. Watch Firestore `games/` and RTDB `status/` in the console.
- Check the Cloud Functions logs for rejected requests (App Check, validation, rate limits).

## Environments

| Environment | Purpose |
| --- | --- |
| Development | Emulator Suite + `next dev` |
| Staging | `dot-matrix-staging`: real services, isolated from production |
| Production | Live App Hosting, Functions, Firestore, RTDB, App Check |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → unit tests → emulator tests → build → e2e. The deploy job is stubbed: add a service-account secret per project and uncomment it.
