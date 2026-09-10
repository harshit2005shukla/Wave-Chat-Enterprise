FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY . .
RUN npm run build -w apps/server

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --omit=dev
COPY --from=build /app/apps/server/dist apps/server/dist
RUN mkdir -p apps/server/uploads
EXPOSE 4000
CMD ["node", "apps/server/dist/server.js"]
