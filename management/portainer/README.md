# Portainer Management

This project contains Pulumi code and docmentation for setting up services on Portainer running on TrueNAS Scale.

The goal of the project is to be able to drop in docker-compose files, make minor modifications for networking, storage, env vars and labels and have the system validate and wire everything up automatically from there. This relies on structured networking and provisioning of Traefik instances.

In the longer term this will just include a management plane and monitoring services after other services are migrated to Kubernetes.

## Usage

This project manages Docker services on Portainer through infrastructure-as-code using Pulumi. Here's how to get started:

### Prerequisites

1. **TrueNAS Scale** with Portainer installed
2. **UniFi Controller** access for DNS management
3. **mise** for managing tools and tasks

### Commands

- `mise run //management/portainer:select`: Select the Pulumi stack
- `mise run //management/portainer:preview`: Preview Pulumi changes
- `mise run //management/portainer:up`: Update Pulumi stack
- `mise run //management/portainer:lint`: Lint Pulumi TypeScript code
- `mise run //management/portainer:shell`: Open a sub-shell in the Pulumi project
- `mise run //management/portainer:exec <command>`: Execute an arbitrary command in the project context

## Setting up stacks

### Setting up storage for apps

A decision should be made if an app requires persistent storage. If so a dataset should be created on the ssdpool dataset in TrueNAS Scale. The dataset name should match the stack name in kebab-case where possible but will be mapped in the docker-compose file as needed.

A user with a separate UID/GID should be created in TrueNAS for each stack that requires persistent storage unless it is expect to share storage with other stacks. The user should also be added to the `apps` group to ensure it has permissions to get to its location in the directory tree. ACLs on the dataset should be set to allow read/write access for that user.

### Setting up networks

This project supports two types of Docker networks that can be configured through Pulumi config:

#### Bridge Networks

Bridge networks are used for container-to-container communication and can optionally bind to specific host IP addresses for port exposure.

**Configuration**:

```yaml
config:
  portainer:networks:
    - name: 'home'
      type: 'bridge'
      host-bind-ip: '192.168.20.10' # Optional: IP for port bindings
```

The IP address must exist on the TrueNAS host, typically as an alias on the `br0` interface or VLAN interface.

**Use Cases**:

- Internal communication between containers
- Port binding to specific host IPs
- Traefik proxy networks (always require `host-bind-ip`)

#### Macvlan Networks

Macvlan networks provide containers with direct access to the physical network, allowing them to receive IP addresses from the network's DHCP server or be assigned static IPs.

**Configuration**:

```yaml
config:
  portainer:networks:
    - name: 'home'
      type: 'macvlan'
      subnet: '192.168.20.0/24'
      gateway: '192.168.20.1'
      ip-range: '192.168.20.224/27' # Range for container IPs
      parent-interface: 'vlan20' # TrueNAS VLAN interface
```

**Prerequisites**:

- Create VLAN interface on TrueNAS host (e.g., `vlan20`)
- VLAN interface does not need an IP unless services are exposed on bridge networks

**Use Cases**:

- Direct network access for services
- Bypassing NAT for external access
- Services that need to appear as separate network devices

#### Network Naming Convention

Networks are automatically named with the format: `{name}-{type}` (e.g., `home-bridge`, `home-macvlan`). The name typically will match the VLAN or network purpose.

### Setting up traefik instances (one per VLAN)

Traefik instances provide reverse proxy and SSL termination for services. Each VLAN should have its own Traefik instance for proper network isolation.

#### Configuration

Configure Traefik ingresses in the main Pulumi config:

```yaml
config:
  portainer:traefik-ingresses:
    - network: 'home' # Network name (matches network config)
      macvlan-ip: '192.168.20.225' # Optional: Static IP on macvlan network

  portainer.traefik:hostname: 'homelab' # Used for Traefik dashboard domain
  portainer.traefik:base-domain: 'gunzy.xyz' # Base domain for services
  portainer.traefik:app-data-host-path: '/mnt/ssdpool/appdata' # Base path for Traefik data
  portainer.traefik:image-tag: 'v3.1' # Traefik Docker image tag
  portainer.traefik:image-name: 'public.ecr.aws/docker/library/traefik' # Optional: Custom image
```

