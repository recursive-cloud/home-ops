---
name: portainer-stack
description: Add or modify a Portainer Docker stack in management/portainer — env-var patterns, builtins, compose conventions, TrueNAS provisioning, and the deploy flow. Use when creating or editing stacks/docker-compose.*.yaml, stacks/<name>/ config dirs, or the ../truenas vars a stack needs.
---

# Portainer stack reference

Verified against `src/envVars.ts`, `src/dns.ts`, `src/Stack.ts`, `index.ts`, and `../truenas` vars/playbook.

## Env vars in compose files (`src/envVars.ts`)
- `${VAR}` ← Pulumi config `portainer.{stack}:{var}` (case-insensitive, `_` → `-`)
- `${SECRET__VAR}` ← secret config — must be set in Pulumi ESC (`homelab/<stack>`); tell the user to set it (incl. OIDC client id/secret or well-known endpoint for public clients)
- `${GEN_PASS_[LENGTH]_[CHARS]__KEY}` ← generated password (LENGTH default 24, CHARS default `SNLU` = special/number/lower/upper) — internal service passwords, no ESC setup
- `${GEN_BASE64_[LENGTH]__KEY}` ← random base64 bytes (LENGTH default 32) — internal keys, no ESC setup
- `${BUILTIN__VAR}` ← builtins below

## Builtin variables (`src/envVars.ts:6`)
- Core (always): `BUILTIN__TIMEZONE`, `BUILTIN__BASE_DOMAIN`, `BUILTIN__MACHINE_HOSTNAME`, `BUILTIN__APP_DATA_HOST_PATH`
- Only when `stacks/{stack}/` config dir exists: `BUILTIN__APP_CONFIG_DIR_PATH` (host), `BUILTIN__APP_CONFIG_PORTAINER_DIR_PATH` (container) — use to replace known host paths in volume mounts

## Compose conventions (convention, not enforced)
- `stacks/docker-compose.{stack}.yaml` → stack `{stack}`; optional config dir `stacks/{stack}/` is auto-uploaded via SSH before deployment
- Always set `container_name`; `version:` not required; networks `external: true`; `restart: unless-stopped`; include `TZ`; no-new-privileges where possible

## Stack registration
- Add the stack name to `portainer:stacks` in `Pulumi.main.yaml` (per-stack config; `Pulumi.yaml` holds only globals)
- DNS: CNAMEs auto-created from Traefik `Host()` labels; direct records via label `recursive-cloud.dns.{network}: {domain}` (macvlan: A + AAAA, IPv6 via EUI-64; bridge: A via host-bind-ip) — written to the UniFi Controller

## TrueNAS provisioning (`../truenas`)
Stacks needing a non-root user, group, or datasets declare them in Ansible — do not ask the user to create anything manually:
- `../truenas/vars/users.yml` — `{name, fullname?, uid, gid}` (creates matching group + user)
- `../truenas/vars/datasets.yml` — `{name, pool, parent?}` (`ssdpool`/`appdata` for app data; `pool`, no parent, for bulk); ACL (owner FULL_CONTROL, group MODIFY, inherit) applies **only on creation** — ownership changes need delete + recreate or a manual ACL
- Reference in compose via `user: "<uid>:<gid>"` or `PUID`/`PGID` (linuxserver.io images); mount appdata as `${BUILTIN__APP_DATA_HOST_PATH}/<stack>`
- Datasets needing extra TrueNAS setup (shares, snapshots): declare for ownership, flag the rest to the user
- Instruct the user to run `mise run //management/truenas:playbook` (idempotent) before the next `up`

## Deploy flow
1. truenas playbook first if vars changed
2. `mise run //management/portainer:preview` to validate
3. `mise run //management/portainer:up` — networks, Traefik ingresses, DNS records, config-dir upload, and env injection are all handled
