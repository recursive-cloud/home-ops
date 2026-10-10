# portainer: Pulumi TS managing Portainer Docker stacks on TrueNAS
- Stack DNS is written to the UniFi Controller (`src/dns.ts`, `@pulumi/unifi`): Traefik `Host()` labels become CNAMEs; a `recursive-cloud.dns.{network}: {domain}` label creates direct A/AAAA records. Cloudflare is only the cert resolver.
- Compose env vars use `${VAR}` / `${SECRET__VAR}` / `${GEN_PASS_…}` / `${GEN_BASE64_…}` / `${BUILTIN__…}` substitution — see skill `portainer-stack` before writing any.
- Stack config lives in `Pulumi.main.yaml` (networks, traefik-ingresses, `portainer:stacks` list, ESC envs `homelab/*`) — not in `Pulumi.yaml`.
- Storage: app data `/mnt/ssdpool/appdata/{container-name}/`, bulk `/mnt/pool/{dataset}/`; new users/groups/datasets are declared in `../truenas` vars — never ask the user to create them manually.
- UID 1000–1999 / GID 3000–3999 (3002 reserved for the `pulumi` user, uid 2000); take the next unused ID from `../truenas/vars/users.yml` (service-default IDs like `seafile=8000:8000` excepted).
- Always set `container_name`; `version:` is not required.
- Skills: `portainer-stack` — adding or changing a stack: env-var reference, truenas provisioning, deploy flow.
