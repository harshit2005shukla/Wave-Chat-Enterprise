# Complete Module Workflows

## Registration and login

1. The browser creates an ECDH P-256 identity key pair.
2. Only the public JWK is sent to the API; the private JWK remains in browser storage.
3. The server validates the E.164 phone number and hashes the password using BCrypt.
4. Login returns a short-lived access token and a rotating refresh token.
5. Refresh-token hashes are stored in MongoDB, allowing logout and revocation.
6. Socket.IO authenticates with the same access token.

## Direct conversation

1. User search returns profiles and public encryption keys.
2. `/conversations/direct` creates or returns a deterministic two-member conversation.
3. Each browser calculates ECDH using its private key and the peer public key.
4. HKDF combines the shared secret with the conversation ID.
5. The result is an AES-256-GCM conversation key that is never sent to the API.

## Group conversation

1. The creator selects members who have registered public keys.
2. The browser generates a random AES-256 group key.
3. The key is encrypted separately for every member using an ECDH-derived wrapping key.
4. The server stores one wrapped key envelope per member.
5. A member unwraps the group key locally using their private key and the creator public key.
6. Messages are encrypted once with the shared group key.

## Message sending

1. The composer creates a UUID `clientId` for idempotency.
2. Message text is encrypted locally with AES-GCM and a fresh 96-bit IV.
3. The socket sends routing metadata, ciphertext and IV.
4. The API checks conversation membership.
5. MongoDB stores the encrypted envelope.
6. Socket.IO broadcasts `message:new` to the conversation room.
7. The receiving browser decrypts and renders the message.
8. Repeated sends with the same sender/client ID return the existing record.

## Offline messages

MongoDB acts as the development offline store. After reconnection, the client calls the paginated message endpoint and decrypts the retained envelopes. In a high-volume production design, recent queues would be separated from durable conversation history.

## Delivery and read receipts

- The receiving client emits `message:delivered` after reception.
- It emits `message:read` while the relevant conversation is open.
- MongoDB uses set semantics, making duplicate receipt events safe.
- The sender receives `message:receipt` and updates tick indicators.

## Typing and presence

Typing events are transient socket broadcasts and are never persisted. Presence is updated when the first socket connects or the last socket disconnects. A multi-node deployment must move presence state and Socket.IO rooms to Redis.

## Media

1. The browser uploads the file using multipart form data.
2. Development stores the file under `apps/server/uploads`.
3. The returned URL and metadata are attached to an encrypted message envelope.
4. The receiver renders images, video and audio or displays a document download card.

Development media objects are not encrypted at rest. A production implementation should encrypt bytes in the browser before direct object-storage upload.

## Status

1. The creator gathers encryption-ready contacts from conversations.
2. A random status AES key is generated.
3. The key is wrapped for the owner and every audience member.
4. The text is encrypted with that key.
5. MongoDB expires the status automatically after 24 hours using a TTL index.
6. View events are stored once per viewer.

## Calls

1. The caller requests microphone and optional camera permission.
2. An `RTCPeerConnection` creates an SDP offer.
3. Socket.IO routes the offer to the recipient and records a call session.
4. The recipient creates an SDP answer.
5. Both browsers exchange ICE candidates through the signalling server.
6. WebRTC transports the audio/video stream directly when possible.
7. A production deployment requires authenticated TURN servers for difficult NAT and firewall conditions.

## Edit and delete

An edit produces new ciphertext and IV for the same message record. Delete-for-everyone overwrites the ciphertext marker and broadcasts a deletion event. A recipient may already have copied or captured content, so distributed deletion is not an absolute recall guarantee.

## RBAC

- `user`: personal messaging features.
- `moderator`: reserved for future abuse and report workflows.
- `admin`: platform statistics endpoint and operational administration foundations.

Every conversation operation also performs resource-level authorization; a role alone never grants access to another user's private conversation.

## Production evolution

Replace local uploads with object storage, add Redis and the Socket.IO adapter, use managed MongoDB replica sets, deploy TURN, add push notifications, adopt an audited Signal Protocol implementation, create per-device identities, add key transparency and conduct security testing before real-world use.
