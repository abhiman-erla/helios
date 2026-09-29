# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

**Cloud-Native DevOps Platform** — a portfolio project that takes a small app, **TaskOps** (task management: create/update/track tasks), from source code to a secure, monitored AWS deployment.

The app logic is intentionally simple. **The real focus is the DevOps tooling around it**: Docker, GitHub Actions CI/CD, Terraform, AWS (ECR, ECS Fargate, RDS, ALB, CloudWatch), and security scanning.

The owner is building this to learn and to explain it in DevOps/Cloud/SRE interviews. **Explain the "why" behind non-obvious choices** in short comments or in your reply, so the owner can defend each decision.

## Current status

- **Phase:** Phase 1 in progress (app skeleton, Dockerfiles, Docker Compose).
- The full plan lives in `README.md`. Keep this file and the README in sync when decisions change.

## Open decisions (ask before assuming)

All initial decisions are made (see below). Ask the owner before changing any of them.

## Tech decisions

- Backend: Node.js 24 LTS + Express 5
- Backend tests / lint: Jest + Supertest / ESLint (flat config)
- DB driver / migrations: `pg` + `node-pg-migrate`
- Frontend: React + Vite, served by nginx (unprivileged image)
- Frontend tests / lint: Vitest + React Testing Library / ESLint
- Database: PostgreSQL 16 (local via Docker Compose, AWS via RDS)
- Compute: AWS ECS Fargate (EKS is a future enhancement, not now)
- AWS region: us-east-1
- IaC: Terraform
- CI/CD: GitHub Actions
- Registry: AWS ECR
- Scanning: Trivy (images + filesystem), Dependabot (dependencies)

## Repository layout

```
frontend/            Dockerfile, src/, tests/
backend/             Dockerfile, src/, tests/, migrations/
terraform/
  bootstrap/         one-time S3 remote-state bucket (local state)
  environments/dev/  dev root module (calls modules/)
  environments/prod/ prod root module (calls modules/)
  modules/           vpc, ecr, ecs, rds, alb, iam, cloudwatch
.github/workflows/   ci.yml, security.yml, deploy-dev.yml, deploy-prod.yml
docs/                architecture.md, deployment.md, monitoring.md, troubleshooting.md
scripts/             local-start.sh, local-stop.sh, deploy.sh, destroy.sh
docker-compose.yml
```

Rules for this layout:
- Environments must **only call modules** — no raw resources in `environments/*`.
- Dev and prod use the **same modules** with different variables (sizes, counts, names).
- Each service is independently buildable from its own directory.

## Common commands

```bash
# Local
docker compose up --build        # start frontend, backend, postgres
docker compose down              # stop
docker compose down -v           # stop and wipe the local DB volume

# Backend (inside backend/)
npm ci
npm run lint
npm test                         # needs Postgres (docker compose up postgres)
npm run migrate                  # apply DB migrations

# Frontend (inside frontend/)
npm ci
npm run lint
npm test
npm run dev                      # Vite dev server, proxies /api to localhost:3000

# Terraform (run inside terraform/environments/<env>)
terraform init
terraform fmt -recursive
terraform validate
terraform plan

# Security
trivy fs .
trivy image taskops-backend:local
trivy config terraform/          # IaC misconfiguration scan
```

## Safety rules (important)

1. **Never run `terraform apply` or `terraform destroy`** yourself. Run `plan`, show the summary, and let the owner apply. Real AWS resources cost money.
2. **Never run `aws` CLI commands that create, modify, or delete resources** without explicit approval. Read-only commands (`describe`, `list`, `get`) are fine.
3. **Never commit secrets.** No AWS keys, passwords, or tokens in code, Terraform, workflows, or `.env` files. Use `.env.example` with placeholders; keep `.env` in `.gitignore`.
4. **Never push to `main`** or force-push. Work on `feature/*` branches.
5. Flag anything that adds recurring AWS cost (NAT gateway, RDS size, extra ALBs, Multi-AZ) before adding it.

## Conventions

