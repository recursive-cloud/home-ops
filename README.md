<div align="center">

<img src="https://avatars.githubusercontent.com/u/202722099" align="center" width="144px" height="144px"/>

### Home Ops

Bringing my Cloud Ops skills to self-hosting at home.

</div>

## Overview

Welcome to my home infrastructure repository. It is currently the starting point of my next adventure into self-hosting, homelab and home automation. After moving houses, my lab was dismantled so what better time to start fresh and document the journey.

Where possible I will be embracing Infrastructure as Code (IaC) and GitOps principles to manage my home infrastructure. This will include using tools such as [Flux](https://github.com/fluxcd/flux2), [Pulumi](https://github.com/pulumi/pulumi), [Ansible](https://github.com/ansible/ansible), [Renovate](https://github.com/renovatebot/renovate), and [GitHub Actions](https://github.com/features/actions).

## Architecture

While most of the home operations repos will focus primarily on Kubernetes, you need to start somewhere and having a solid management plane is key.

Diagram coming soon...

## Plans

- Run Portainer BE on TrueNAS Scale for management services
  - Management only [pocket-id](https://github.com/pocket-id/pocket-id) for OIDC authentication
  - [tailscale](https://github.com/tailscale/tailscale) (management network subnet router)
  - [netbox](https://github.com/netbox-community/netbox) for documenting network and IPAM to IaC
  - [dnsmasq](https://thekelleys.org.uk/dnsmasq/doc.html) as proxy DHCP server for PXE booting
  - [matchbox](https://github.com/poseidon/matchbox) for easier iPXE provisioning
  - [Sidero Omni](https://github.com/siderolabs/omni) for Talos cluster creation and management
  - [Gatus](https://github.com/TwinProduction/gatus) to monitor management plane and Kubernetes control planes later (keep it simple initially)
- On Portainer, deploy small number of services critical for other uses at home (migrate to Kubernetes later)
  - Main [pocket-id](https://github.com/pocket-id/pocket-id) for OIDC authentication
  - [cloudflared](https://github.com/cloudflare/cloudflared) to expose main pocket-id for Tailnet OIDC
  - [tailscale](https://github.com/tailscale/tailscale) (home network subnet router)
  - [tiny-auth](https://github.com/philips-labs/tiny-auth) to protect services that do not support OIDC
  - [home-assistant](https://github.com/home-assistant/core)
  - [code-server](https://github.com/coder/code-server)
  - [seafile](https://github.com/haiwen/seafile)
- Manage network resources with Pulumi
  - [unifi](https://ui.com/) network (UCG Max)
  - [tailscale](https://github.com/tailscale/tailscale) ACLs etc
  - Cloudflare tunnels (maybe)
- Install [incus-os](https://github.com/lxc/incus-os) on Dell Optiplex 7040 SFF for staging environment
  - Testing PXE booting
  - Testing Talos cluster formation
  - Testing kubernetes changes via Flux
  - WoL and power down when not needed
- Production Kubernetes cluster
  - Mix of Intel NUCs, Raspberry Pi 4s and other physical hosts and VMs
  - [Talos Linux](https://github.com/siderolabs/talos) deployed via PXE booting using [Sidero Omni](https://github.com/siderolabs/omni) and [matchbox](https://github.com/poseidon/matchbox)
  - GitOps management via [flux](https://github.com/fluxcd/flux2)
  - [cilium](https://github.com/cilium/cilium) and [multus](https://github.com/k8snetworkplumbingwg/multus-cni) for CNI and load balancing
  - [tailscale](https://github.com/tailscale/tailscale) operator for cluster access
  - [traefik](https://github.com/traefik/traefik) for ingress
  - [cert-manager](https://github.com/cert-manager/cert-manager) for TLS certificates
  - [external-dns](https://github.com/kubernetes-sigs/external-dns) for DNS management
  - [external-secrets](https://github.com/external-secrets/external-secrets) for secrets
  - [topolvm](https://github.com/topolvm/topolvm) for local storage
  - [rook](https://github.com/rook/rook) for volumes and S3 compatible object storage
  - [democratic-csi](https://github.com/democratic-csi/democratic-csi) for bulk storage on the NAS (NFS)
  - [grafana](https://github.com/grafana) stack (Mimir, Loki, Alloy) for monitoring and logging, VictoriaMetrics/Logs will also be assessed
  - [spegel](https://github.com/spegel-org/spegel) for image cache
  - All the applications (including those above marked for later migration)
- Experiments
  - OCI flux source
  - CDK8s to build sources to put in an OCI

## Hardware

TBC

## Cloud Services

TBC

## DNS

TBC
