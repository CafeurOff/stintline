# syntax=docker/dockerfile:1.7
# Build context: repository root.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH" CI=true
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .prettierrc.json ./
COPY apps/web/package.json apps/web/
COPY packages/api-types/package.json packages/api-types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY packages/api-types packages/api-types
COPY apps/web apps/web

FROM base AS dev
EXPOSE 5173
CMD ["pnpm", "--filter", "web", "exec", "vite", "--host", "0.0.0.0"]

FROM base AS build
RUN pnpm --filter web build

FROM nginx:1.27-alpine AS prod
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