### Docker
- Multi-stage builds; small base images (slim/alpine/distroless where practical).
- Run as a **non-root user**.
- Pin base image versions (no bare `latest`).
- Include a `HEALTHCHECK` or a `/health` endpoint the ALB can use.
- Add a `.dockerignore` for every service.

### Image tagging
- Tag images with the **Git commit SHA** (`taskops-backend:<sha>`). Never deploy `latest`.
- The **same image** is promoted dev → prod; do not rebuild for prod.

### Configuration
- All config comes from environment variables (`APP_ENV`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`).
- Locally `DATABASE_HOST=postgres` (Compose service name); in AWS it's the RDS endpoint.
- In AWS, secrets come from **Secrets Manager / SSM Parameter Store**, injected into ECS task definitions — not plain env vars in Terraform.

### Terraform
- **Remote state:** S3 backend with state locking (S3 native locking, `use_lockfile = true`). Never rely on local state for dev/prod.
- Always `fmt` and `validate` before proposing changes.
- Tag all resources: `Project=taskops`, `Environment=<env>`, `ManagedBy=terraform`.
- Security groups: allow only required ports and reference other security groups rather than wide CIDR ranges. DB accepts 5432 only from the backend SG.
- Backend services and RDS go in **private subnets**; only the ALB is public.
- IAM: least privilege. Separate ECS task execution role and task role.
- Every module has `variables.tf`, `outputs.tf`, `main.tf`, and a short `README.md`.

### GitHub Actions
- AWS auth uses **GitHub OIDC** (`aws-actions/configure-aws-credentials` with `role-to-assume`). **No long-lived AWS access keys** in secrets.
- Pin third-party actions to a version tag (or SHA).
- Set minimal `permissions:` per workflow.
- PR workflow: lint → test → build → scan. No AWS access, no deploy.
- `main` workflow: test → build → scan → push to ECR → deploy to dev → smoke test.
- Terraform plan/apply in CI only runs when `terraform/**` changes.
- Prod deploy is `workflow_dispatch` with a GitHub **environment** requiring manual approval, and takes an image SHA as input.
- Trivy should fail the build on CRITICAL (and ideally HIGH) findings.

### Deployments
- ECS rolling deployments with the **deployment circuit breaker + rollback** enabled.
- ALB health checks point to the service's `/health` endpoint.
- Wait for service stability in the pipeline before reporting success.

### Database
- Schema changes go through `node-pg-migrate` (`backend/migrations/`). Migrations are needed from the first deploy, not later.
- In AWS, migrations run as a one-off ECS task using the backend image.

### Scripts
- Bash scripts start with `set -euo pipefail` and print what they're doing.
- `destroy.sh` must ask for confirmation before tearing anything down.

## Cost awareness

- NAT gateways bill hourly even when idle — the biggest cost trap here. Consider a single NAT for dev, or document the tradeoff of alternatives.
- Smallest viable sizes: Fargate minimal CPU/memory, `desired_count = 1` in dev, smallest RDS class, single-AZ in dev.
- Remind the owner to `terraform destroy` dev when not actively working.

## Implementation phases

1. **Local app** — frontend, backend, Postgres, Dockerfiles, Compose. ← *current*
2. **CI** — GitHub Actions lint/test/build, Trivy scan.
3. **AWS infra** — Terraform remote state, VPC, ECR, ECS, ALB, RDS, IAM.
4. **Automated deploy** — OIDC, push to ECR, deploy to ECS, health checks, smoke tests.
5. **Observability** — CloudWatch logs, metrics, dashboard, alarms (unhealthy targets, CPU > 80%, 5xx spike, DB connections).
6. **Production readiness** — prod approval gate, rollback, docs, diagrams, troubleshooting guide.

Finish and verify each phase before starting the next. Update "Current status" when a phase is done.

## How to work in this repo

- Prefer small, reviewable changes; one concern per change.
- After writing code, run the relevant lint/test/validate command and report the result.
- When adding a new tool or AWS resource, add a short note in the matching `docs/*.md` file.
- If something in the README plan looks wrong or risky, say so and suggest an alternative instead of silently following it.
