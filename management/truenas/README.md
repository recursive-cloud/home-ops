# TrueNAS Management

This directory is intended to contain documentation for setup of Truenas Scale as a NAS for bulk storage but also setup of portainer as a starting point for running initial docker workloads and the management plane for the rest of the lab. Workloads on Portainer will be deployed using Pulumi (via its any Terrform provider capability).

## TrueNAS Setup

I originally had TrueNAS Scale running as a Proxmox VM and had planned to move to bare metal but did not find the time. At one point the drive I was running Proxmox on started to have issues and while I had a config backup for Truenas I decided to go with a fresh install and import the pools and reconfigure from scratch.

### Hardware

Host is custom build with the following hardware:

* Silverstone DS380 case
* Asrock Rack E3C246D2I motherboard
* Intel(R) Xeon(R) E-2224G CPU @ 3.50GHz
* 32GB ECC RAM
* 4x 4TB WD Red drives for storage pool (hot swappable bays)
* 1x 4TB WD Red drive for hot spare (hot swappable bay)
* 2x 128GB SATA SSD drives for mirrored application data (hot swappable bays)
* 2x 128GB SATA SSD drives for mirrored boot pool (internal)
* Basic 2 port PCIe card for additional SATA ports (used by boot pool for the moment)
* 1x 512GB SSD in USB3.2 enclosure for backup pool

### Setup

Boot pool was set up on 2x 128GB SATA SSD drives in mirror.

Existing pools were imported:

- pool - main storage pool with 4x 4TB WD Red drives in striped mirror, plus 1x 4TB WD Red drive as hot spare
- ssdpool - pool for application data with 2x 128GB SATA SSD drives in mirror, 1x drive installed but not added as a spare

An additional backup pool was created on the 512GB SSD in USB enclosure, using the entire drive as a single vdev.

The following configuration was also applied:

- Notifications were configured:
  - Slack notifications (personal workspace) - INFO level
  - Email notifications (via a Google Account) - WARNING level to reduce noice
- Session timeout - set to 15 minutes of inactivity.
- TLS - Letsencrypt certificate via Cloudflare DNS challenge, automated renewal in the TrueNAS UI.
- A personal admin account with sudo privileges for day to day use rather than using truenas_admin.

### Data protection

I am following a 3-2-1 backup strategy for data protection on the NAS for critical data and other lifecycles for other data:

- Automatic scrubs on all pools, early morning on a Tuesday with at least 26 days between scrubs.
  - This ensures that scrubs run on a predictable day of the week and that they run at least once a month.
- Periodic Snapshots
  - `ssdpool/appdata` - hourly, keep for 2 weeks, recursive to child datasets
  - `pool/seafile-data` - hourly, keep for 2 weeks
  - `pool/media` - daily, keep for 1 week
  - Others will be added once existing data is sorted and lifecycle requirements are better understood. Those have had manual snapshots taken for now.
- Replication Tasks
  - `critical-backup` - replicates `pool/seafile-data` and `ssdpool/appdata` to backup pool daily, maintain equivalent snapshots on the backup pool. This is the most critical data on the NAS and this replication task ensures that there is a backup on separate media.
  - Additional replication tasks will be added as lifecycle requirements for other data are better understood. For now, manual replication tasks have been run for other critical datasets.
- Cloud Sync Tasks (BackBlaze B2), selective sync as snapshots and replication of nested datasets does not work:
  - `appdata/hass/backups` - HASS backup directory
  - `appdata/matterbridge` - Matterbridge config directory
  - `appdata/netbox` - Netbox config directory
  - `appdata/pocket-id-mgmt` - Pocket Id management instance data directory
  - `appdata/pocket-id` - Pocket Id data directory
  - `appdata/portainer` - Portainer config directory
  - `appdata/seafile-db` - Seafile database directory
  - `pool/seafile-data` - Seafile data directory

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

## Infrastructure as Code & Playbook Automation

The management of TrueNAS users and datasets is now handled via an Ansible playbook (`truenas.yml`) included in this directory. This enables repeatable, version-controlled configuration of key NAS resources, reducing manual setup and configuration drift.

### Playbook Structure

- **Playbook:** `truenas.yml` orchestrates the creation of users and datasets on the TrueNAS server.
- **Vars Files:**
  - `vars/users.yml` defines user accounts, UIDs, and GIDs for services and applications.
  - `vars/datasets.yml` specifies datasets, pools, parent-child relationships, and ownership for application and storage data.
- **Roles:** The playbook leverages roles for user and dataset management, using the `arensb.truenas` Ansible collection.
- **Inventory:** The Ansible inventory is defined in `hosts.yml`.

### Usage with Mise

- **Lint playbook and roles:**
  `mise run lint`
- **Run the playbook:**
  `mise run playbook`
- **Dry run (check mode):**
  `mise run dry-run`

You can now manage users and datasets on your TrueNAS instance by updating the vars files and running the playbook. This replaces previous manual or click-ops steps for these resources. Further automation and resource coverage will be added as the infrastructure evolves.
