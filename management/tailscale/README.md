# Tailscale Management

This directory is intended to contain Pulumi code and documentation for managing Tailscale resources as part of the home-ops infrastructure.

To begin with I will be managing Tailscale configuration via click-ops in the Tailscale admin console, but eventually I plan to manage Tailscale ACLs, DNS settings, and other configurations via Pulumi as code.

## Configuration

### Authentication

The Tailnet is authenticated via Custom OIDC using [pocket-id](https://pocket-id.com).

### Tailscale Policy File

The Tailscale policy file in the web console is formatted using the JWCC (JSON with Comments) format with two additional things over the standard. See [hujson](https://github.com/tailscale/hujson) for more details.

My current policy file is stored in [policy.hujson](policy.hujson). Policy syntax details can be found in the [Tailscale documentation](https://tailscale.com/kb/1337/policy-syntax).

In order to render the Tailscale policy file correctly in VSCode, an [association](https://github.com/tailscale/hujson?tab=readme-ov-file#visual-studio-code-association) needs to be made in the settings.json file:

```json
"files.associations": {
    "*.hujson": "jsonc"
},
"json.schemas": [{
    "fileMatch": ["*.hujson"],
    "schema": {
        "allowTrailingCommas": true
    }
}]
```

### Device Approval

Device approval is required for new devices joining the Tailnet. The only exception is for devices that are joining with a pre-approved tag and auto-approval settings for subnet routers and exit nodes.

### DNS Settings

When on the Tailnet, devices will use the Unifi UCG Max as the primary DNS server for `*.gunzy.xyz`. This ensures that internal services are resolve correctly when on the Tailnet.
