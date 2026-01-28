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
- Communicate to the user that they must create TrueNAS datasets with appropriate permissions
- Dedicated users/groups per stack when needed

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

1. Run `mise run //management/portainer:preview` to validate changes
2. Run `mise run //management/portainer:up` to deploy
3. System auto-creates networks, Traefik instances, DNS records
4. Config directories uploaded via SSH if present
5. Environment variables processed and injected
