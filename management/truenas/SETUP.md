# Documenting TrueNAS setup

* Setup datasets
  * acme.sh
  * portainer
* Start acme-sh in daemon mode (add app via YAML in TrueNAS)
* Set default server to letsencrypt `docker exec acme.sh --set-default-ca  --server letsencrypt`
* Issue certificate for Portainer using Cloudflare DNS:
  * `docker exec acme.sh --issue --dns dns_cf -d portainer.gunzy.xyz`
* Start Portainer with the issued certificate.
* Enter EE license key in Portainer.

```
museum% ls -la /mnt/ssdpool/appdata/acme.sh/portainer.gunzy.xyz_ecc 
total 49
drwxrwx--- 2 root root    9 Jun 20 22:23 .
drwxrwx--- 4 root root    6 Jun 20 22:23 ..
-rwxrwx--- 1 root root 1567 Jun 20 22:23 ca.cer
-rwxrwx--- 1 root root 2869 Jun 20 22:23 fullchain.cer
-rwxrwx--- 1 root root 1302 Jun 20 22:23 portainer.gunzy.xyz.cer
-rwxrwx--- 1 root root  729 Jun 20 22:23 portainer.gunzy.xyz.conf
-rwxrwx--- 1 root root  481 Jun 20 22:23 portainer.gunzy.xyz.csr
-rwxrwx--- 1 root root  192 Jun 20 22:23 portainer.gunzy.xyz.csr.conf
-rwxrwx--- 1 root root  227 Jun 20 22:23 portainer.gunzy.xyz.key
museum% ls -la /mnt/ssdpool/appdata/acme.sh/                       
total 27
drwxrwx--- 4 root root   6 Jun 20 22:23 .
drwxrwx--- 5 root root   5 Jun 20 22:22 ..
-rwxrwx--- 1 root root 159 Jun 20 22:23 account.conf
drwxrwx--- 3 root root   3 Jun 20 22:23 ca
-rwxrwx--- 1 root root 494 Jun 20 22:23 http.header
drwxrwx--- 2 root root   9 Jun 20 22:23 portainer.gunzy.xyz_ecc
```

Document setup of

* scrub
* snapshots (when done)
* backups (when done)
* session timeout

Idea for ssh:
* Use a custom port just for the config file uploader before you start using it, then SSH can be enabled on TrueNAS. You are unlikely to SSH directly to the uploader server but definitely to the TrueNAS server.


There is potential here to use the TrueNAS API to do some of this stuff. For example, to check the status of the apps and also update:

