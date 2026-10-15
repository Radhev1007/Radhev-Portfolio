# RC Crawler multiplayer server. Any host that runs a long-lived Node process with WebSockets works:
# Render / Railway / Fly.io / a VPS. (Static or serverless-function hosting cannot hold the connections.)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY shared ./shared
EXPOSE 2567
USER node
CMD ["node", "src/index.js"]
