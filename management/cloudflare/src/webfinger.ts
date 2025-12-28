import * as pulumi from '@pulumi/pulumi'
import * as cloudflare from '@pulumi/cloudflare'
import * as fs from 'fs'
import { cloudflareProvider } from './provider'
import { accountId } from './account'

export type JRD = {
  subject: string
  links: {
    rel: string
    href: string
  }[]
}

export function createWebfingerWorkers(
  resourceDescriptors: JRD[],
  zoneMap: Record<string, cloudflare.Zone>
): WebfingerWorker[] {
  // group descriptors by zone
  const zoneDescriptorMap: Record<string, JRD[]> = resourceDescriptors.reduce(
    (acc: Record<string, JRD[]>, descriptor: JRD) => {
      const zone = descriptor.subject.split('@')[1]
      if (!Object.keys(zoneMap).includes(zone)) {
        throw new pulumi.RunError(
          `Invalid zone "${zone}" for descriptor subject "${descriptor.subject}"`
        )
      }
      const existingZoneDescriptors = acc[zone] || []
      return {
        ...acc,
        [zone]: [...existingZoneDescriptors, descriptor],
      }
    },
    {}
  )

  // create a webfinger worker for each zone
  return Object.entries(zoneDescriptorMap).map(([zoneDomainName, descriptors]) => {
    const zone = zoneMap[zoneDomainName]
    return new WebfingerWorker(zoneDomainName, zone.id, descriptors, {
      aliases: [{ name: zoneDomainName.replace(/[.]/g, '-') }],
    })
  })
}

class WebfingerWorker extends pulumi.ComponentResource {
  constructor(
    domainName: string,
    zoneId: pulumi.Input<string>,
    descriptors: JRD[],
    opts?: pulumi.ResourceOptions
  ) {
    super(
      'recursive-cloud:WebfingerWorker',
      `webfinger-${domainName.replace(/[.]/g, '-')}`,
      {},
      opts
    )

    const name = `webfinger-${domainName.replace(/[.]/g, '-')}`

    const bindings: cloudflare.types.input.WorkersScriptBinding[] = descriptors.map(
      (descriptor) => ({
        type: 'secret_text',
        name: descriptor.subject.replace(/[:/@]/g, '_').toUpperCase(),
        text: JSON.stringify(descriptor),
      })
    )

    const script = new cloudflare.WorkersScript(
      `script-${name}`,
      {
        accountId: accountId,
        bindings: bindings,
        content: fs.readFileSync('./webfinger/dist/main.js', 'utf-8'),
        scriptName: `script-${name}`,
        mainModule: 'main.js',
      },
      { parent: this, provider: cloudflareProvider }
    )

    const domain = new cloudflare.WorkersCustomDomain(
      `domain-${name}`,
      {
        accountId: accountId,
        hostname: domainName,
        service: script.scriptName,
        zoneId: zoneId,
      },
      { parent: this, provider: cloudflareProvider }
    )

    new cloudflare.WorkersRoute(
      `route-${name}`,
      {
        zoneId: zoneId,
        pattern: pulumi.interpolate`${domain.hostname}/.well-known/webfinger`,
        script: script.scriptName,
      },
      { parent: this, provider: cloudflareProvider }
    )
  }
}