#### Required Secrets

Traefik requires the following secrets to be configured:

```bash
# Cloudflare DNS API token for Let's Encrypt DNS challenge
pulumi config set --secret portainer.traefik:cloudflare-dns-api-token "your-token"

# Basic auth credentials for Traefik dashboard (htpasswd format)
pulumi config set --secret portainer.traefik:traefik-dashboard-credentials "admin:$2y$10$..."
```

#### Generated Resources

For each Traefik ingress, the system creates:

1. **Docker Compose Stack**: Named `traefik-{network}` (e.g., `traefik-home`)
2. **DNS Record**: Points to the Traefik instance IP
3. **Network Dependencies**: Requires both bridge and macvlan networks for the VLAN

#### Traefik Features

- **Automatic SSL**: Let's Encrypt certificates via Cloudflare DNS challenge
- **Docker Provider**: Automatically discovers services with Traefik labels
- **Dashboard**: Accessible at `traefik-{hostname}.{network}.{base-domain}`
- **Network Constraints**: Only manages services on the same bridge network

#### Domain Structure

Services get domains following this pattern:

- Traefik dashboard: `traefik-{hostname}.{network}.{base-domain}`
- Application services: `{service}.{base-domain}` (configured in service labels)

### Adding a docker compose file

Docker Compose files are stored in the `stacks/` directory and automatically processed by the Pulumi program.

#### File Naming Convention

Compose files must follow the naming pattern: `docker-compose.{stack-name}.yaml`

Examples:

- `docker-compose.media.yaml` → Stack name: `media`
- `docker-compose.netbox.yaml` → Stack name: `netbox`
- `docker-compose.pocket-id.yml` → Stack name: `pocket-id`

#### Stack Configuration

Add your stack name to the main config:

```yaml
config:
  portainer:stacks:
    - 'media'
    - 'netbox'
    - 'pocket-id'
```

#### Compose File Structure

##### Basic Service Example

```yaml
version: '3.9'
services:
  app:
    container_name: my-app
    image: 'nginx:latest'
    restart: unless-stopped
    environment:
      - TZ=Australia/Brisbane
      - DATABASE_URL=${SECRET__DATABASE_URL} # Secret from config
      - API_KEY=${GEN_PASS_32__API_KEY} # Generated password
    volumes:
      - /mnt/ssdpool/appdata/my-app:/config
    networks:
      home-bridge: # Connect to bridge network
      home-macvlan: # Connect to macvlan network
        ipv4_address: 192.168.20.226 # Static IP on macvlan

networks:
  home-bridge:
    external: true # Reference existing network
  home-macvlan:
    external: true
```

#### Traefik Integration

To expose services through Traefik, add appropriate labels:

```yaml
services:
  web-app:
    # ... other config ...
    labels:
      - 'traefik.enable=true'
      - 'traefik.docker.network=home-bridge' # Required: Traefik network
      - 'traefik.http.routers.web-app.rule=Host(`myapp.gunzy.xyz`)' # Domain routing
      - 'traefik.http.services.web-app.loadbalancer.server.port=8080' # Internal port
    networks:
      home-bridge: # Must be on same network as Traefik
```

#### Advanced Network Configuration

For services that need both internal and external access:

```yaml
services:
  plex:
    # ... other config ...
    networks:
      home-bridge: # For Traefik access
      home-macvlan: # For direct network access
        ipv4_address: 192.168.20.226
    labels:
      - 'traefik.enable=true'
      - 'traefik.docker.network=home-bridge' # Traefik uses bridge network
      - 'traefik.http.routers.plex.rule=Host(`plex.gunzy.xyz`)'
```

#### Automatic DNS Records from Traefik Labels

The system automatically creates DNS records based on traefik labels in your Docker Compose files.

When you configure Traefik routing labels, DNS CNAME records are automatically created pointing to the Traefik instance:

```yaml
services:
  web-app:
    labels:
      - 'traefik.enable=true'
      - 'traefik.docker.network=home-bridge'
      - 'traefik.http.routers.web-app.rule=Host(`myapp.gunzy.xyz`)'
    networks:
      home-bridge:
```

**Generated DNS Record**:

