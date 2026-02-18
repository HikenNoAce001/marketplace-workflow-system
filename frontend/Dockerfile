# =============================================================
# Multi-stage Dockerfile for Next.js 16.1 frontend
#
# Stage 1 (deps): Install node_modules
# Stage 2 (builder): Build the production Next.js app
# Stage 3 (runner): Run the app with minimal image size
#
# This pattern keeps the final image small (~200MB vs ~1GB)
# because build tools and dev dependencies are discarded.
# =============================================================

# --- Stage 1: Install dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app

# Copy package files first (Docker caches this layer if they don't change)
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Build the Next.js app ---
FROM node:22-alpine AS builder
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy all source code
COPY . .

# Accept the API URL as a build argument — Railway sets this at build time.
# NEXT_PUBLIC_ vars are baked into the client JS bundle during `npm run build`,
# so they MUST be set before the build step, not at runtime.
# Default to localhost for local Docker builds (docker compose up).
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build the production app (generates .next/ folder)
RUN npm run build

# --- Stage 3: Run the production app ---
FROM node:22-alpine AS runner
WORKDIR /app

# Don't run as root in production (security best practice)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only what's needed to run
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Next.js listens on port 3000 by default
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the Next.js server
CMD ["node", "server.js"]
