# home-ops
Homelab Infrastructure-as-Code for a single TrueNAS Scale host: Portainer Docker
stacks, Cloudflare DNS/Zero Trust, Tailscale — managed with Pulumi (TypeScript)
and Ansible.
Sensitivity: private

## Commands
- Toolchain is mise-managed (node 24, pulumi 3, ansible 9): run `mise install` first.
- mise monorepo: run subproject tasks from root as `mise run //management/<project>:<task>`.
- Verify Pulumi changes: `mise run //management/portainer:preview` (same for cloudflare) — always preview before `up`.
- Lint: `mise run //management/truenas:lint` (ansible-lint) · `mise run //management/portainer:lint` (eslint)
- Ansible dry run: `mise run //management/truenas:dry-run`
- Deploy order: truenas first (creates datasets/users), then portainer/cloudflare `up`.

## Architecture
- `management/cloudflare/` — Pulumi TS: DNS, Zero Trust; `webfinger/` is a Deno service
- `management/portainer/` — Pulumi TS: Docker stacks on Portainer (conventions in `management/portainer/AGENTS.md`)
- `management/truenas/` — Ansible: users, groups, ZFS datasets
- `management/tailscale/` — click-ops docs, not IaC yet
- `.mise/pulumi.toml` — shared Pulumi tasks (lint/preview/up) each Pulumi subproject includes

## Conventions
- Conventional Commits with subproject scope: `feat(portainer): ...`
- Renovate pins digests; `# renovate:` annotations mark versions in env/compose files
- Secrets live in Pulumi ESC (env `homelab/*`) — never in-repo
- Prettier is configured per-subproject only (no root config) — format within the subproject

## Rules
- Pulumi/Ansible state is authoritative — never click-ops a resource that IaC manages
- `woodhouse-deploy-instructions.md` is a temporary manual runbook, not source of truth
- CI runs `pulumi preview` per touched stack on PRs (`.github/workflows/`); merge to main deploys

## OpenSpec
- Specs and changes live in `openspec/`
