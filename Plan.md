# Temporary notes

! These notes should not make it into main branch

Thoughts on the next things to do in the homelab:

* Networks have been created but there are still some to create, could import the existing ones to get started but might be better to install netbox first as source of truth.
* VLAN bridge in Truenas for services
* VLAN bridge in Truenas for storage -> can backup desktop properly then
* Services to install
  * Plex/Jellyfin
    * Need to do gvt-g to split up the GPU
  * Matchbox for iPXE booting
  * dnsmasq for PXE booting with unifi being the main DHCP server
  * Tailscale for remote access
  * Omni (later for Talos)
  * Dropbox replacement (Seafile or OpenCloud, checkout other options)
  * Netbox as source of truth for networks and devices

* Talos on raspberry pi to run monitoring stack for the homelab until prod cluster is running, also run Tailscale here for HA access
  * This should be raw Talos without Omni for now, just to get the basics running so you understand how it works


* Orchestration/Admin/management stacks (maybe split into multiple sections)
  * Tailscale
  * Traefik for reverse proxy
  * Netbox for network and device documentation (source of truth to feed Pulumi)
  * dnsmasq
  * Matchbox -> serving iPXE instructions
    * CoreOS plus ignition
    * Talos plus image to connect back to Omni
  * Minio or other to map file uploads from Pulumi into backends of Matchbox and other services
  * Vault or other for issuing certificates to CoreOS cluster hosts
    * Might need TPM for this for encrypting unseal secret on boot if using Vault
  * Auth service (Authenik, Zitadel)
  * Omni

* Media stack
  * Plex for media streaming
  * Try out Jellyfin as an alternative
  * GVT-g for GPU splitting to allow multiple VMs to use the GPU
* Extra Services (maybe look to)
  * Seafile or OpenCloud for file storage and sharing
  * Immich for photos
  * Home Assistant for home automation
  * Log and metric collection to send to external monitoring service (raspberry pi for now)
  * Dashboard (eg Homer or Dashy)

There really is not not a good simple S3 compatible service we can run that just stores plain files. Minio and Garage are good if I just need put and get for objects but they store the files in a separate format to enable erasure coding and other clustering features. I just want to store files in a bucket and be able to get them back out again without any special processing.

Also I am alergic to using SSH on the server to copy files up but an SSH server in a container would limit its abilities by only mounting a known config directory.

Kube folders for gitops:

* management
  * network
  * truenas
    * click-ops documentation
    * truenas configuration (ansible, maybe)
    * docker-compose for Portainer and supporting services
  * portainer/apps
    * deploy various stacks for
      * reverse proxy? (should this be grouped with anything else?)
      * management/orchestration/PXE
      * security (tailscale and ???)
      * monitoring (collectors)
    * additional stacks for (these can be transferred to the cluster once it is running)
      * home automation (home assistant)
      * media (plex, jellyfin, arr stack?)
      * services (photos, files etc)

* infra
  * hypervisors
    * staging
    * prod
    * test (run in VMs on staging to test creation of single Incus node)
    * cluster-test (run in VMs on staging to test cluster creation of Incus cluster)
  * clusters (provisioning Talos clusters plus worker nodes)
    * prod
    * staging
    * dev (this will go away once the prod cluster is running)

* clusters
  * prod
  * staging
  * dev (this will go away once the prod cluster is running)

* manifests
  * apps
  * infra


folder structure for the homelab:

```homelab/
├── management/
│   ├── network/
│   │   ├── home - Home network
│   ├── portainer/
│   │   ├── mgmt - Main portainer stack, maybe rename into `main`
│   │   ├── vpn - Tailscale ++
│   ├── truenas/
│       ├── ansible for config (maybe)
│       ├── docker-compose for Portainer and supporting services
├── clusters/
│   ├── dev/
│   ├── prod/
│   ├── staging/
├── infra/
│   ├── nodes/
│   ├── hypervisors/
├── manifests/
│   ├── apps/
│   ├── base/
│   ├── infra/


idea: rename truenas folder to hosts and create subfolders as needed for each hosts

* museum
* castle/stick (choose one of these names for the compute stick)
