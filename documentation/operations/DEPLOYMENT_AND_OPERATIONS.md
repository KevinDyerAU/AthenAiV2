# AthenAI Deployment and Operations

**Note**: This file contains deprecated Kubernetes/Terraform deployment information. AthenAI now uses Docker Compose for deployment.

## Current Deployment Methods

For current AthenAI deployment, see the main [README.md](../../README.md) which includes:

### Docker Deployment
```bash
# Full stack with ML service
docker-compose -f docker-compose.cloud.yml up -d

# Simplified stack without ML
docker-compose -f docker-compose.simplified.yml up -d
```

### Development Setup
```bash
# Local development
npm install
cp .env.simplified.example .env
# Configure your API keys
npm run dev
```

## Database Setup
- Supabase: Run SQL files in `db/supabase/` directory
- Neo4j: Run Cypher files in `db/neo4j/` directory

For complete setup instructions, refer to the main README.md file.

## Configuration
- K8s ConfigMap: `infrastructure/k8s/base/configmap.yaml`
- Environment examples: `.env*.example`
- Security/sandbox settings in security overrides and K8s securityContext.

## Validation
- Script: `scripts/deploy/validate.sh`
- Verifies namespace, deployment availability, service, HPA, then port-forwards and checks:
  - `/health` endpoint
  - Basic perf probe (20 requests, avg latency)
  - `/metrics` sample

## Monitoring & Observability
- Prometheus Operator integration: `infrastructure/k8s/addons/monitoring/`
- ServiceMonitor for api-service.
- Grafana dashboards (extend under `infrastructure/monitoring/grafana/`).

## Runbooks
- Deployment rollout:
  1) `kubectl apply -k <overlay>`
  2) `kubectl -n <ns> rollout status deploy/api-service`
  3) `bash scripts/deploy/validate.sh <ns> api-service 18080`
- Rollback (manual):
  - `kubectl -n <ns> rollout undo deploy/api-service`
- Scaling:
  - Update HPA: `infrastructure/k8s/base/hpa.yaml` or overlay patches.
- Config changes:
  - Edit ConfigMap and apply, trigger restart if necessary: `kubectl -n <ns> rollout restart deploy/api-service`
- Incident response:
  - Collect diagnostics: `kubectl -n <ns> get all`, `describe`, `logs`.
  - Check health endpoints and metrics.

## Troubleshooting
- Pods CrashLoopBackOff: `kubectl -n <ns> logs deploy/api-service -p`
- Readiness probe failing: check `/health` locally via port-forward.
- Image pull errors: verify registry auth and tags.
- RBAC/ABAC denials: review `infrastructure/security/rbac/policies.yaml` and `api/security/policy.py`.

## Optimization
- Tune HPA targets (CPU/memory) in `hpa.yaml`.
- Resource requests/limits in `api-deployment.yaml` and agent deployments.

## Security
- Apply least-privilege RBAC and sandbox contexts.
- Manage secrets with K8s Secrets/External secrets manager.

## Appendices
- Reference planning docs under `documentation/planning/SMAI/` for architectural rationale.
