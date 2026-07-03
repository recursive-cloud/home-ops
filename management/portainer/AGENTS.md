# Portainer Management Agent Guide

## Project Overview

Infrastructure-as-code management for Docker services on Portainer running on TrueNAS Scale. Uses Pulumi to manage Docker Compose stacks, networks, Traefik proxies, and DNS records via UniFi Controller.

**Goal**: Drop in docker-compose files, make minor modifications for networking/storage/env vars, and have the system validate and wire everything up automatically.

## Prerequisites

- TrueNAS Scale with Portainer installed
- UniFi Controller access for DNS management
- `mise` for managing tools and tasks

## Key Commands

Run these via `mise run //management/portainer:<command>`

- `select`: Select the Pulumi stack
- `preview`: Preview Pulumi changes
- `up`: Update Pulumi stack
- `lint`: Lint Pulumi TypeScript code
- `shell`: Open a sub-shell in the Pulumi project
- `exec <command>`: Execute arbitrary command in project context

## Project Structure

```
stacks/
├── docker-compose.{stack-name}.yaml    # Docker Compose files
└── {stack-name}/                      # Optional config directory for stacks
Pulumi.yaml                            # Main Pulumi config
```

## Configuration (Pulumi.yaml)

### Networks

- **Bridge**: Container-to-container communication, optional host IP binding
- **Macvlan**: Direct network access with IPv4/IPv6 support

```yaml
config:
  portainer:networks:
    - name: 'home'
      type: 'bridge'|'macvlan'
      # Bridge: optional host-bind-ip
      # Macvlan: ipv4/ipv6 subnets, gateways, parent-interface
```

### Traefik Ingresses

One per VLAN for reverse proxy and SSL termination.

```yaml
config:
  portainer:traefik-ingresses:
    - network: 'home'
      macvlan-ip: '192.168.20.225' # Optional static IP
  portainer.traefik:hostname: 'homelab'
  portainer.traefik:base-domain: 'gunzy.xyz'
  portainer.traefik:app-data-host-path: '/mnt/ssdpool/appdata'
  # Secrets: cloudflare-dns-api-token, traefik-dashboard-credentials
```

### Stacks

List of active stacks to deploy:

```yaml
config:
  portainer:stacks:
    - 'media'
    - 'netbox'
```

## Adding Stacks

1. **Create compose file**: `stacks/docker-compose.{stack-name}.yaml`
2. **Add to config**: Include stack name in `portainer:stacks` list
3. **Configure networks**: Use `external: true` for pre-created networks
4. **Set environment variables**: Use supported patterns (see below)
5. **Add Traefik labels** (optional): For reverse proxy access

### Compose File Naming

- `docker-compose.media.yaml` → Stack: `media`
- Must specify `version: '3.9'` and `container_name`

### Network Connection

```yaml
networks:
  home-bridge:
    external: true
  home-macvlan:
    external: true
```

### Traefik Labels

```yaml
labels:
  - 'traefik.enable=true'
  - 'traefik.docker.network=home-bridge'
  - 'traefik.http.routers.app.rule=Host(`app.gunzy.xyz`)'
  - 'traefik.http.services.app.loadbalancer.server.port=8080'
```

## Environment Variables

### Types

1. **Config**: `${VAR_NAME}` - From Pulumi config `portainer.{stack}:{var}`
2. **Secrets**: `${SECRET__VAR_NAME}` - Encrypted via `pulumi config set --secret`
3. **Generated Passwords**: `${GEN_PASS_[LENGTH]_[CHARS]__KEY}` - Auto-generated secure passwords. LENGTH optional (default 24), CHARS optional (default SNLU where S=special chars, N=numbers, L=lowercase, U=uppercase). Use for internal service passwords.
4. **Base64 Bytes**: `${GEN_BASE64_[LENGTH]__KEY}` - Random bytes as base64. LENGTH optional (default 32). Use for internal secrets like keys.
5. **Built-ins**: `${BUILTIN__VAR_NAME}` - System-provided values

### Secret Management

- **SECRET\_\_ variables**: Must be configured in Pulumi ESC (Environment Secrets Configuration) for secure storage. Use for externally known secrets like admin passwords or OIDC credentials.
- **After adding SECRET\_\_ variables**: Communicate to the user that they need to set these secrets in Pulumi ESC
- **OIDC Authentication**: If configuring OIDC auth, communicate to the user that they need to set client ID and secret (or well-known endpoint for public clients) as secrets in ESC
- **Generated passwords and base64**: Automatically generated and do not need manual setup in ESC.

### Built-in Variables

- `BUILTIN__TIMEZONE`: System timezone
- `BUILTIN__BASE_DOMAIN`: Base domain for services
- `BUILTIN__MACHINE_HOSTNAME`: Machine hostname
- `BUILTIN__APP_DATA_HOST_PATH`: Base app data path (use to replace known host paths in volume mounts)
- `BUILTIN__APP_CONFIG_DIR_PATH`: Host path to config directory (use to replace known host paths in volume mounts)
- `BUILTIN__APP_CONFIG_PORTAINER_DIR_PATH`: Container path to config directory

