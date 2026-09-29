# Helios · TaskOps

A cloud-native DevOps portfolio project. **TaskOps** is a deliberately small task-management app (create, update, track tasks). The focus is the platform around it: containerization, CI/CD, security scanning, infrastructure as code, automated deployment to AWS, and monitoring.

## Architecture (target)

```
User → ALB ─┬─ /api/*  → backend  (Node + Express, ECS Fargate) → RDS PostgreSQL
            └─ /       → frontend (React + Vite on nginx, ECS Fargate)

GitHub Actions ── OIDC ──► ECR (images tagged by commit SHA) ──► ECS
CloudWatch: logs, dashboard, alarms → email
```

## Tech stack

| Area | Choice |
|---|---|
| Backend | Node.js 24 + Express 5, `pg`, `node-pg-migrate` |
| Frontend | React + Vite, served by nginx (non-root) |
| Database | PostgreSQL 16 (Docker locally, RDS on AWS) |
| Containers | Docker, Docker Compose |
| CI/CD | GitHub Actions |
| Security | Trivy, Dependabot, GitHub OIDC (no stored AWS keys) |
| IaC | Terraform (S3 remote state) |
| Cloud | AWS us-east-1: VPC, ECR, ECS Fargate, ALB, RDS, SSM, CloudWatch |

## Roadmap

- [x] **Phase 0:** Repo setup
- [ ] **Phase 1:** Local app: backend, frontend, Postgres, Dockerfiles, Compose
- [ ] **Phase 2:** CI: lint, test, build, Trivy scans, Dependabot
- [ ] **Phase 3:** AWS infrastructure with Terraform
- [ ] **Phase 4:** Automated deploys (OIDC, ECR, ECS, rollback, prod approval gate)
- [ ] **Phase 5:** Observability: CloudWatch dashboard and alarms
- [ ] **Phase 6:** Production readiness: docs, runbooks, diagrams

## Cost approach

This runs on a near-zero budget. Local development and CI are free. AWS environments are **ephemeral**: created with `terraform apply` for a practice session and removed with `terraform destroy` afterwards. The dev environment deliberately skips the NAT gateway and uses SSM Parameter Store instead of Secrets Manager. Production is defined in Terraform and validated with `plan`, but not kept running.

## Running locally

Requires Docker Desktop.

```bash
docker compose up --build        # or: bash scripts/local-start.sh
```

| URL | What |
|---|---|
| http://localhost:8080 | Web app |
| http://localhost:3000/api/tasks | REST API |
| http://localhost:3000/health | Liveness check (used by load balancer) |
| http://localhost:3000/ready | Readiness check (verifies the database) |

Stop with `docker compose down`. Add `-v` to also wipe the local database.

### Tests and lint

```bash
docker compose up -d postgres    # backend API tests use a real Postgres
cd backend  && npm ci && npm run lint && npm test
cd frontend && npm ci && npm run lint && npm test
```

### API

| Method | Path | Body |
|---|---|---|
| GET | `/api/tasks` | |
| POST | `/api/tasks` | `{ "title": "...", "description": "...", "status": "todo" }` |
| GET | `/api/tasks/:id` | |
| PATCH | `/api/tasks/:id` | any of `title`, `description`, `status` (`todo`, `in_progress`, `done`) |
| DELETE | `/api/tasks/:id` | |
