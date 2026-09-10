# Deployment Guide

## Development

Use Docker Compose from the repository root.

## Recommended production topology

```text
Cloud load balancer
  ├─ web static files through CDN
  ├─ API autoscaling group
  └─ Socket.IO autoscaling group + Redis adapter

Managed MongoDB replica set
Managed Redis
S3-compatible encrypted object storage
TURN service
Central logs, traces and alerts
```

## Environment variables

Never commit secrets. Generate at least 32 random bytes for each JWT secret. Restrict `CLIENT_ORIGIN` to the real HTTPS domain.

## Reverse proxy requirements

- Forward `Upgrade` and `Connection` headers
- Increase idle timeout for WebSockets
- Enforce TLS 1.2+
- Limit request body size
- Preserve client IP through trusted proxy headers

## Database operations

- Enable backups and point-in-time recovery
- Use replica sets before transactions/change streams
- Add capacity alerts for connections, storage and replication lag
- Test restore procedures regularly
