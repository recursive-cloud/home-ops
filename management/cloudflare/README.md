# Cloudflare Management

This project contains Pulumi code and documentation for managing Cloudflare resources including DNS zones, Zero Trust tunnels, and WebFinger services (used by Tailscale and other services to establish domain ownership).

The goal of the project is to provide infrastructure-as-code management of Cloudflare services that integrate with the broader home-ops infrastructure, enabling secure external access through tunnels and proper DNS management for multiple domains.

## Usage

This project manages Cloudflare resources through infrastructure-as-code using Pulumi. Here's how to get started:

### Prerequisites

1. **Cloudflare Account** with API access
2. **Pulumi CLI** installed locally
3. **Node.js** and **npm** for dependencies
4. **mise** for managing tools and tasks

### Commands

- `mise run //management/cloudflare:select`: Select the Pulumi stack
- `mise run //management/cloudflare:preview`: Preview Pulumi changes
- `mise run //management/cloudflare:up`: Update Pulumi stack
- `mise run //management/cloudflare:lint`: Lint Pulumi TypeScript code
- `mise run //management/cloudflare:shell`: Open a sub-shell in the Pulumi project
- `mise run //management/cloudflare:exec <command>`: Execute an arbitrary command in the project context

### Configuration

Configure your Cloudflare account details:

```yaml
config:
  # Allows for getting account ID by name with valid credentials
  cloudflare:account-name: 'Your Account Name'
  cloudflare:zone-domain-names:
    - 'example.com'
    - 'another-domain.com'
```

Set your Cloudflare API token as a secret:

```bash
pulumi config set --secret cloudflare:api-token "your-cloudflare-api-token"
```

## Resource Groups

### DNS Zones

The project manages DNS zones for your domains, providing full DNS management through Cloudflare.

#### Configuration

Configure the domains you want to manage:

```yaml
config:
  cloudflare:zone-domain-names:
    - 'gunzy.xyz'
    - 'example.com'
```

#### Outputs

The project exports zone information:

```typescript
zones: {
  "example.com": {
    "zone-id": "zone-identifier",
    "name-servers": ["ns1.cloudflare.com", "ns2.cloudflare.com"]
  }
}
```

### Zero Trust Tunnels

Cloudflare Zero Trust tunnels provide secure access to internal services without exposing them directly to the internet. Setting up the tunnels here allows for secure connections to services like Portainer and future Kubernetes services.

#### Configuration

Define tunnels and their associated DNS records:

```yaml
config:
  cloudflare:tunnels:
    - name: 'external-temp'
      dns-records:
        - 'auth.gunzy.xyz'
        - 'service.example.com'
    - name: 'kubernetes'
      dns-records:
        - 'k8s-app1.gunzy.xyz'
        - 'k8s-app2.gunzy.xyz'
```

#### Features

- **Secure Tunnel Creation**: Creates Zero Trust tunnels with generated secrets
- **Automatic DNS Records**: Creates CNAME records pointing to tunnel endpoints
- **Proxied Traffic**: All traffic is proxied through Cloudflare for security
- **ESC Integration**: Generates Pulumi ESC environments with tunnel tokens

#### How It Works

1. **Tunnel Creation**: Creates a Zero Trust tunnel with a secure 32-byte secret
2. **DNS Record Generation**: For each specified DNS record:
   - Extracts domain and subdomain components
   - Finds the appropriate managed zone
   - Creates CNAME record pointing to `{tunnel-id}.cfargotunnel.com`
   - Enables Cloudflare proxy for security and performance
3. **Token Generation**: Creates tunnel connection tokens for `cloudflared` clients
4. **ESC Environment**: Stores tunnel tokens securely in Pulumi ESC environments

#### DNS Record Format

DNS records should be fully qualified domain names:

- `auth.gunzy.xyz` → Creates CNAME for `auth` in the `gunzy.xyz` zone
- `service.example.com` → Creates CNAME for `service` in the `example.com` zone

#### Tunnel Token Access

Tunnel tokens are stored in Pulumi ESC environments:

```yaml
# ESC Environment: homelab/cloudflare-tunnel-{name}
values:
  cloudflare-tunnel:
    { tunnel-name }:
      tunnel-token:
        fn::secret: 'base64-encoded-tunnel-token'
```

#### Outputs

The project exports tunnel information:

```typescript
tunnels: {
  "external-temp": {
    "tunnel-id": "tunnel-identifier",
    "esc-environment": "homelab/cloudflare-tunnel-external-temp"
  }
}
```

### WebFinger Services

WebFinger provides a way to discover information about users and resources using well-known endpoints, following RFC 7033.

#### Configuration

Define JSON Resource Descriptors (JRDs) for WebFinger responses:

```yaml
config:
  cloudflare:json-resource-descriptors:
    - subject: 'acct:rossco@gunzy.xyz'
      links:
        - rel: 'http://openid.net/specs/connect/1.0/issuer'
          href: 'https://auth.gunzy.xyz'
    - subject: 'acct:admin@example.com'
      links:
        - rel: 'http://openid.net/specs/connect/1.0/issuer'
          href: 'https://sso.example.com'
        - rel: 'self'
          href: 'https://profile.example.com/admin'
```

#### Features

- **RFC 7033 Compliance**: Full WebFinger specification implementation
- **Cloudflare Workers**: Serverless implementation for fast global response
- **Zone-based Organization**: One worker per DNS zone for efficient management
- **Secure Configuration**: Json Resource Descriptor data stored as worker secret bindings
- **Custom Domain Support**: Workers bound to primary domain names

#### How It Works

1. **Zone Grouping**: Resource descriptors are grouped by domain (extracted from subject)
2. **Worker Creation**: One Cloudflare Worker created per zone with:
   - Compiled JavaScript from the `webfinger/` project
   - Secret bindings for each JRD configuration
   - Custom domain binding to the zone's primary domain
3. **Route Configuration**: Workers respond to `/.well-known/webfinger` requests
4. **Response Generation**: Workers return appropriate JRD based on resource parameter

#### WebFinger Endpoint

Once deployed, WebFinger endpoints are available at:

```
https://your-domain/.well-known/webfinger?resource=acct:username@your-domain
```

Example response:

```json
{
  "subject": "acct:rossco@gunzy.xyz",
  "links": [
    {
      "rel": "http://openid.net/specs/connect/1.0/issuer",
      "href": "https://auth.gunzy.xyz"
    }
  ]
}
```

#### Use Cases

- **OpenID Connect Discovery**: Link accounts to identity providers
- **Profile Discovery**: Link to user profiles and social media
- **Service Discovery**: Advertise services associated with accounts
- **Federation**: Enable cross-domain identity and service discovery

## Reference

### Related Documentation

- [Cloudflare Zero Trust Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [WebFinger RFC 7033](https://datatracker.ietf.org/doc/html/rfc7033)
- [Pulumi ESC Environments](https://www.pulumi.com/docs/pulumi-cloud/esc/)

### Integration Points

- **Portainer Integration**: Tunnels provide secure access to Portainer-managed services
- **Kubernetes Integration**: Future tunnel configurations for K8s service exposure
- **Identity Integration**: WebFinger enables OpenID Connect discovery for authentication services