- **Type**: CNAME
- **Domain**: `myapp.gunzy.xyz` (extracted from Host rule)
- **Target**: `traefik-homelab.home.gunzy.xyz` (Traefik instance domain)
- **TTL**: 0 (default)

#### Automatic DNS Records from Custom Labels

The system also supports creating direct DNS records for services that need to bypass Traefik. This is done via custom labels on the compose stack (not requiring Pulumi config).

For services that need direct DNS records (bypassing Traefik), use custom labels with the format:

**Label Format**: `recursive-cloud.dns.{network-name}: {domain}`

**Macvlan Network Example**:

```yaml
services:
  plex:
    networks:
      home-macvlan:
        ipv4_address: 192.168.20.226
    labels:
      - 'recursive-cloud.dns.home-macvlan: plex-direct.gunzy.xyz'
```

**Generated DNS Record**:

- **Type**: A
- **Domain**: `plex-direct.gunzy.xyz`
- **Target**: `192.168.20.226` (static IP from macvlan)
- **TTL**: 0 (default)

**Bridge Network Example**:

```yaml
services:
  local-service:
    networks:
      home-bridge:
    labels:
      - 'recursive-cloud.dns.home-bridge: local.gunzy.xyz'
```

**Generated DNS Record**:

- **Type**: A
- **Domain**: `local.gunzy.xyz`
- **Target**: `192.168.20.10` (host-bind-ip from network config)
- **TTL**: 0 (default)

#### DNS Requirements and Validation

The system validates DNS record configurations:

1. **Network Validation**: The network referenced in the label must be defined in the Pulumi config
2. **Service Network Membership**: The service must be connected to the network referenced in the DNS label
3. **Macvlan Networks**: Require static IP addresses (`ipv4_address`) in the network configuration
4. **Bridge Networks**: Require `host-bind-ip` to be defined in the network configuration
5. **Traefik Networks**: Must have a corresponding Traefik ingress configured

#### Automatic Processing

The system automatically:

1. **Scans for environment variables** using patterns like `${VAR}` and `$VAR`
2. **Validates network references** against configured networks
3. **Creates DNS records** from Traefik labels
4. **Manages dependencies** between stacks and networks
5. **Applies configuration** from the stack-specific config namespace

#### Storage Guidelines

- Use `/mnt/ssdpool/appdata/{container-name}/` for application data
- Use `/mnt/pool/media/` for media files
- Create TrueNAS datasets with appropriate permissions
- Set up dedicated users/groups for each stack when needed

#### Best Practices

! Note: These may be enforced over time through validation

1. **Always specify container names** for consistency
2. **Use external networks** that are pre-created by Pulumi
3. **Set restart policies** to `unless-stopped`
4. **Include timezone** environment variables
5. **Use semantic versioning** for image tags (avoid `latest`)
6. **Document service dependencies** in comments
7. **Group related services** in the same compose file
8. **Follow security best practices** (no-new-privileges, etc.)

### Environment Variables in Compose Stacks

This project supports several types of environment variables that can be used in Docker Compose files. The system automatically detects and processes environment variables based on their naming patterns.

#### Variable Types

##### 1. Configuration Variables (Default)

Simple configuration values from Pulumi config.

**Format**: `VARIABLE_NAME`

**Example**:

```yaml
services:
  app:
    environment:
      - DATABASE_URL=${DB_URL}
```

**Configuration**: Set via Pulumi config with the stack namespace:

```bash
pulumi config set portainer.media:db-url "postgresql://localhost:5432/mydb"
```

Or in Pulumi.yaml:

```yaml
config:
  portainer.media:db-url: 'postgresql://localhost:5432/mydb'
```

##### 2. Secret Variables

Sensitive values stored as Pulumi secrets.

**Format**: `SECRET__VARIABLE_NAME`

**Example**:

```yaml
services:
  app:
    environment:
      - API_KEY=${SECRET__API_KEY}
      - DB_PASSWORD=${SECRET__DATABASE_PASSWORD}
```

**Configuration**: Set via Pulumi config as secrets with the stack namespace:

```bash
pulumi config set --secret portainer.media:api-key "your-secret-api-key"
pulumi config set --secret portainer.media:database-password "your-secret-password"
```

