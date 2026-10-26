# UGCad.io - handover for store publishing (Google Play and Apple App Store)

This document explains the whole product and what is needed to publish it. It contains **no secrets**: only the
names and locations of things that must be shared separately (see "Secrets").

## 1. The product in one paragraph
UGCad.io is a marketplace where **brands** post campaigns and hire vetted **creators** to make UGC (user-generated
content) videos. Money is held in escrow until the brand approves the video; unapproved videos carry a "UGCAD.IO"
watermark. There are three kinds of users: brand (`business`), creator (`creator`) and staff (admin / campaign
manager / support). The browser website and the phone apps all talk to one backend API.

## 2. Repositories (what to share)
| Repo | GitHub | What it is | Needed for store publishing? |
|---|---|---|---|
| **ugcapp** | `meetroj/ugcapp` (branch `main`) | The **native React Native app**: Android `com.ugcapp` and iOS `io.ugcad.app`, version 1.2.15 (build 25). This is the app currently on the stores. Contains `android/`, `ios/`, `scripts/` (App Store Connect / TestFlight automation: `ios-release.sh`, `asc-*.mjs`), `store-screenshots/`, privacy policy HTML, `docs/`. | **Yes, this is the store app** |
| **Frontend** | `ugc-ad-io/Frontend` (branch `new-ui`) | The website (React 19, CRA) **and** the new installed-app (PWA) phone screens in `src/app/`. | Yes (the PWA app and the website; the native app also opens some website pages in a WebView) |
| **Backend** | `ugc-ad-io/Backend` (branch `new-ui`) | FastAPI API (`server.py`), MongoDB, hosted on AWS. | Yes (the apps are useless without it; needed to understand the data) |
| **ugcad-pwa-apk** | local folder, not a git repo yet | A small Android wrapper that bundles the built PWA (package `io.ugcad.pwa`, test-signed). A **test build only**. | Only if the PWA-wrapper route is chosen (see 4) |

Branch note: all recent design/PWA work lives on branch `new-ui` of Frontend and Backend and is **not merged to `main`**.

## 3. How the apps relate (important)
- **Website**: normal browser pages, redesigned (dark sidebar dashboard for brand and creator, tiled watermark, etc.).
- **Installed app (PWA)**: the *same website*, but when it runs "installed" (display-mode standalone, or `?app=1`)
  `src/utils/appMode.js` switches on **app mode**: `src/app/AppOverride.js` replaces website pages with phone screens
  from `src/app/screens/<brand|creator|shared>/`, mapped by URL in `src/app/registry.js`. No screen file = the
  website page is shown. Shell (top bar, bottom tabs, bottom sheets, safe areas, keyboard, back handling):
  `src/app/shell/`.
- **Native app (`ugcapp`)**: a separate, fully native React Native codebase (about 50 screens) with its own UI;
  it is **not** automatically restyled by the Frontend work. Inside the native app, `appMode` is OFF.
- **Wrapper APK (`ugcad-pwa-apk`)**: a WebView shell that serves the bundled PWA from the private origin
  `https://appassets.ugcad.io` (the backend CORS rule allows any `https://*.ugcad.io`). Google sign-in does not work
  inside it (OAuth origin not registered, and Google blocks embedded WebViews); email login works.

## 4. Decision still open: how the PWA reaches the stores
1. **Google Play, PWA**: publish a **Trusted Web Activity** (Bubblewrap) that opens the deployed HTTPS site full
   screen. Needs the new-ui frontend **deployed to production first**, a `/.well-known/assetlinks.json` file on the
   domain, an `.aab`, and Play App Signing. Website updates then reach users without a new store release.
2. **Replace the current app or add a second listing?** Replacing `com.ugcapp` (same upload key, higher
   versionCode) means existing users get the PWA-based app and lose native Google/Apple sign-in, push notifications
   and file/camera handling unless re-added. A separate package (for example `io.ugcad.pwa`) leaves the native app as is.
3. **Apple App Store**: Apple does not list PWAs, and a thin website wrapper is usually rejected (guideline 4.2,
   minimum functionality). Keep the **native `ugcapp`** for iOS (it already uses bundle id `io.ugcad.app` and Sign in
   with Apple); restyling its native screens to the new design is the compliant route.
