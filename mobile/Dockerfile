# Expo web export, served as static files. Deploy as its OWN Railway service
# (Settings -> Source -> Root Directory = `mobile`); the repo-root Dockerfile
# keeps building the Next.js backend. See docs/expo-web-hosting.md.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx expo export --platform web

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 3000
CMD ["node", "server/web-server.js", "dist"]
