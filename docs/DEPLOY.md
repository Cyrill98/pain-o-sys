# Deploying to Render

This guide gets the app online on [Render](https://render.com) using the `render.yaml` Blueprint in the repository. The Blueprint creates a web service (the Docker image), a PostgreSQL database and a disk for guest photos, all in **Singapore**, the closest region to Malaysia.

The same Docker image runs on Railway, Fly.io or any host that can run a container with a persistent folder and a PostgreSQL database. The notes at the end cover that.

CI already starts this exact image against a database, with a root-owned disk like Render's, and checks migrations, uploads, the security policy and the model files, so a failed first deploy is much more likely to be a missing setting than a code problem.

## 0. Before you start

You need:

- A **Render account** with a payment method. A paid web service is required, because the photo disk isn't available on free instances, and the free database is not suitable for real use. I could not retrieve Render's current prices, so check the [pricing page](https://render.com/pricing) before you commit. The Blueprint uses the smallest paid web service (`0.5c-512mb`), the smallest paid database (`0.1c-256mb`) and a 5 GB disk. These plan names come from Render's blueprint documentation. If Render rejects one, choose the nearest plan in the dashboard.
- A **Cloudflare account** (free) for the Turnstile spam check.
- A **domain name**. You can start on the free `...onrender.com` address and add the domain later (step 7).
- A generic business email address for the push-notification contact (step 2). Do not use a personal address (see the note there).

## 1. Create the Turnstile widget

1. In the Cloudflare dashboard open **Turnstile** and **Add widget**.
2. Hostnames: add your final domain, and the `...onrender.com` address once you know it (you can edit this later). Widget mode: **Managed**.
3. Copy the **Site key** (public) and the **Secret key**. They become `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.

## 2. Generate the push keys

On your computer:

```bash
npx web-push generate-vapid-keys
```

Copy the public and private key. They become `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Set `VAPID_SUBJECT` to `mailto:` plus a **business** email address (for example `mailto:hello@your-domain.my`). Push services such as Apple's and Google's receive this address with every notification, so it should not be a personal email.

Push is optional. If you skip these three values, the app works but your father gets no notifications on his phone.

## 3. Create the Blueprint on Render

1. In Render choose **New → Blueprint** and connect the GitHub repository `Cyrill98/pain-o-sys` (or paste its public URL).
2. Render reads `render.yaml` and shows the resources it will create. Check the region (Singapore) and plans, then continue.
3. Render asks for the values marked `sync: false`:

| Variable               | Value                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`             | The public **https** address with no trailing slash. For the first deploy use `https://painting.onrender.com`. |
| `TURNSTILE_SECRET_KEY` | From step 1                                                                                                    |
| `TURNSTILE_SITE_KEY`   | From step 1                                                                                                    |
| `VAPID_PUBLIC_KEY`     | From step 2 (or leave empty)                                                                                   |
| `VAPID_PRIVATE_KEY`    | From step 2 (or leave empty)                                                                                   |
| `VAPID_SUBJECT`        | `mailto:` plus a business email (or leave empty)                                                               |

`DATABASE_URL`, `SESSION_SECRET`, `UPLOAD_DIR` and `RETENTION_DAYS` are filled in automatically. Change `RETENTION_DAYS` in the dashboard if you and your father choose a period other than 365 days.

4. Create the Blueprint. The first build takes several minutes: it installs packages and downloads the 33 MB wall-selection model files.

**`SITE_URL` must match the address visitors actually use**, exactly (scheme and host). The app rejects form posts from any other address as a security measure, so if it is wrong, guests see an error when they send a request. After the first deploy, open the service in Render, copy its real address if it differs from the guess, and update `SITE_URL`. Update it again when you add your own domain (step 7).

## 4. Create the admin account

In the web service open **Shell** (a paid-plan feature) and run:

```bash
ADMIN_PASSWORD='choose-a-long-password' node apps/api/dist/create-admin.js --email you@example.com --name "Your father's name"
```

Use a long password (at least 12 characters, the script enforces a minimum). The app supports **one admin account**. To reset the password later, run the same command with `--reset`.

## 5. First sign-in

1. Open `https://<your address>/en/admin/login` and sign in.
2. **Settings:** set the business name and the WhatsApp number that will receive requests. Without the number, guests see a "WhatsApp isn't set up yet" note.
3. **Colors:** add the paint colors (or paste a CSV).
4. **Settings → Notifications:** turn on notifications on your father's phone (iPhone: add the app to the Home Screen first).

## 6. Check that it works

From any computer:

```bash
curl -s https://<your address>/api/health
curl -sI https://<your address>/en | grep -i -E "strict-transport|content-security"
```

Then, in a browser (phone and desktop):

- Open `/en/request`, go through the flow, choose a photo and tap a wall. The wall should paint within a few seconds. The browser console should show **no blocked requests**.
- Send the request. It should appear in the admin list with its photos, and the WhatsApp button should open a chat with the message filled in.
- Check `/ms/` shows Malay.
- Delete the test request from its page in the admin.

## 7. Add your own domain

1. In the web service open **Settings → Custom Domains** and add your domain. Render shows the DNS records to create. Create them at your domain registrar.
2. Wait for the certificate to be issued (Render shows the status).
3. Update **`SITE_URL`** to the new address, add the domain to the Turnstile widget hostnames, and redeploy.
4. Re-check step 6 on the new address. Anyone who installed the app from the old address should reinstall it from the new one.

## 8. Backups and monitoring

- **Photos:** Render snapshots the disk once every 24 hours and keeps each snapshot for 7 days. A restore replaces the whole disk and loses anything added after the snapshot.
- **Database:** open the database in Render and confirm what recovery and backup it offers on your plan (I could not verify this). **Do a test restore once** before you rely on it.
- **Monitoring:** add an uptime check (for example UptimeRobot or Better Stack) on `https://<your address>/api/health`, and turn on Render's failed-deploy notifications.
- **Logs:** the hourly cleanup logs how many old photos and requests it deleted, never personal details.

## 9. Updating the app

Push to `main`. Render deploys after the GitHub checks pass (`autoDeployTrigger: checksPass` in `render.yaml`). Because the photo disk limits the service to one instance, there is a few seconds of downtime during each deploy.

To roll back, use **Deploys → Rollback** in Render on the previous good deploy. Database changes run automatically on start and are not rolled back, so keep migrations backward compatible.

## 10. All settings

| Variable                                                                  | Required          | Purpose                                                                                  |
| ------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                            | Yes               | PostgreSQL connection (set by the Blueprint)                                             |
| `SESSION_SECRET`                                                          | Yes               | At least 32 characters; signs admin sessions (generated by the Blueprint)                |
| `SITE_URL`                                                                | Yes               | Public https address, used for form-post checks, links and push                          |
| `TURNSTILE_SECRET_KEY`                                                    | Yes in production | Server-side spam check                                                                   |
| `TURNSTILE_SITE_KEY`                                                      | Yes in production | Public key sent to the browser at run time (no rebuild needed)                           |
| `UPLOAD_DIR`                                                              | Yes with a disk   | Folder for guest photos. Must be on a persistent disk (`/data/uploads` in the Blueprint) |
| `RETENTION_DAYS`                                                          | No (365)          | Delete requests and photos older than this. `0` keeps everything                         |
| `VAPID_*`                                                                 | No                | Push notifications to the admin's phone                                                  |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL`, `ADMIN_NOTIFY_LANG` | No                | Email notifications to the admin                                                         |
| `PORT`                                                                    | Set by the host   | Port to listen on                                                                        |

The app refuses to start in production if `SESSION_SECRET`, `SITE_URL` (https), `TURNSTILE_SECRET_KEY` or `TURNSTILE_SITE_KEY` is missing, or if `UPLOAD_DIR` isn't writable, and prints which one.

## Other hosts

- **Railway or Fly.io:** build the same `Dockerfile`, attach a persistent volume and set `UPLOAD_DIR` to its path, attach a PostgreSQL database, and set the variables above. The container fixes the ownership of the photo folder itself, so a root-owned volume is fine. Choose a Singapore region.
- **Your own server:** `docker compose up -d db` for the database, then `docker run` the image with the variables above and a volume, behind a reverse proxy that provides HTTPS.

## Public repository note

The GitHub repository is public. It contains no secrets: `.env` files, the downloaded model files and the test photos are git-ignored. Keep it that way: set every secret in Render, never in the repository.