```
museum% midclt call app.query '[]' '{}'
[{"name": "portainer", "id": "portainer", "state": "RUNNING", "upgrade_available": true, "latest_version": null, "image_updates_available": true, "custom_app": true, "migrated": false, "human_version": "1.0.0_custom", "version": "1.0.0", "metadata": {"app_version": "custom", "capabilities": [], "description": "This is a custom app where user can use his/her own docker compose file for deploying services", "home": "", "host_mounts": [], "maintainers": [], "name": "custom-app", "run_as_context": [], "sources": [], "title": "Custom App", "train": "stable", "version": "1.0.0"}, "active_workloads": {"containers": 3, "used_ports": [{"container_port": 2222, "protocol": "tcp", "host_ports": [{"host_port": 2222, "host_ip": "192.168.10.64"}]}, {"container_port": 8000, "protocol": "tcp", "host_ports": [{"host_port": 80, "host_ip": "192.168.10.64"}]}, {"container_port": 9443, "protocol": "tcp", "host_ports": [{"host_port": 443, "host_ip": "192.168.10.64"}]}], "container_details": [{"id": "92884e33ab30aa0f42bf0d7a267089238b315ef3d305d950d78b998e7a3a6245", "service_name": "openssh-server", "image": "lscr.io/linuxserver/openssh-server:latest", "port_config": [{"container_port": 2222, "protocol": "tcp", "host_ports": [{"host_port": 2222, "host_ip": "192.168.10.64"}]}], "state": "running", "volume_mounts": [{"source": "/mnt/ssdpool/appdata/openssh-server", "destination": "/config", "mode": "rw", "type": "bind"}, {"source": "/mnt/ssdpool/appdata/app-config", "destination": "/app-config", "mode": "rw", "type": "bind"}]}, {"id": "8ab89ec2fc9f941cc6785a1bb6fb747cda5c49719e2bbb92b1e26f315e0dad12", "service_name": "portainer-ee", "image": "portainer/portainer-ee:lts", "port_config": [{"container_port": 8000, "protocol": "tcp", "host_ports": [{"host_port": 80, "host_ip": "192.168.10.64"}]}, {"container_port": 9443, "protocol": "tcp", "host_ports": [{"host_port": 443, "host_ip": "192.168.10.64"}]}], "state": "running", "volume_mounts": [{"source": "/mnt/ssdpool/appdata/acme.sh/portainer.gunzy.xyz_ecc", "destination": "/certs", "mode": "rw", "type": "bind"}, {"source": "/mnt/ssdpool/appdata/portainer", "destination": "/data", "mode": "rw", "type": "bind"}, {"source": "/var/run/docker.sock", "destination": "/var/run/docker.sock", "mode": "rw", "type": "bind"}]}, {"id": "55f97605403d34b6986099160216471207136f3f8bd5d96d3c3fc3ef050a5d75", "service_name": "acme-sh", "image": "neilpang/acme.sh:3.1.1", "port_config": [], "state": "running", "volume_mounts": [{"source": "/mnt/ssdpool/appdata/acme.sh", "destination": "/acme.sh", "mode": "rw", "type": "bind"}]}], "volumes": [{"source": "/mnt/ssdpool/appdata/acme.sh/portainer.gunzy.xyz_ecc", "destination": "/certs", "mode": "rw", "type": "bind"}, {"source": "/mnt/ssdpool/appdata/acme.sh", "destination": "/acme.sh", "mode": "rw", "type": "bind"}, {"source": "/mnt/ssdpool/appdata/portainer", "destination": "/data", "mode": "rw", "type": "bind"}, {"source": "/var/run/docker.sock", "destination": "/var/run/docker.sock", "mode": "rw", "type": "bind"}, {"source": "/mnt/ssdpool/appdata/app-config", "destination": "/app-config", "mode": "rw", "type": "bind"}, {"source": "/mnt/ssdpool/appdata/openssh-server", "destination": "/config", "mode": "rw", "type": "bind"}], "images": ["neilpang/acme.sh:3.1.1", "lscr.io/linuxserver/openssh-server:latest", "portainer/portainer-ee:lts"], "networks": [{"Name": "portainer", "Id": "4e54f2c05979028fc480326448d3ef432fb0a3ab26d7e460294bf00929962844", "Labels": {"com.docker.compose.config-hash": "f0b14c3e0f56d8ea61ad7fe809f8b2b576bbad8c8590effe24a390410ed341f3", "com.docker.compose.network": "portainer", "com.docker.compose.project": "ix-portainer", "com.docker.compose.version": "2.32.3"}, "Created": "2025-09-25T08:38:29.870631485+10:00", "Scope": "local", "Driver": "bridge", "EnableIPv6": true, "IPAM": {"Driver": "default", "Options": null, "Config": [{"Subnet": "172.16.1.0/24", "Gateway": "172.16.1.1"}, {"Subnet": "fdd0:0:0:1::/64", "Gateway": "fdd0:0:0:1::1"}]}, "Internal": false, "Attachable": false, "Ingress": false, "ConfigFrom": {"Network": ""}, "ConfigOnly": false, "Containers": {}, "Options": {"com.docker.network.bridge.host_binding_ipv4": "192.168.10.64", "com.docker.network.bridge.name": "portainer", "com.docker.network.enable_ipv6": "true"}}]}, "notes": null, "portals": {}}]
museum% midclt call app.upgrade 'portainer' '{}'
188
```

A cron could be set up but is that any better than watchtower? jq is available but it might be better to use something like ansible?

API Docs:
https://api.truenas.com/v25.04.2/api_methods_app.upgrade.html


idea: acme.sh renew-hook runs inside the container which makes things hard but they might actually have the prior-art I need to do this. They have a docker exec shell command within the scripts which calls curl --unix-socket to hit the API. So I could do something similar to trigger a redeploy of the portainer container after renewal.

https://github.com/acmesh-official/acme.sh/blob/a5754e9ec483342cd32fac1ab93e94f9057e75d6/deploy/docker.sh#L173
https://docs.docker.com/reference/api/engine/sdk/examples/#list-and-manage-containers
https://docs.docker.com/reference/api/engine/version/v1.51/#tag/Container/operation/ContainerRestart

added the following to the `Le_RenewHook` var in the certificate conf file next to the issued certs:

```bash
curl --silent --unix-socket /var/run/docker.sock -X POST http://localhost/containers/portainer/restart
```

ran `docker exec acme.sh --cron --force` to reissue the cert and trigger the renew hook. This simulates what the daemon does at renew time. Confirmed that the portainer container restarted.

learned that letsencrypt certs are issued with notbefore 1 hour before the issue time.


full issue command with renew hook:

```bash
docker exec acme.sh --issue --dns dns_cf -d portainer.gunzy.xyz --renew-hook 'curl --silent --unix-socket /var/run/docker.sock -X POST http://localhost/containers/portainer/restart'

```
