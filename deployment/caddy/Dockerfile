FROM node:22 AS web
RUN corepack enable
WORKDIR /client

# Fetch deps from the lockfile alone so this layer is cached until it changes
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline

# Build-time client config. Vite inlines `import.meta.env.VITE_*` into the bundle,
# so the value has to exist HERE: the image has no .env (it is dockerignored), and
# an absent variable arrives as `undefined`, not as an empty string.
# VITE_API_URL stays empty for the same-origin deployment the Caddyfile sets up.
# VITE_IMAGE_URL is the public asset base for uploaded profile pictures.
ARG VITE_API_URL=""
ARG VITE_IMAGE_URL=""
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_IMAGE_URL=${VITE_IMAGE_URL}

# Build only the Vite app (and the workspace packages it depends on)
RUN pnpm turbo run build --filter=dashboard...

FROM caddy:2
COPY --from=web /client/apps/dashboard/dist /srv
