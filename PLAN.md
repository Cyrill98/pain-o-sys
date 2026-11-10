# Painting Booking System: End-to-End Plan (v2)

**Decisions locked in:** Malaysia (MYR, sqft/sqm), English + Bahasa Melayu, no fixed paint brand (admin keys in or uploads his own colors), quote requests go **to the admin's WhatsApp**, no price shown to clients, PWA on the same stack as the massage booking app (`~/Documents/GitHub/pwa-app`).

## 1. The idea, polished

**One-liner:** A mobile-first PWA where a client picks what they want painted, tries your father's real colors on their own walls using their phone camera, then sends the request to his WhatsApp with everything pre-filled. He manages the color palette and incoming requests from a simple admin area.

| Original                                | Polished                                                                               | Why                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| "Book" and "request quotation" separate | One flow: **Request a quote** (with optional preferred site-visit dates)               | He can't price or schedule without seeing the job.                        |
| Live AR as the core                     | **Photo visualizer first**; live camera preview **deferred** (see LIVE_CAMERA_PLAN.md) | iPhone Safari has no WebXR; photo mode works everywhere and is shareable. |
| Quote generated in the app              | **Quote happens in WhatsApp**, where he already talks to clients                       | No quote builder, no pricing engine, no client accounts to maintain.      |
| Client tracks status in the app         | Client is **guest-only**; the conversation continues on WhatsApp                       | Less to build, matches how Malaysian small businesses actually work.      |
| (not mentioned)                         | Color disclaimer and "ask for a physical sample"                                       | Screen colors never match paint exactly.                                  |

## 2. User flows

### Client (guest, no account)

1. **Landing:** "Try colors on your walls, get a free quote." Language toggle EN / BM.
2. **Property type:** House / Apartment-Condo / Office / Shop / Factory-Warehouse / Other.
3. **Areas:** multi-select, adapting to property type (living room, bedrooms, kitchen, bathroom, ceiling, exterior walls, fence, doors and trim...).
4. **Per-area details:** approximate size (sqft, or small / medium / large with hints), interior or exterior, condition (good / needs patching / peeling or damp), furnished or empty.
5. **Pick colors:** admin's palette, filter by color family and finish (matt / satin / gloss); favorite per area.
6. **Visualize:** take or upload a photo, tap the wall, color applied. Compare two colors with a slider. Save snapshot to the request. Live camera is deferred.
7. **Contact:** name, phone, address or area (town / postcode), preferred site-visit dates, notes.
8. **Send:** the request is saved (photos and snapshots stored) and the app opens **WhatsApp (`wa.me`) with a pre-filled message** to the admin:
   - client name and phone, address, property type
   - areas, sizes and condition
   - chosen color name / code per area
   - preferred dates and notes
   - a link to the full request page with photos and snapshots (viewable only by the admin; the link needs admin login).
9. **Confirmation screen:** "Sent! If WhatsApp didn't open, tap here", plus a copy-message button as fallback.

### Admin (your father)

- **Requests:** list of saved requests with photos and snapshots; mark New / Contacted / Quoted / Won / Lost; one-tap "reply on WhatsApp".
- **Color catalog:** add a color by name, code, HEX, finish and collection; **pick HEX from a color picker or sample it from an uploaded swatch photo**; bulk import from CSV; hide or reorder.
- **Portfolio:** before/after photos for the landing page.
- **Settings:** WhatsApp number, business name and logo, service areas, languages.

**Admin "notification via WhatsApp"** works because the client's message arrives in his WhatsApp chat. No WhatsApp Business API is needed (that costs money and requires Meta verification). The app also sends him a web push notification, as in the massage app. Phase 3 can add the official WhatsApp Business API if he wants automatic messages.

**Safeguard:** if a client closes WhatsApp without sending, the request is still saved in the admin list (marked "not confirmed on WhatsApp"), so nothing is lost.

## 3. Honest feasibility assessment

### AR / visualizer

- iPhone Safari has no WebXR. Use `getUserMedia` (camera) plus canvas image processing so it works on every phone.
- **Wall detection:** (1) tap-to-select via flood fill and edge detection with a correction brush (MVP); (2) ML wall segmentation (ADE20K-trained model, in-browser via ONNX Runtime Web) for auto-detect and live preview (Phase 2). A native ARKit/ARCore app is not worth it for one painter.
- **Realism:** keep the original lightness (shadows, texture) in LAB/HSL and replace only hue and chroma; soften edges at corners, furniture and window frames.
- **Phase 0 checkpoint:** test the recoloring on about 20 of his real job photos before building the rest.

### Risks

