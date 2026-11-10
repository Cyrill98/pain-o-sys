# Painting Quote

A PWA for a single painter: clients pick what they want painted, try the painter's colors on a photo of their own wall, and send the request to the painter's WhatsApp. English and Bahasa Melayu. See [PLAN.md](PLAN.md) for the product plan and roadmap.

Built on the same stack as the massage booking app (`pwa-app`).

## Structure

```
apps/web         React + Vite PWA (Tailwind, shadcn/ui, TanStack Query, React Router, i18next)
apps/api         Express API (TypeScript, Drizzle ORM, PostgreSQL)
packages/shared  Zod schemas, types, constants used by both
```

## What works today (Phase 1 scaffold)

- **Guest flow** (`/en/request`): property type → areas → per-area color, size and condition → contact details → request saved → "Open WhatsApp" with a prefilled message (also a copy button).
- **Photo visualizer:** take or choose a photo, tap the wall, and the color is applied with the photo's light and shadow kept (`apps/web/src/lib/recolor.ts`). Wall selection uses a small AI model (SlimSAM) that runs in the browser, with an instant color-based selection as the fallback. A brush fixes the edges. See [Wall selection](#wall-selection).
- **Admin** (`/en/admin`): requests inbox with photos and previews, status, private notes, reply and call buttons; color palette (add, edit, hide, delete, CSV import); business name and WhatsApp number; push notifications.
- **Not built yet:** live camera preview, quote PDFs, calendar.

## Getting started

Requires Node 22+ and Docker Desktop (or any Postgres 16).

```bash
cp .env.example .env
npm install
npm run db:up         # Postgres 16 on localhost:5432
npm run db:migrate    # create tables
npm run create-admin -- --email you@example.com --name "Your name"
npm run dev           # API on :3000, web on :5173 (proxies /api)
```

Open http://localhost:5173. Sign in at `/en/admin/login`, then go to **Settings** and set the WhatsApp number that receives requests, and **Colors** to add paint colors.

## Scripts

| Command                               | What it does                                                  |
| ------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                         | API + web with hot reload                                     |
| `npm run build`                       | Build web, then bundle API into `apps/api/dist`               |
| `npm start`                           | Apply migrations, then run the built API + web app            |
| `npm test`                            | Unit tests (no database needed)                               |
| `npm run test:db`                     | Database tests (needs Postgres running; uses `painting_test`) |
| `npm run typecheck`                   | Type-check all workspaces                                     |
| `npm run lint`                        | ESLint                                                        |
| `npm run db:up` / `db:down`           | Start / stop local Postgres                                   |
| `npm run db:migrate`                  | Apply database migrations                                     |
| `npm run db:generate`                 | Generate a migration after editing `db/schema.ts`             |
| `npm run create-admin -- --email <e>` | Create the (single) admin account; asks for a password        |

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request:

- **Checks, tests and build:** formatting, lint, typecheck, unit tests, database tests (against a Postgres service) and the production build.
- **Docker image builds:** builds the production image to catch Dockerfile problems early.

The wall-selection model files are cached between runs.

## Wall selection

Tapping a wall uses **SlimSAM** (`Xenova/slimsam-77-uniform`, Apache 2.0), a small Segment-Anything model that runs in the visitor's browser with ONNX Runtime (WebGPU when available, WebAssembly otherwise). Findings and test results are in [PHASE0.md](PHASE0.md).

- **Lazy:** nothing downloads until the visitor opens the visualizer and picks a photo. The code is a separate chunk (`apps/web/src/lib/segmenter.ts`).
- **Self-hosted:** `apps/web/scripts/fetch-models.mjs` downloads the pinned model files into `apps/web/public/models/` (about 33 MB, of which a visitor downloads about 14 MB, or 21 MB with WebGPU) and copies the ONNX Runtime files into `apps/web/public/ort/` (about 41 MB, of which a visitor downloads one 14 to 27 MB file). It runs automatically before `npm run dev` and `npm run build`. These folders are git-ignored.
- **Cached:** the service worker keeps `/models/` and `/ort/` after the first download (cache `wall-model`).
- **Security policy:** the API's CSP allows `'wasm-unsafe-eval'` and `blob:` workers so WebAssembly can run. No third-party host is contacted at run time in production (in `npm run dev` the runtime comes from a CDN, because Vite's dev server can't serve scripts from `public/`).
- **Fallback:** if the model can't load or fails (offline, unsupported browser, low memory), the visualizer switches to the quick color-based selection and says so. Visitors can also switch to quick selection while the model loads.
- **Speed:** about 1 s to analyze a photo with WebGPU and 4 s or more with WebAssembly on a laptop. **Still to test on real phones.**

## Photos

Guest photos (the original and the recolored preview) are stored on disk in `UPLOAD_DIR` (default `./data/uploads`), with a row in the `uploads` table. Only the signed-in admin can view them (`/api/admin/uploads/:id`). Photos that are not attached to a request are deleted after 24 hours.

## Privacy: deleting data

- **Admin delete:** each request page has a "Delete this request" button that permanently removes the request, its areas and all its photos (database rows and files). Use it when a client asks for their data to be removed.
- **Automatic retention:** an hourly job deletes requests, with their photos, older than `RETENTION_DAYS` (default 365; `0` keeps everything). Choose the period with your father and make sure the privacy notice matches it. The job logs only counts, never personal details.
- Both are covered by the database tests (`npm run test:db`).

**In production, `UPLOAD_DIR` must be on a persistent volume**, or photos are lost on every deploy. Moving to Cloudflare R2 later only means changing `services/uploads.ts`.

## Deploying

Step-by-step guide for Render (Singapore) using the `render.yaml` Blueprint: [docs/DEPLOY.md](docs/DEPLOY.md). It is one Docker image (Express serves the API and the built PWA, and applies migrations on start), a PostgreSQL database and a disk for photos. CI starts the image against a database on every push.

## Still to do before real use

- Business name, logo, app icon (`apps/web/public/icon.svg`) and domain.
- Review the privacy notice text with the painter (business name and contact details).
- Phase 0 check: try the visualizer on about 20 of the painter's real job photos.
