FROM node:26-alpine AS dev
RUN npm install -g pnpm
WORKDIR /app
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --ignore-scripts
EXPOSE 5173
CMD ["pnpm", "dev"]

FROM node:26-alpine AS build
RUN npm install -g pnpm
WORKDIR /app
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --ignore-scripts
COPY --chown=node:node . .
ARG VITE_APP_URL=http://localhost:5174
ENV VITE_APP_URL=$VITE_APP_URL
ARG VITE_TILE_URL=
ARG VITE_TILE_API_KEY=
ARG VITE_TILE_ATTRIBUTION=
ENV VITE_TILE_URL=$VITE_TILE_URL \
    VITE_TILE_API_KEY=$VITE_TILE_API_KEY \
    VITE_TILE_ATTRIBUTION=$VITE_TILE_ATTRIBUTION
RUN pnpm build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