| Risk                             | Mitigation                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Visualizer looks fake            | Luminance-preserving recolor, soft edges, manual brush, Phase 0 test                           |
| Color mismatch with real paint   | Disclaimer, offer a physical sample, HEX sampled from real swatches                            |
| `wa.me` link can't attach images | Save the request server-side and send a link to it in the message                              |
| Spam or fake requests            | Cloudflare Turnstile (already in the massage app), rate limiting, phone validation (MY format) |
| Client photos are private        | Private storage, consent checkbox, auto-delete after N months                                  |
| Scope creep                      | Strict phases below                                                                            |

## 4. Tech stack (reusing the massage app's)

| Layer    | Choice (same as `pwa-app`)                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Monorepo | npm workspaces: `apps/web`, `apps/api`, `packages/shared`                                                                 |
| Web      | React 19, Vite, Tailwind, shadcn/ui (Radix), TanStack Query, React Router, PWA via vite-plugin-pwa and Workbox            |
| i18n     | i18next and react-i18next (EN and BM; routes like `/en/...` and `/ms/...`)                                                |
| API      | Express 5, TypeScript, Zod validation (shared with the web app)                                                           |
| DB       | PostgreSQL 16, Drizzle ORM, SQL migrations                                                                                |
| Auth     | Single admin account: `create-admin` script, argon2, express-session with `connect-pg-simple`                             |
| Security | helmet, express-rate-limit, Cloudflare Turnstile                                                                          |
| Push     | web-push (VAPID)                                                                                                          |
| Phone    | libphonenumber-js (default region MY)                                                                                     |
| Deploy   | One Docker image (Express serves the API and the built PWA) on Railway or Render, with managed Postgres and daily backups |

**New for this project:**

- **Image storage:** the massage app has none. Start with object storage (Cloudflare R2 or S3-compatible, with signed URLs) or, to keep it simple, a persistent disk volume on Railway/Render. I recommend R2.
- **Image processing:** OpenCV.js or hand-written canvas code on the client for the visualizer; `sharp` on the server for resizing and thumbnails.
- **Wall selection:** SlimSAM (Apache 2.0) via ONNX Runtime Web, self-hosted and lazy-loaded, with the color-based selection as a fallback (see PHASE0.md). SegFormer was tested but its license looks non-commercial.

The simplest path is to **copy the massage app's skeleton** (auth, i18n, PWA shell, Docker, CI) and replace the booking domain with the painting domain.

## 5. Data model

- `admin_users`: id, email, name, password_hash (same as the massage app)
- `settings`: whatsapp_number, business_name, logo_url, default_language
- `colors`: id, name, code, hex, finish, collection, family, swatch_photo_url, active, sort
- `property_types` and `area_types`: key, name_en, name_ms, sort (seeded; editable later)
- `requests`: id, client_name, phone, email (optional), address, town, postcode, property_type, preferred_dates, notes, status, whatsapp_confirmed (bool), consent_at, created_at
- `request_areas`: request_id, area_type, interior_exterior, size_sqft, condition, furnished, color_id, original_photo_url, snapshot_url
- `portfolio_items`: before_url, after_url, caption_en, caption_ms, sort
- `push_subscriptions`: as in the massage app

## 6. Roadmap

| Phase             | Scope                                                                                                                                                                         | Status                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Validate**   | Recolor prototype on 20 photos                                                                                                                                                | **Done.** See PHASE0.md. Still to do: real phone photos from your father's jobs.                                                                                                                  |
| **1. MVP**        | Scaffold from the massage app; EN/BM; client flow; color catalog admin; photo visualizer; image upload; request saved and WhatsApp prefilled message; requests list; web push | **Built.** Launch work is in LAUNCH_CHECKLIST.md.                                                                                                                                                 |
| **2. AR upgrade** | ML wall detection; CSV color import; compare slider; portfolio page; live camera                                                                                              | **Partly done.** Smart wall selection and CSV import are built. **Live camera is deferred** (LIVE_CAMERA_PLAN.md). Compare slider and portfolio page are not built and are not needed for launch. |
| **3. Growth**     | WhatsApp Business API auto-replies, quote PDFs, calendar of site visits, reviews, QR code poster generator                                                                    | Based on what he asks for                                                                                                                                                                         |

## 7. Success metrics

- Landing to sent request in under 4 minutes.
- More than 40% of visitors open the visualizer.
- More than 10% of visitors send a request.
- He replies to requests within 24 hours.
- Requests that turn into jobs (his real measure).

## 8. Remaining small decisions (I'll default unless you say otherwise)

1. **Units:** sqft is common for Malaysian homes, so default to sqft with a sqm toggle.
2. **Currency:** none needed, since no prices are shown.
3. **Domain and name:** business name, logo and domain are still needed for deploy and branding.
4. **Image storage:** Cloudflare R2.
5. **Location:** free-text address plus town. No map in the MVP.
