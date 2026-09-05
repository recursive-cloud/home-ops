# Woodhouse deployment — manual steps

> **Temporary file** — delete this once you've deployed. It is not part of the IaC.

This deploys [woodhouse](https://github.com/recursive-cloud/woodhouse) (a self-hosted
GitHub App) as a single stateless Portainer stack on TrueNAS, reachable externally
over the existing Cloudflare tunnel at **`https://woodhouse.gunzy.xyz`**.

## What the code changes do (no action needed from you)

| File | Change |
| --- | --- |
| `management/portainer/src/compose.ts` | Added `tmpfs` and `logging` to the service schema (zod was silently stripping them, which would have broken the upstream `read_only: true` + `tmpfs` hardening). |
| `management/portainer/stacks/docker-compose.woodhouse.yaml` | **New.** Single `woodhouse` container on the shared `cfd-bridge` network (same as `it-tools`), `ghcr.io/recursive-cloud/woodhouse:0bc4427`, non-root, read-only rootfs, no caps, 256M limit, Node-based `/healthz` healthcheck. No host volumes → no TrueNAS dataset needed. |
| `management/portainer/Pulumi.main.yaml` | Adds the `woodhouse` stack, the `homelab/woodhouse` ESC environment, and 4 non-secret config keys. |
| `management/portainer/stacks/cloudflared/config.yaml` | Adds the `woodhouse.gunzy.xyz` → `http://woodhouse:3000` ingress route (before the 404 catch-all). |
| `management/cloudflare/Pulumi.main.yaml` | Adds the `woodhouse.gunzy.xyz` DNS record to the existing `external-temp` tunnel. |

## Manual step 1 — GitHub App (GitHub web UI)

1. **Create the App** (or confirm an existing one):
   - Settings → Developer settings → GitHub Apps → **New GitHub App**
   - Webhook configuration:
     - Webhook URL: `https://woodhouse.gunzy.xyz/api/github/webhooks`
     - Webhook secret: <a name="webhook-secret"></a>**generate a long random string** (you'll set it in step 2)
   - Webhook permissions / event subscriptions: enable the events the app needs (GitHub pushes its default set on install).
   - Permissions: grant the repository/org scopes the app requires (read/write contents, metadata, etc.) — woodhouse documents the exact set in its README.
2. **Generate the App private key**: GitHub Apps → *Generate a private key* → download the `.pem`. You'll paste its contents in step 2.
3. **Install the App** on the owner(s) you allow. The install target(s) must match `portainer.woodhouse:allowed-installation-targets` (step 3).

Note: `APP_ID` is the **numeric** ID on the GitHub App overview page.

## Manual step 2 — Pulumi ESC environment + secrets

The code references `homelab/woodhouse` and reads three secrets from it.

1. Create the ESC environment (if you have an environment registry/CLI):
   - it is named **`homelab/woodhouse`**.
2. Set these **three secrets** in that environment (replace `<…>`):

   - `portainer.woodhouse:app-id` → `<the numeric APP_ID>`
   - `portainer.woodhouse:private-key` → `<the .pem contents, or its base64>`
   - `portainer.woodhouse:webhook-secret` → `<the webhook secret from step 1>`

   If you use `pulumi config` from the `management/portainer` project instead, the
   equivalent is:

   ```
   pulumi config set --secret portainer.woodhouse:app-id '<…>'
   pulumi config set --secret portainer.woodhouse:private-key '<…>'
   pulumi config set --secret portainer.woodhouse:webhook-secret '<…>'
   ```

> `portainer.woodhouse:timezone` is **not** needed — `TZ` uses the global
> `portainer:timezone` (already set in `Pulumi.yaml`).

## Manual step 3 — non-secret config (already added, review the values)

These are in `management/portainer/Pulumi.main.yaml`; adjust before deploying:

| Key | Default I set | Change to |
| --- | --- | --- |
| `portainer.woodhouse:allowed-installation-targets` | `recursive-cloud` | your real owner(s) — JSON array or comma list, e.g. `["recursive-cloud","your-user"]` |
| `portainer.woodhouse:baseline-repo` | `.github-private` | the owner-wide baseline repo (leave as-is if you use the default) |
| `portainer.woodhouse:log-level` | `info` | `debug` if you want noisier first-run logs |
| `portainer.woodhouse:dry-run` | `true` | **flip to `false` after the first validated run** (see step 5) |

## Manual step 4 — deploy

Order matters: the tunnel (DNS) must exist before the Portainer stack's route is useful.

```
# 1. tunnel DNS record + config route
mise run //management/cloudflare:up

# 2. the app stack
mise run //management/portainer:up
```

Run `preview` in each if you want to review first:

```
mise run //management/cloudflare:preview
mise run //management/portainer:preview
```

## Manual step 5 — verify, then turn off dry-run

1. `curl -I https://woodhouse.gunzy.xyz/healthz` → expect **200**.
2. While `DRY_RUN=true`, trigger a real event (e.g. a PR) and check `woodhouse` logs for the decisions it *would* make.
3. When confident, edit `portainer.woodhouse:dry-run: 'false'` in `Pulumi.main.yaml` and re-run `mise run //management/portainer:up`.

## No TrueNAS playbook needed

Woodhouse is fully stateless (read-only rootfs, `/tmp` on tmpfs, no host volumes), so
there is no dataset/user/group to provision — skip the `truenas` playbook for this one.
