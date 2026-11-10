# Launch checklist

Status key: [ ] to do, [x] done. Owners: **You**, **Father** (the painter), **Me** (Claude, the code).

Live camera is **deferred** (see [LIVE_CAMERA_PLAN.md](LIVE_CAMERA_PLAN.md)). Launch is photo mode with smart wall selection.

## A. Decisions and content (needed before anything else)

|     | Item                                                               | Owner           | Notes                                                                                                                    |
| --- | ------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [ ] | Business name (shown in the header and in WhatsApp)                | You + Father    | Set under Admin → Settings.                                                                                              |
| [ ] | WhatsApp number that receives requests                             | Father          | Must be a WhatsApp number he checks. Set under Admin → Settings.                                                         |
| [ ] | Logo and app icon                                                  | You             | Replace `apps/web/public/icon.svg`; the PWA icons are generated from it.                                                 |
| [ ] | Domain name (for example `paint.example.my`)                       | You             | Needed for HTTPS, the `SITE_URL` setting and the QR code.                                                                |
| [ ] | Paint color list with HEX values                                   | Father          | Paste or upload through Admin → Colors (CSV import supported). Sample HEX from real swatches, not from catalog pictures. |
| [ ] | Does he use an iPhone or Android, and a computer?                  | Father          | iPhone push notifications only work after "Add to Home Screen".                                                          |
| [ ] | Data retention period for requests and photos                      | You + Father    | The privacy notice says "limited time". Pick a number (for example 12 months).                                           |
| [ ] | Privacy notice: add business name and contact details, then review | You (+ advisor) | `apps/web/src/locales/*/request.json` under `privacy`. Check the PDPA obligations that apply to a business.              |
| [ ] | Model license check (SlimSAM)                                      | You             | Listed as Apache 2.0. I did not audit the training-data terms.                                                           |
| [ ] | Native Malay speaker reviews the BM texts                          | You             | Translations are mine and unreviewed.                                                                                    |

## B. Work I should do before launch

|     | Item                                                                                         | Why                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ] | **Admin can delete a request and its photos**                                                | There is no delete today. A client may ask for removal under PDPA, and photos of people's homes should not stay forever.                                                                                                                     |
| [ ] | **Automatic retention cleanup** of requests and photos older than the chosen period          | Matches what the privacy notice promises.                                                                                                                                                                                                    |
| [ ] | **Create a git repository** and commit, with CI (typecheck, lint, tests, build)              | The project is not under version control yet.                                                                                                                                                                                                |
| [ ] | **Docker build tested end to end**                                                           | CI builds the image and starts it against Postgres with a root-owned disk on every push, checking migrations, uploads, the security policy and the model files. Not tested: `docker compose up` locally (Docker didn't respond on this Mac). |
| [ ] | **API tests against a real database** for the request flow, uploads and admin routes         | Today only pure functions have tests.                                                                                                                                                                                                        |
| [ ] | Long WhatsApp messages: test a request with 12 areas                                         | `wa.me` links have a length limit. If exceeded, the message should shorten (the full details are on the admin page anyway).                                                                                                                  |
| [ ] | Handle "WhatsApp not set up yet" clearly on the guest side                                   | Already shows a note; check wording with the real flow.                                                                                                                                                                                      |
| [ ] | Trim the build output (the runtime files are in the image twice, about 27 MB extra)          | Smaller image, faster deploys. Optional.                                                                                                                                                                                                     |
| [ ] | Basic usage counts for the success metrics (visitors who open the visualizer, requests sent) | Nothing records these today. A privacy-friendly analytics tool or a few server counters.                                                                                                                                                     |

Already done: `.dockerignore` now excludes the test photos and the `data` folder.

## C. Test on real devices (most important)

Test on at least **one Android phone and one iPhone**, with the production build over HTTPS.

|     | Check                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ] | Guest flow end to end in English and Malay, on mobile data and on Wi-Fi                                                                                                                                                               |
| [ ] | Camera capture and "choose from gallery" (iPhone Safari and Android Chrome)                                                                                                                                                           |
| [ ] | **Smart selection speed:** time from choosing a photo to "Tap the wall", on first use and after caching. Note the phone model. If it takes more than about 10 s, decide whether to default to quick selection on that class of phone. |
| [ ] | Smart selection quality on 10 to 20 real photos from your father's jobs (use `/phase0-sam.html`)                                                                                                                                      |
| [ ] | The memory limit: does a large photo from a recent phone (12 MP or more) work?                                                                                                                                                        |
| [ ] | Brush, undo, compare, and the fallback to quick selection                                                                                                                                                                             |
| [ ] | "Open WhatsApp" on iPhone, Android and desktop (with and without WhatsApp installed)                                                                                                                                                  |
| [ ] | Request appears in Admin with photos and the color preview                                                                                                                                                                            |
| [ ] | Install as a PWA (Add to Home Screen) and open offline                                                                                                                                                                                |
| [ ] | Push notification arrives on your father's phone (iPhone: after installing to the Home Screen)                                                                                                                                        |
| [ ] | Dark and light mode, small phones, large text sizes                                                                                                                                                                                   |
| [ ] | Screen reader and keyboard check of the guest flow (labels, focus, contrast)                                                                                                                                                          |

## D. Set up and deploy

Follow [docs/DEPLOY.md](docs/DEPLOY.md). `render.yaml` already describes the services; the steps below are what only you can do.

|     | Step                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ] | Create the Render account and apply the Blueprint (web service, PostgreSQL, 5 GB photo disk, Singapore)                                                                                 |
| [ ] | Enter the values Render asks for: `SITE_URL` (https, final domain), the Turnstile keys, the push keys. The database, disk, session secret and retention period are set by the Blueprint |
| [ ] | Cloudflare Turnstile: create the widget for the domain, set `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY`                                                                             |
| [ ] | Web push: generate VAPID keys (`npx web-push generate-vapid-keys`), set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                                                        |
| [ ] | Optional email notifications: `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL`, `ADMIN_NOTIFY_LANG`                                                                                 |
| [ ] | Point the domain at the host and confirm HTTPS                                                                                                                                          |
| [ ] | Run migrations (automatic on start) and create the admin: `node apps/api/dist/create-admin.js --email ... --name ...`                                                                   |
| [ ] | Sign in, set business name and WhatsApp number, load the colors                                                                                                                         |
| [ ] | Confirm the security headers and that the model and runtime load only from your own domain (browser console shows no blocked requests)                                                  |
| [ ] | **Restore a database backup once** to prove it works                                                                                                                                    |
| [ ] | Uptime monitoring on the home page and `/api/health`; error log access                                                                                                                  |

## E. Launch day

|     | Item                                                                                           |
| --- | ---------------------------------------------------------------------------------------------- |
| [ ] | Send one real test request from a phone that is not yours, and reply on WhatsApp               |
| [ ] | Walk your father through the admin: requests, status, colors, notifications, reply on WhatsApp |
| [ ] | Give him a short written guide (how to add a color, how to reply, what each status means)      |
| [ ] | QR code poster and a link for his business card, van, social pages and WhatsApp status         |
| [ ] | Decide who watches the first week of requests and fixes problems                               |

## F. First two weeks after launch

|     | Item                                                                                             |
| --- | ------------------------------------------------------------------------------------------------ |
| [ ] | Review every request and photo that looks wrong; collect cases where wall selection failed       |
| [ ] | Ask your father which questions clients ask that the form doesn't cover                          |
| [ ] | Check the success numbers: time to send a request, share who open the visualizer, share who send |
| [ ] | Decide what is next: live camera, quote PDFs, calendar, WhatsApp automation, portfolio page      |