### Config Directory Upload

Create `stacks/{stack-name}/` directory for config files. Automatically uploaded via SSH before deployment.

## DNS Records

### Automatic from Traefik Labels

CNAME records created automatically from `Host(`domain`)` rules, pointing to Traefik instance.

### Direct DNS Labels

For bypassing Traefik: `recursive-cloud.dns.{network-name}: {domain}`

Creates A/AAAA records based on network type:

- **Macvlan**: A + AAAA records using static IPv4 (IPv6 auto-generated via EUI-64)
- **Bridge**: A record using host-bind-ip

## Storage Guidelines

- App data: `/mnt/ssdpool/appdata/{container-name}/`
- Bulk storage: `/mnt/pool/{dataset-name}/`
- Datasets, users, and groups are declared in the sibling `management/truenas` Ansible project (see [TrueNAS Provisioning](#truenas-provisioning) below). Do **not** ask the user to create them manually — instead, edit the ansible vars files and instruct the user to run the playbook.
- Dedicated users/groups per stack when a non-root container process needs to own its data.

## TrueNAS Provisioning

The `management/truenas` Ansible project owns declarative provisioning of TrueNAS users, groups, and ZFS datasets used by Portainer stacks. Any stack that needs a non-root user, a group, or an appdata/bulk dataset should be added here.

### Files

- `../truenas/vars/users.yml` — list of `{name, fullname?, uid, gid}` entries. Each entry creates a matching group (gid) and user (uid).
- `../truenas/vars/datasets.yml` — list of `{name, pool, parent?, owner_uid, owner_gid}` entries. Each entry creates a ZFS dataset and applies an NFS4 ACL that grants FULL_CONTROL to the owner and MODIFY to the owning group (with inherit flags), so non-root container processes running as that uid/gid can read and write.

### UID / GID allocation

To avoid collisions, use the next unused IDs following the existing pattern:

- App UIDs are allocated in the `1000-1999` range (e.g. `media=1000`, `netbox=1001`, `pocket-id=1002`, `hass=1003`, `gatus=1004`, `beszel=1005`, `grocy=1006` ...).
- App GIDs are allocated in the `3000-3999` range and are typically stack-specific (e.g. `3001`, `3003`, `3004`, `3005`, `3007`, `3008`, `3009` ...). GID `3002` is reserved for the `pulumi` service user used by the config uploader.
- Service-default IDs (e.g. `mosquitto=1883:1883`, `seafile=8000:8000`) may be used when the upstream image expects a specific UID/GID.
- Always check the current highest UID and GID in `../truenas/vars/users.yml` before assigning new ones.

### Adding a new user/group/dataset

1. **Append the user/group** to `../truenas/vars/users.yml`:
   ```yaml
     - name: <stack-name>
       fullname: <optional descriptive name>
       uid: <next unused uid>
       gid: <next unused gid>
   ```
2. **Append the dataset** to `../truenas/vars/datasets.yml`:
   ```yaml
     - name: <stack-name>
       pool: ssdpool          # or `pool` for bulk storage
       parent: appdata        # omit for a top-level dataset on the pool
       owner_uid: <matching uid>
       owner_gid: <matching gid>
   ```
3. **Reference the user/group in the compose file** via `user: "<uid>:<gid>"` or `PUID`/`PGID` env vars (linuxserver.io images), and mount the dataset with `$BUILTIN__APP_DATA_HOST_PATH/<stack-name>:/...`.
4. **Instruct the user to run**: `mise run //management/truenas:playbook` before the next `up`. This is idempotent — existing entries are skipped, only new ones are provisioned.

### Notes

- Bulk-storage datasets under `/mnt/pool/*` follow the same pattern with `pool: pool` (no `parent`).
- Datasets that need custom TrueNAS-side configuration (e.g. shares, snapshot settings) should still be declared here for ownership, but any additional setup is out of scope for this playbook and should be flagged to the user.
- The ansible playbook applies ACLs only when the dataset is newly created (`when: truenas_dataset_result.changed`). If ownership needs to change on an existing dataset, delete and recreate it, or apply the ACL manually.

## Best Practices

- Always specify `container_name`
- Use `external: true` for networks
- Set `restart: unless-stopped`
- Include `TZ` environment variable
- Use semantic versioning for image tags
- Document service dependencies
- Group related services in same compose file
- Follow security practices (no-new-privileges, etc.)

## Deployment Flow

1. If a new stack needs a non-root user/group or a new dataset, edit `../truenas/vars/users.yml` and/or `../truenas/vars/datasets.yml` and instruct the user to run `mise run //management/truenas:playbook` first
2. Run `mise run //management/portainer:preview` to validate changes
3. Run `mise run //management/portainer:up` to deploy
4. System auto-creates networks, Traefik instances, DNS records
5. Config directories uploaded via SSH if present
6. Environment variables processed and injected
