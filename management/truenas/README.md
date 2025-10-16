# TrueNAS Management

This directory is intended to contain documentation for setup of Truenas Scale as a NAS for bulk storage but also setup of portainer as a starting point for running initial docker workloads and the management plane for the rest of the lab. Workloads on Portainer will be deployed using Pulumi (via its any Terrform provider capability).

In the future some of the setup of the TrueNAS server may be automated via Ansible (or similar) using the TrueNAS API.

## TrueNAS Setup

I originally had TrueNAS Scale running as a Proxmox VM and had planned to move to bare metal but did not find the time. At one point the drive I was running Proxmox on started to have issues and while I had a config backup I decided to go with a fresh install and import the pools and reconfigure from scratch.

### Hardware

TBC - will update with exact details later.

Host is custom build with 8 hot-swappable bays, 2 internal bays, 32GB ECC RAM, Intel Xeon E-2224G CPU.

### Initial Setup

Boot pool was set up on 2x 128GB SATA SSD drives in mirror.

I then imported existing pools:

- pool - main storage pool with 4x 4TB WD Red drives in striped mirror, plus 1x 4TB WD Red drive as hot spare
- ssdpool - pool for application data with 2x 128GB SATA SSD drives in mirror, 1x drive installed but not added as a spare

I then proceeded to set up the following:

- Automatic scrubs on both pools, early morning on a Tuesday with at least 26 days between scrubs.
- Snapshots - daily, set up for key folders on main pool, not much data has changed on these. Will add more later.
- Backups - key folder on main pool backed up to external USB drive and S3 weekly. Will reassess later as the server gets more active.
- TLS - when I set up TrueNAS the ACME function was broken so I used lego to issue a certificate via Cloudflare DNS challenge and imported the certificate. This is now fixed and I have set up a CSR and automated renewal in the TrueNAS UI.
- Set up a personal user account with sudo privileges for day to day use rather than using truenas_admin.
- Notifications
  - Slack notifications (personal workspace) - INFO level
  - Email notifications (via a Google Account) - WARNING level
- Session timeout - set to 15 minutes of inactivity.

## Portainer Setup

Portainer is set up as a TrueNAS custom app a docker-compose file (see `docker-compose.tmpl.yaml`). The docker-compose file consists of:

- portainer-ee - Portainer Business Edition container
- acme.sh - to issue and renew TLS certificates for Portainer
- openssh-server - running in non-privileged mode, to allow upload of config files for apps in Portainer stacks without needing to use SSH on the TrueNAS host directly.
- watchtower - to update containers in this stack automatically. Will be replaced later with a better solution.

The initial setup are as follows:

- Set up Alias IP for Portainer on management VLAN (same interface as TrueNAS)
  - Allows Portainer to run on port 80 and 443 without conflicting with TrueNAS web interface
- Setup datasets on ssdpool for:
  - acme.sh
  - portainer
  - openssh-server
- Start acme-sh on its own in daemon mode (remove other apps from docker-compose and add app via YAML in TrueNAS)
- Set default server to letsencrypt `docker exec acme.sh --set-default-ca  --server letsencrypt`
- Issue certificate for Portainer using Cloudflare DNS:
  - `docker exec acme.sh --issue --dns dns_cf -d portainer.gunzy.xyz --renew-hook 'curl --silent --unix-socket /var/run/docker.sock -X POST http://localhost/containers/portainer/restart'`
  - This commands issues the certificate and sets up a renew hook to restart the Portainer container after renewal.
- Deploy the full docker-compose to start Portainer with the issued certificate.
- Begin setup and enter the BE license key in Portainer.
