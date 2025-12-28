import * as pulumi from '@pulumi/pulumi'
import * as cloudflare from '@pulumi/cloudflare'
import * as random from '@pulumi/random'
import * as pulumiService from '@pulumi/pulumiservice'
import { cloudflareProvider } from './provider'
import { accountId } from './account'

export type CloudflareTunnelArgs = {
  name: string
  'dns-records': string[]
}

export class CloudflareTunnel extends pulumi.ComponentResource {
  public readonly name: string
  public readonly tunnelId: pulumi.Output<string>
  public readonly escEnvironmentName: pulumi.Output<string>

  constructor(
    args: CloudflareTunnelArgs,
    zoneMap: Record<string, cloudflare.Zone>,
    opts?: pulumi.ResourceOptions
  ) {
    super('recursive-cloud:CloudflareTunnel', 'cloudflare-tunnel', {}, opts)
    this.name = args.name
    // Generate a 32-byte secure secret for the tunnel
    const tunnelSecret = new random.RandomBytes(
      `random-bytes-tunnel-secret-${this.name}`,
      {
        length: 32,
      },
      { parent: this }
    )

    const tunnel = new cloudflare.ZeroTrustTunnelCloudflared(
      `zero-trust-tunnel-${this.name}`,
      {
        accountId: accountId,
        name: this.name,
        tunnelSecret: tunnelSecret.base64,
      },
      { parent: this, provider: cloudflareProvider }
    )

    this.tunnelId = tunnel.id

    args['dns-records'].forEach((dnsRecord) => {
      // Assume that dns records are in the format: subdomain.domain.com
      const parts = dnsRecord.split('.')
      const domainName = parts.slice(-2).join('.')
      const zone = zoneMap[domainName]
      if (!zone) {
        throw new pulumi.RunError(`Zone not found for domain name: ${domainName}`)
      }
      const subdomain = parts.slice(0, -2).join('.')
      const dnsRecordName = dnsRecord.replace(/\./g, '-')

      // Create a CNAME DNS record pointing to the tunnel for each specified DNS record
      new cloudflare.DnsRecord(
        `dns-record-tunnel-${this.name}-${dnsRecordName}`,
        {
          zoneId: zone.id,
          name: subdomain,
          type: 'CNAME',
          content: tunnel.id.apply((id) => `${id}.cfargotunnel.com`),
          proxied: true,
          ttl: 1, // Proxy TTL needs to be 1 and Cloudflare will manage it
        },
        { parent: this, provider: cloudflareProvider }
      )
    })

    const tunnelToken = pulumi
      .all([accountId, tunnel.id, tunnelSecret.base64])
      .apply(([acc, id, secret]) => {
        const tokenObj = { a: acc, t: id, s: secret }
        return Buffer.from(JSON.stringify(tokenObj)).toString('base64')
      })

    const escEnv = new pulumiService.Environment(`esc-environment-${this.name}`, {
      name: `cloudflare-tunnel-${this.name}`,
      project: 'homelab', // TODO: make configurable
      organization: pulumi.getOrganization(),
      yaml: pulumi.interpolate`
values:
  cloudflare-tunnel:
    ${this.name}:
      tunnel-token:
        fn::secret: ${tunnelToken}
  `,
    })

    // TODO: project should be configurable
    this.escEnvironmentName = pulumi.interpolate`homelab/${escEnv.name}`

    this.registerOutputs({
      tunnelId: this.tunnelId,
      escEnvironmentName: this.escEnvironmentName,
    })
  }
}
