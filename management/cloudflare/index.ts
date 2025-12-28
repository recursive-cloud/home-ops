import * as cloudflare from '@pulumi/cloudflare'
import { config } from './src/config'
import { createZone } from './src/zone'
import { JRD, createWebfingerWorkers } from './src/webfinger'
import { CloudflareTunnel, CloudflareTunnelArgs } from './src/tunnel'

const zoneDomainNames = config.requireObject<string[]>('zone-domain-names')

const zones = zoneDomainNames.map((domainName) => createZone(domainName))

const zoneMap: Record<string, cloudflare.Zone> = zones.reduce(
  (acc: Record<string, cloudflare.Zone>, zone) => {
    return {
      ...acc,
      [zone.domainName]: zone.zoneObject,
    }
  },
  {}
)

const zoneOutputs = Object.fromEntries(
  zones.map((zone) => [
    zone.domainName,
    { 'zone-id': zone.zoneObject.id, 'name-servers': zone.zoneObject.nameServers },
  ])
)

// TODO: zod schema to validate structure
const resourceDescriptors = config.requireObject<JRD[]>('json-resource-descriptors')
createWebfingerWorkers(resourceDescriptors, zoneMap)

const tunnelSpecs = config.requireObject<CloudflareTunnelArgs[]>('tunnels')
const tunnels = tunnelSpecs.map((tunnelSpec) => new CloudflareTunnel(tunnelSpec, zoneMap))
const tunnelOutputs = Object.fromEntries(
  tunnels.map((tunnel) => [
    tunnel.name,
    { 'tunnel-id': tunnel.tunnelId, 'esc-environment': tunnel.escEnvironmentName },
  ])
)

export = { zones: zoneOutputs, tunnels: tunnelOutputs }