Or in Pulumi.stack.yaml:

```yaml
config:
  portainer.media:api-key:
    secure: your-encrypted-secret-here
  portainer.media:database-password:
    secure: your-encrypted-secret-here
```

**Pulumi ESC Configuration**: For environment-based secrets management:

```yaml
# environment.yaml
values:
  pulumiConfig:
    portainer.media:api-key:
      fn::secret: 'your-secret-api-key'
    portainer.media:database-password:
      fn::secret: 'your-secret-database-password'
```

##### 3. Generated Passwords

Automatically generated secure passwords with customizable character sets.

**Format**: `GEN_PASS_[LENGTH]_[CHARACTER_SET]__CONFIG_KEY`

- `LENGTH`: Password length (default: 24)
- `CHARACTER_SET`: Character types to include (default: SNLU)
  - `S`: Special characters
  - `N`: Numeric characters
  - `L`: Lowercase letters
  - `U`: Uppercase letters

**Examples**:

```yaml
services:
  database:
    environment:
      # 32-character password with all character types
      - POSTGRES_PASSWORD=${GEN_PASS_32_SNLU__POSTGRES_PASSWORD}
      # 16-character password with only letters and numbers
      - REDIS_PASSWORD=${GEN_PASS_16_NLU__REDIS_PASSWORD}
      # Default 24-character password with all character types
      - ADMIN_PASSWORD=${GEN_PASS__ADMIN_PASSWORD}
```

##### 4. Generated Base64 Bytes

Randomly generated bytes encoded as base64, useful for encryption keys.

**Format**: `GEN_BASE64_[LENGTH]__CONFIG_KEY`

- `LENGTH`: Number of bytes to generate (default: 32)

**Example**:

```yaml
services:
  app:
    environment:
      # 32-byte encryption key (44 characters in base64)
      - ENCRYPTION_KEY=${GEN_BASE64_32__ENCRYPTION_KEY}
      # 16-byte session key (24 characters in base64)
      - SESSION_KEY=${GEN_BASE64_16__SESSION_KEY}
```

##### 5. Built-in Environment Variables

The system provides several built-in environment variables that are automatically available to all stacks without configuration.

**Format**: `BUILTIN__VARIABLE_NAME`

**Available Built-ins**:

```yaml
services:
  app:
    environment:
      - TZ=${BUILTIN__TIMEZONE} # System timezone
      - BASE_DOMAIN=${BUILTIN__BASE_DOMAIN} # Base domain for services
      - HOSTNAME=${BUILTIN__MACHINE_HOSTNAME} # Machine hostname
      - DATA_DIR=${BUILTIN__APP_DATA_HOST_PATH} # Base path for app data
      - CONFIG_DIR=${BUILTIN__APP_CONFIG_DIR_PATH} # Config directory (when available)
```

**Built-in Variables**:

- `BUILTIN__TIMEZONE`: System timezone (from `portainer:timezone` config)
- `BUILTIN__BASE_DOMAIN`: Base domain for services (from `portainer:base-domain` config)
- `BUILTIN__MACHINE_HOSTNAME`: Machine hostname (from `portainer:machine-hostname` config)
- `BUILTIN__APP_DATA_HOST_PATH`: Base path for application data (from `portainer:app-data-host-path` config)
- `BUILTIN__APP_CONFIG_DIR_PATH`: Path to uploaded config directory (only available when stack has config directory)
- `BUILTIN__APP_CONFIG_PORTAINER_DIR_PATH`: Path to config directory inside Portainer containers (for env_file references)

**Configuration**: Set the underlying values in the main Pulumi config:

```yaml
config:
  portainer:timezone: 'Australia/Brisbane'
  portainer:base-domain: 'gunzy.xyz'
  portainer:machine-hostname: 'truenas'
  portainer:app-data-host-path: '/mnt/ssdpool/appdata'
```

#### Configuration Directory Upload

For stacks that require configuration files, the system can automatically upload a configuration directory to the remote host.

##### Setup

