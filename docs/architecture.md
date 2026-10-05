# Architecture

## Local (Phase 1)

```
Browser ─► frontend :8080 (nginx-unprivileged, static React build)
              └─ /api/* ─► backend :3000 (Node 24 + Express 5) ─► postgres :5432 (PostgreSQL 16)
```

Started with `docker compose up --build`. Startup order is enforced by health checks:
Postgres healthy (`pg_isready`) → backend runs migrations, then starts and becomes healthy
(`/health`) → frontend starts.

| Component | Image | Notes |
|---|---|---|
| frontend | `nginxinc/nginx-unprivileged:1.30.5-alpine3.24` | Multi-stage: Node builds the Vite bundle, only static files ship. Runs as uid 101 on 8080. Proxies `/api` locally only. |
| backend | `node:24.21.0-alpine3.24` | Multi-stage, prod deps only, npm removed from runtime, runs as `node` user, code read-only to the app. |
| postgres | `postgres:16.15-alpine3.24` | Named volume `pgdata`; an init script creates a separate test database. |

### Health endpoints

- `GET /health` (backend and frontend): liveness. No DB call, so a slow database doesn't
  make the load balancer kill healthy containers. This is what the ALB will check.
- `GET /ready` (backend): readiness. Runs `SELECT 1` against Postgres.

### Why the frontend proxies `/api` only locally

In AWS the ALB routes `/api/*` straight to the backend target group, so the nginx `/api`
block never receives traffic. nginx resolves the backend hostname per request (variable +
resolver) rather than at startup, so the same image starts fine in AWS where no host
named `backend` exists. One image works in both environments, so nothing is rebuilt for prod.

## Security scanning

Images are scanned with Trivy (`--severity HIGH,CRITICAL --ignore-unfixed`). Without
Trivy installed, run it from its container:

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v trivy-cache:/root/.cache aquasec/trivy image --severity HIGH,CRITICAL \
  --ignore-unfixed taskops-frontend:local
```

Base images are pinned to exact versions, so they don't pick up OS patches on their own.
Most findings are fixed by bumping the pinned tag. Dependabot will open those PRs from
Phase 2 onward.

## AWS (target, Phases 3–5)

See the diagram in the [README](../README.md#architecture-target): ALB in public subnets,
ECS Fargate services and RDS in private subnets, images in ECR tagged by commit SHA,
logs and alarms in CloudWatch.
