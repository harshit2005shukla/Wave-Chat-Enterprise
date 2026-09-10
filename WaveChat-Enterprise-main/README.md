# WaveChat Enterprise

A production-style, locally runnable WhatsApp-inspired messaging platform built with React, TypeScript, Node.js, Express, MongoDB, Socket.IO and browser Web Crypto.

> This is an original educational implementation. It is not WhatsApp source code, is not affiliated with Meta, and must not be marketed using WhatsApp branding.

## Included modules

- Phone/password registration and JWT access/refresh authentication
- Role-based access control: `user`, `moderator`, `admin`
- Device public-key registration
- One-to-one and group conversations
- Client-side AES-GCM message encryption
- ECDH-based direct-chat key derivation
- Wrapped per-member group keys
- Real-time messages, typing, online status and last seen
- Delivered/read receipts
- Reply, edit and delete-for-everyone events
- Image, video, audio and document upload
- Status stories with expiry and view receipts
- WebRTC one-to-one audio/video call signalling
- Contact/user search and profile settings
- Admin health and platform-statistics endpoints
- Helmet, rate limiting, validation, central error handling and audit-friendly logs
- Docker Compose, seed data, tests and architecture documentation

## Important security scope

The application demonstrates client-side encryption, but it is **not independently audited** and is not a replacement for the Signal Protocol. Direct chat keys are derived with ECDH P-256 and HKDF. Group keys are random AES-256 keys wrapped separately for members. Production deployment would require audited cryptography, secure device key backup, key transparency, multi-device pre-key rotation, abuse controls, malware scanning, TLS termination and a dedicated secrets manager.

## Architecture

```text
React web client
  ├─ Web Crypto: ECDH, HKDF and AES-GCM
  ├─ REST API: auth, conversations, media, status
  ├─ Socket.IO: messages, receipts, typing, presence, calls
  └─ WebRTC: browser-to-browser media

Node/Express API + Socket.IO
  ├─ JWT authentication and RBAC
  ├─ MongoDB metadata and encrypted message envelopes
  ├─ Local media storage for development
  └─ Event fan-out to user and conversation rooms
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- MongoDB 7, or Docker Desktop
- Modern Chrome/Edge/Firefox with Web Crypto and WebRTC

## Fastest setup with Docker

```bash
unzip wavechat-enterprise.zip
cd wavechat-enterprise
docker compose up --build
```

Open `http://localhost:5173`.

Seed the demo data from another terminal:

```bash
docker compose exec server node apps/server/dist/seed.js
```

## One-command Windows setup

From PowerShell in the extracted folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
./scripts/setup-windows.ps1
```

Linux/macOS users can run `./scripts/setup-linux.sh`. A Postman collection is included under `postman/`.

## Manual local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the server

```bash
cp .env.example apps/server/.env
```

Keep only the server variables in `apps/server/.env`.

### 3. Configure the web application

Create `apps/web/.env`:

```env
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

### 4. Start MongoDB

```bash
docker run --name wavechat-mongo -p 27017:27017 -d mongo:7
```

### 5. Seed demo users

```bash
npm run seed
```

Demo accounts:

| Phone | Password | Role |
|---|---|---|
| `+919999000001` | `Password@123` | admin |
| `+919999000002` | `Password@123` | user |
| `+919999000003` | `Password@123` | user |

Each browser profile generates its own cryptographic identity. Log in once with two different browser profiles, then start a direct conversation. Existing encrypted messages cannot be decrypted on a fresh device unless its keys were available when the message was encrypted.

### 6. Run development mode

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/api/health`

## Production build

```bash
npm run build
npm run start
```

The API can serve `apps/web/dist` automatically when it exists.

## Test

```bash
npm test
```

## Main API routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Register account and public key |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Rotate access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/users/me` | Current profile |
| GET | `/api/users/search?q=` | Search users |
| PATCH | `/api/users/me` | Update profile |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations/direct` | Create/find direct conversation |
| POST | `/api/conversations/group` | Create encrypted group |
| GET | `/api/messages/:conversationId` | Paginated encrypted messages |
| POST | `/api/messages` | Send encrypted message over REST |
| POST | `/api/uploads` | Upload media |
| GET | `/api/statuses/feed` | Status feed |
| POST | `/api/statuses` | Create status |
| POST | `/api/statuses/:id/view` | Mark viewed |
| GET | `/api/admin/stats` | Admin platform statistics |

## Socket events

### Client to server

- `conversation:join`
- `message:send`
- `message:delivered`
- `message:read`
- `message:edit`
- `message:delete`
- `typing:start`
- `typing:stop`
- `call:offer`
- `call:answer`
- `call:ice`
- `call:end`

### Server to client

- `message:new`
- `message:ack`
- `message:receipt`
- `message:edited`
- `message:deleted`
- `typing:update`
- `presence:update`
- `call:incoming`
- `call:answered`
- `call:ice`
- `call:ended`

## Project structure

```text
apps/
  server/
    src/
      config/       environment and database
      middleware/   auth, validation and errors
      models/       MongoDB models
      routes/       REST API
      services/     tokens and shared business logic
      socket/       real-time gateway
      tests/        API tests
  web/
    src/
      components/   UI building blocks
      context/      authentication
      hooks/        socket integration
      lib/          API, crypto, storage
      pages/        auth and chat application
      types/        shared client types
docs/
  ARCHITECTURE.md
  SECURITY.md
  DEPLOYMENT.md
```

## Senior-level implementation notes

1. **The server stores ciphertext:** message text is encrypted in the browser before transmission.
2. **Direct chats:** both users derive the same AES key from their ECDH identities and the conversation ID.
3. **Groups:** the creator generates one random AES key and wraps it separately for every member.
4. **Real-time delivery:** sockets join user-specific and conversation-specific rooms.
5. **Offline delivery:** MongoDB retains encrypted envelopes. Clients fetch them after reconnecting.
6. **Receipts:** delivered/read arrays are idempotent MongoDB set updates.
7. **Media:** development uses disk storage; production should use object storage with signed URLs and encrypted objects.
8. **Calls:** Socket.IO performs signalling; WebRTC carries encrypted browser media.
9. **Horizontal scaling:** use Redis adapter for Socket.IO, MongoDB replica sets, object storage and a load balancer with WebSocket support.
10. **Moderation:** metadata-based rate limits are included; production requires reports, device reputation and specialist abuse systems.

Read `docs/ARCHITECTURE.md`, `docs/MODULE_WORKFLOWS.md`, `docs/SECURITY.md` and `docs/DEPLOYMENT.md` for detailed design, module flows and production guidance.
