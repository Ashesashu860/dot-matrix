# Deploying to Firebase

Development runs entirely on the Emulator Suite. To go live, create one project for **staging** and one for **production**, so they stay isolated.

## 1. Create the projects

1. Create the projects in the [Firebase console](https://console.firebase.google.com). Upgrade to the **Blaze** plan: Cloud Functions requires it.
2. Enable the services:
   - **Authentication** → Sign-in method → **Anonymous**
   - **Firestore** (Native mode)
   - **Realtime Database** (note its URL)
   - https://dot-matrix-a83f6-default-rtdb.firebaseio.com
   - **App Check** with **reCAPTCHA Enterprise** for the web app (note the site key)
3. Register a **Web app** and copy its config.
4. Map aliases in `.firebaserc`:

```json
{
  "projects": {
    "default": "dot-matrix",
    "staging": "dots-matrix-staging",
    "production": "dot-matrix"
  }
}
```

## 2. Functions configuration

Create `functions/.env.<projectId>` for each project, starting from `functions/.env.example`:

```
ENFORCE_APP_CHECK=true
PRESENCE_GRACE_MS=60000
```

These files are copied into `functions/dist` at build time. Don't commit secrets. None are needed today: the web config is public, and access is protected by Security Rules and App Check.

## 3. Deploy the backend

```bash
firebase use staging
firebase deploy --only firestore:rules,firestore:indexes,database,functions
```

The predeploy step runs `pnpm --filter @dots/functions build`. That bundles the workspace packages into `functions/dist` and writes a `package.json` there with only runtime dependencies.

The indexes file also sets a **TTL policy** on `rooms.expiresAt`, so abandoned rooms are deleted automatically. Game records in `games/` are kept as history.

## 4. Deploy the web app (App Hosting)

1. `firebase apphosting:backends:create`. Connect the GitHub repo and set the **root directory** to `apps/web`.
2. Fill in `apps/web/apphosting.yaml`, or per-environment `apphosting.<env>.yaml`, with the web config, `NEXT_PUBLIC_FIREBASE_DATABASE_URL` and `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`.
3. Push to the live branch. App Hosting builds and deploys the Next.js app.

## 5. Verify

- Open the site, install the PWA, then play a CPU game offline.
- Play an online game in two browsers. Watch Firestore `games/` and RTDB `status/` in the console.
- Check the Cloud Functions logs for rejected requests (App Check, validation, rate limits).

## Environments

| Environment | Purpose |
| --- | --- |
| Development | Emulator Suite + `next dev` |
| Staging | Real services, isolated project |
| Production | Live App Hosting, Functions, Firestore, RTDB, App Check |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → unit tests → emulator tests → build → e2e. The deploy job is stubbed until the projects exist: add a service-account secret and uncomment it.
