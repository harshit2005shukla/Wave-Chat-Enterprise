# Architecture and Working Flow

## 1. Request flow

```text
Browser → REST/Socket gateway → authentication → validation → service/model → MongoDB
                                      ↓
                              room-based event fan-out
```

## 2. Authentication

Registration stores a BCrypt password hash and a browser-generated ECDH public key. Login issues a short-lived access token and a rotating refresh token. The refresh token is persisted as a hash, allowing logout and server-side revocation.

## 3. Encryption model

### Direct conversation

Both browsers own ECDH P-256 key pairs. They import the other user's public key and derive identical shared bits. HKDF uses the conversation ID as salt and produces a non-exportable AES-GCM key.

```text
ECDH(private-A, public-B) == ECDH(private-B, public-A)
shared secret + conversation ID → HKDF → AES-256-GCM key
```

### Group conversation

The creator generates a random AES-256 key. For each member, the creator derives an ECDH wrapping key and encrypts the raw group key. MongoDB stores only the wrapped key, IV and wrapping-sender public key for that member.

### Message envelope

```json
{
  "conversation": "...",
  "sender": "...",
  "type": "text",
  "ciphertext": "base64",
  "iv": "base64",
  "mediaUrl": null,
  "replyTo": null
}
```

## 4. Real-time messaging

1. Authenticated socket joins `user:<id>`.
2. Socket joins authorised `conversation:<id>` rooms.
3. Sender emits `message:send` with ciphertext.
4. Server validates membership and persists the envelope.
5. Server emits `message:new` to the conversation room.
6. Recipient emits delivered/read receipts.
7. Server updates receipt sets and broadcasts the result.

## 5. Presence and typing

Presence is kept in process memory and broadcast to users sharing conversations. For multiple API nodes, replace this map with Redis. Typing events are ephemeral and not persisted.

## 6. Media

Files are uploaded separately and referenced from an encrypted message. Development stores files under `/uploads`. Production should encrypt files in the browser, upload directly to S3-compatible storage using signed URLs, scan encrypted-compatible metadata where possible, and enforce lifecycle policies.

## 7. Calls

The caller creates an `RTCPeerConnection`, adds microphone/camera tracks and sends an SDP offer through Socket.IO. The recipient responds with an SDP answer. ICE candidates are exchanged through the same signalling channel. Audio/video packets travel via WebRTC, not through the Node API. TURN must be added for real production NAT traversal.

## 8. Scaling design

- Load balancer with WebSocket support
- Stateless REST nodes
- Socket.IO Redis adapter
- Redis presence and rate-limit state
- MongoDB replica set and sharding strategy
- S3-compatible object storage and CDN
- Queue for push notifications and media processing
- OpenTelemetry, structured logs and central metrics
- Regional deployment with account affinity

## 9. Failure handling

- Client-generated idempotency keys prevent duplicates.
- MongoDB unique indexes enforce idempotency.
- Socket acknowledgements inform the sender after persistence.
- REST message send is available as a fallback.
- Reconnection reloads paginated conversation history.
- Receipt updates use `$addToSet` and are safe to repeat.