1. **Create config directory**: Create a directory matching your stack name in the `stacks/` directory:

   ```
   stacks/
   ├── docker-compose.netbox.yaml
   └── netbox/
       ├── config/
       │   ├── configuration.py
       │   ├── extra.py
       │   ├── plugins.py
       │   └── ldap/
       │       ├── ldap_config.py
       │       └── extra.py
       └── env/
           ├── netbox.env
           ├── postgres.env
           ├── redis.env
           └── redis-cache.env
   ```

2. **Reference in compose file**: Use the built-in environment variables for paths:

   ```yaml
   services:
     netbox:
       # Use host path for volume mounts
       volumes:
         - ${BUILTIN__APP_CONFIG_DIR_PATH}/config:/etc/netbox/config:z,ro
         - ${BUILTIN__APP_DATA_HOST_PATH}/netbox/media:/opt/netbox/netbox/media:rw
       # Use Portainer path for env_file references
       env_file: ${BUILTIN__APP_CONFIG_PORTAINER_DIR_PATH}/env/netbox.env
   ```

3. **Configure upload settings**: Add required config for SSH upload:

   ```yaml
   config:
     portainer:portainer-hostname: 'truenas.local' # SSH target hostname
     portainer:config-uploader-host-path: '/mnt/ssdpool/appdata/app-config' # Host filesystem path
     portainer:config-uploader-mount-path: '/app-config' # Path inside containers
     portainer:config-uploader-portainer-mount-path: '/app-config' # Portainer mount path
     portainer:config-uploader-group-id: 3002 # Group ID for file permissions
     portainer:config-upload-ssh-port: 2222 # SSH port
     portainer:config-upload-ssh-username: 'portainer' # SSH username
   ```

   ```bash
   # SSH private key for uploading config files
   pulumi config set --secret portainer:config-upload-ssh-key "$(cat ~/.ssh/id_rsa)"
   ```

##### How It Works

1. **Detection**: System automatically detects if a `stacks/{stack-name}/` directory exists
2. **Upload**: Before stack deployment, the directory is uploaded via SSH to the remote host
3. **Permissions**: All services in the stack get the upload group ID added to `group_add` for file access
4. **Path Variables**: Two built-in variables provide different path perspectives:
   - `BUILTIN__APP_CONFIG_DIR_PATH`: Host filesystem path for volume mounts
   - `BUILTIN__APP_CONFIG_PORTAINER_DIR_PATH`: Container path for env_file references
5. **Cleanup**: Directory is removed if the stack is deleted

##### Use Cases

- Application configuration files (NetBox, Grafana, etc.)
- Environment files for complex multi-service stacks
- Allows for matching more closely with upstream docker-compose setups that expect you deploy from their repository
- Static website content
- Custom scripts and initialization files

##### Best Practices

- Use read-only mounts (`:ro`) when possible for security
- Separate environment files by service for clarity
- Set appropriate file permissions in your config directory
- Keep sensitive files out of the config directory (use secrets instead)
- Use the `z` SELinux label for proper container access on RHEL-based systems
- Use `BUILTIN__APP_CONFIG_PORTAINER_DIR_PATH` for `env_file` references
- Use `BUILTIN__APP_CONFIG_DIR_PATH` for volume mounts

#### How It Works

1. The system scans your Docker Compose files for environment variables using patterns like `${VAR}` and `$VAR`
2. Variables are categorized based on their naming prefix
3. For generated variables, the system creates Pulumi resources to generate and manage the values
4. All variables are made available to the Docker Compose stack at deployment time

#### Best Practices

- Use `SECRET__` prefix for any sensitive data like passwords, API keys, or tokens
- Use generated passwords (`GEN_PASS_`) for database passwords and other secure credentials
- Use generated base64 bytes (`GEN_BASE64_`) for encryption keys and session secrets
- Keep configuration keys in kebab-case for consistency
- Document any custom environment variables in your compose file comments

## Reference

### Importing DNS records from Unifi

If there is a DNS record that is already created in Unifi, you can import it into Pulumi to manage it going forward.

```
pulumi import unifi:index/dnsRecord:DnsRecord dns-record-home-traefik default:686134bfb39e5c0b6d865b8a --provider 'urn:pulumi:mgmt::portainer::pulumi:providers:unifi::default'
```

The format is: `<site>:<dns-record-id>`. The id can be found via the unifi controller UI. Open dev tools, manage the DNS records and pause the record.
