# Security Guide

## Implemented

- Password hashing with BCrypt
- Short-lived JWT access tokens
- Rotating, revocable refresh tokens stored as hashes
- HTTP security headers with Helmet
- CORS allow-list
- API rate limiting
- Zod request validation
- MIME and file-size validation
- Authorisation checks for every conversation operation
- Browser-side ECDH, HKDF and AES-GCM
- Ciphertext-only text messages in MongoDB
- RBAC for administration endpoints

## Production requirements

- HTTPS and secure cookies instead of localStorage refresh tokens
- Content Security Policy tuned for the deployed frontend
- CSRF protection when cookies are used
- Audited Signal Protocol implementation
- Pre-key server and one-time key consumption
- Key transparency and safety-number verification
- Secure encrypted key backup and recovery
- Per-device identities and device revocation
- Redis-backed distributed rate limiting
- Malware scanning and content-disarm workflow
- Object-storage encryption and signed URL expiry
- Secrets manager and automatic rotation
- Audit log retention policy
- Penetration testing and dependency scanning
- TURN credentials with short expiry
- Abuse-report workflow and legal/privacy review

## Threat boundaries

Client-side encryption cannot protect a compromised browser, malicious extension, screen capture, copied message, weak account password or stolen authenticated device.
