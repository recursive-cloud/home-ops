import * as cloudflare from '@pulumi/cloudflare'
import { cloudflareProvider } from './provider'
import { accountId } from './account'

type ZoneOutputs = {
  domainName: string
  zoneObject: cloudflare.Zone
}

export function createZone(domainName: string): ZoneOutputs {
  const name = `zone-${domainName.replace(/\./g, '-')}`
  return {
    domainName,
    zoneObject: new cloudflare.Zone(
      name,
      {
        name: domainName,
        type: 'full',
        account: { id: accountId },
      },
      { provider: cloudflareProvider }
    ),
  }
}
