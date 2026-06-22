# Realtime collaboration service (Hocuspocus WebSocket server).
#
# The Next.js web app deploys separately (e.g. Vercel). This image runs ONLY
# server/realtime.ts, which shares the same Postgres database as the web app.
#
# Build:  docker build -t storyroom-realtime .
# Run:    docker run -e DATABASE_URL=... -p 1234:1234 storyroom-realtime
FROM node:22-slim AS base
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# Install dependencies (postinstall runs `prisma generate`, so the schema and
# prisma config must be present before install).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile --prod=false

# App source.
COPY tsconfig.json ./
COPY server ./server
COPY src ./src

# Hosts inject PORT; the server also honours COLLAB_PORT. Document the default.
EXPOSE 1234
CMD ["pnpm", "run", "start:realtime"]