4. Keep the native `ugcapp` and bring the new design into it screen by screen (largest effort, one release,
   keeps all native features).

## 5. Environments and configuration
- Frontend env vars (names only): `REACT_APP_BACKEND_URL` (production: `https://app.ugcad.io`),
  `REACT_APP_GOOGLE_CLIENT_ID`. **Gotcha:** `.env.local` overrides `.env`; a stale `.env.local` pointing at
  `http://localhost:8000` makes logins fail ("offline or the server is not responding"). Build for release with
  `REACT_APP_BACKEND_URL=https://app.ugcad.io npm run build`.
- Frontend hosting: the repo contains `Dockerfile`, `nginx.conf`, `docker-compose.yml`, `vercel.json` and `deploy/`.
  **Which of these is the live deploy path is not recorded: confirm with the owner.** Backend is on AWS (exact
  service not recorded in the repos); there is no deploy hook in the repos.
- Payments: Razorpay (checkout loaded from the website). KYC, withdrawals, wallet and escrow live in the backend.
- Backend CORS allows `https://www.ugcad.io`, `https://ugcad.io`, `http://localhost:3000`, `https://*.ugcad.io`.

## 6. Build and run
- Frontend: `npm install`, `npm start` (port 3000), `npm test`, `npm run build`. Preview the phone app in a browser
  with `http://localhost:3000/?app=1` (remembered; `?app=0` switches it off).
- Backend: see its README; Dockerfile and `requirements.txt` are in the repo.
- Native app: `ugcapp/README.md`; iOS release automation is in `ugcapp/scripts/` (`ios-release.sh`, `asc-*.mjs`).
  Android release signing reads `UGCAD_UPLOAD_STORE_FILE` and related properties from `gradle.properties` (kept outside git).
- Wrapper APK: build the site with the production backend URL, copy `build/` (without the `*.mp4` landing videos) into
  `ugcad-pwa-apk/app/src/main/assets/web/`, then `./gradlew assembleRelease`.

## 7. Store checklists
**Google Play**: developer account, app listing, privacy policy URL, Data safety form, content rating, target API
level, screenshots, an `.aab` signed via Play App Signing with the **upload key**. For a TWA: `assetlinks.json` with
the signing certificate SHA-256.
**App Store**: Apple Developer Program account, App Store Connect record for `io.ugcad.app`, distribution
certificate + provisioning profile, TestFlight, screenshots (`ugcapp/store-screenshots/`), privacy nutrition labels,
account-deletion in app (present), Sign in with Apple (present).

## 8. Secrets (share through a password manager, never through git or chat)
Kept **outside** the repositories on the owner's machine (`Desktop\Ugcad\_secrets` and loose files): the Play upload
keystore `ugcad-release.keystore`, `gradle.properties` (keystore passwords), backend `.env`, frontend `.env.local`,
Apple App Store Connect API key / certificates, Razorpay and Google OAuth credentials, the AWS access. The wrapper
project has its own test keystore (`ugcad-pwa-release.jks` + `keystore.properties`): test use only.
**Do not commit any of these.** Give the publisher GitHub *collaborator access* (read-only first) instead of passwords.

## 9. Security warning (read before sharing access)
The GitHub `main` branches of Frontend, Backend and ugcapp were force-rewritten several times (Aug-Oct 2026) with
copies of the real commits plus a malicious loader (`api.js`, `node api.js &&` in `package.json`, an appended
payload in config files, a hidden `.gitignore` block). Before handing over: **rotate the GitHub credentials and tokens,
enable branch protection (no force-push) on `main`**, scan every checkout for those markers before running
`npm`/`node`, and review `git reflog show origin/main` for `forced-update` after every fetch. Only the `new-ui`
branches are known-clean as of the last check.

## 10. State of the work (branch `new-ui`)
Done: brand + creator website redesign, phone app (PWA) screens for both roles, brand dashboard shell like the
creator's, mobile-website pass, tiled watermark, ~90 test suites passing, production build compiling.
Open: merge `new-ui` to `main` and deploy; decide the store route (section 4); brand screens were only partly
checked visually (no brand login was available in the test browser); real-device testing on iPhone and Android
(keyboard, safe areas, back gestures); Google sign-in inside any wrapper; backend `delivery_days` change needs deploy.
