# Production image: Express API serving the built PWA. Works on Railway, Render, Fly, etc.

# ── Build ────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY . .
# Public values baked into the web app at build time (Vite). Pass with --build-arg / host settings.
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN npm run build

# ── Runtime ──────────────────────────────────────────
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# Only the API's dependencies: the web app is already built, and the browser-side packages
# (including the AI runtime, about 150 MB) are not needed at run time.
RUN npm ci --omit=dev --workspace=@app/api && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
USER node
EXPOSE 3000
# Apply pending migrations, then start the server (single instance).
CMD ["sh", "-c", "node apps/api/dist/migrate.js && exec node apps/api/dist/index.js"]
