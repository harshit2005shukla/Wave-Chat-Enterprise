#!/usr/bin/env sh
set -eu
[ -f apps/server/.env ] || cp apps/server/.env.example apps/server/.env
[ -f apps/web/.env ] || cp apps/web/.env.example apps/web/.env
npm install
docker compose up -d mongo
npm run seed
npm run dev
