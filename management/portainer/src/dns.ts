import * as pulumi from '@pulumi/pulumi'
import * as unifi from '@pulumi/unifi'
import { unifiProvider } from './providers'
import { startsWith } from 'lodash'
import { NetworkDefinition } from './networks'
import { DockerCompose, ServiceNetworks } from './compose'
import { TraefikIngressDefinition } from './TraefikStack'
import { EnvVarDefinition, interpolateEnvVarsInString } from './envVars'

export type DNSRecordDefinition = {
  /** Logical name for the DNS record */
  name: string
  /** Domain name for the DNS record */
  domain: string
  /** Type of DNS record: 'A' for IPv4, 'AAAA' for IPv6, or 'CNAME' for aliases */
  type: 'A' | 'AAAA' | 'CNAME'
  /** The actual record value, either an IP address for 'A'/'AAAA' records or a domain for 'CNAME' records */
  record: string
  /** Time to live for the DNS record in seconds */
  /** Optional, if not provided, use default TTL */
  ttl?: number
}

export function createDNSRecord(
  dnsRecord: DNSRecordDefinition,
  parent: pulumi.Resource,
  opts?: pulumi.ComponentResourceOptions
): unifi.DnsRecord {
  return new unifi.DnsRecord(
    `dns-record-${dnsRecord.name}`,
    {
      name: dnsRecord.domain,
      type: dnsRecord.type,
      record: dnsRecord.record,
      ttl: dnsRecord.ttl ?? 0, // Default to 0 if not provided
    },
    {
      provider: unifiProvider,
      parent: parent,
      ...opts,
      deleteBeforeReplace: true, // Ensure the record is deleted before replacing it
    }
  )
}

export function extractDNSRecordsFromComposeObject(
  stackName: string,
  composeObject: DockerCompose,
  envVarDefinitions: EnvVarDefinition[],
  networks: NetworkDefinition[],
  traefikStacks: TraefikIngressDefinition[]
): DNSRecordDefinition[] {
  return validateAndDeduplicateDNSRecords(
    Object.entries(composeObject.services).flatMap(([serviceKey, service]) => {
      const labels = service.labels
      if (labels === undefined) {
        return []
      }
      const normalizedLabels: Record<string, string> = Array.isArray(labels)
        ? Object.fromEntries(labels.map((label) => label.split('=')))
        : Object.fromEntries(Object.entries(labels).map(([key, value]) => [key, String(value)]))
      const interpolatedLabels = Object.fromEntries(
        Object.entries(normalizedLabels).map(([key, value]) => {
          return [key, interpolateEnvVarsInString(value, envVarDefinitions)]
        })
      )
      return [
        ...extractDNSRecordsFromTraefikLabels(
          stackName,
          serviceKey,
          interpolatedLabels,
          networks,
          traefikStacks
        ),
        ...extractDNSRecordsFromLabels(
          stackName,
          serviceKey,
          interpolatedLabels,
          networks,
          service.networks
        ),
      ]
    })
  )
}

export function extractDNSRecordsFromTraefikLabels(
  stackName: string,
  serviceKey: string,
  labels: Record<string, string>,
  networks: NetworkDefinition[],
  traefikStacks: TraefikIngressDefinition[]
): DNSRecordDefinition[] {
  const traefikEnabled = labels['traefik.enable']
  if (traefikEnabled !== 'true') {
    return []
  }
  const traefikNetwork = labels['traefik.docker.network']
  if (!traefikNetwork) {
    throw new pulumi.RunError('Traefik network label is missing') // TODO: make this more specific
  }
  if (!networks.some((network) => network.fullName === traefikNetwork)) {
    throw new pulumi.RunError(`Traefik network '${traefikNetwork}' is not defined`)
  }
  // find the Traefik ingress that matches the network
  const matchingIngress = traefikStacks.find(
    (ingress) => ingress.bridgeNetworkName === traefikNetwork
  )
  if (!matchingIngress) {
    throw new pulumi.RunError(`No Traefik ingress found for network '${traefikNetwork}'`)
  }

  const keys = Object.keys(labels)
  const ruleRegex = /^traefik\.http\.routers\.(.+)\.rule$/
  const hostRegex = /Host\(`([^`]+)`\)/
  return keys
    .filter((key) => startsWith(key, 'traefik.http.routers.'))
    .filter((key) => ruleRegex.test(key))
    .map((key) => {
      const match = key.match(ruleRegex)
      if (!match) {
        throw new pulumi.RunError(`Invalid Traefik rule format for key: ${key}`)
      }
      const routerName = match[1]
      const rule = labels[key]
      const hostMatch = rule.match(hostRegex)
      if (!hostMatch) {
        throw new pulumi.RunError(`Invalid Traefik rule format for key: ${key}`)
      }
      const host = hostMatch[1]
      return {
        name: `${stackName}-${serviceKey}-router-${routerName}`,
        domain: host,
        type: 'CNAME',
        record: matchingIngress.domainName,
        ttl: 0,
      }
    })
}

export function extractDNSRecordsFromLabels(
  stackName: string,
  serviceKey: string,
  labels: Record<string, string>,
  networks: NetworkDefinition[],
  serviceNetworks: ServiceNetworks
): DNSRecordDefinition[] {
  const dnsLabelRegex = /^recursive-cloud\.dns\.(.+)$/
  return Object.entries(labels)
    .filter(([key]) => dnsLabelRegex.test(key))
    .flatMap(([key, value]) => {
      const match = key.match(dnsLabelRegex)
      if (!match) {
        throw new pulumi.RunError(`Invalid DNS label format for key: ${key}`)
      }
      const network = networks.find((n) => n.fullName === match[1])
      if (!network) {
        throw new pulumi.RunError(`Network '${match[1]}' not found in defined networks`)
      }

      if (network.type === 'macvlan') {
        if (serviceNetworks === undefined || Array.isArray(serviceNetworks)) {
          throw new pulumi.RunError(
            `Service networks for '${match[1]}' must be defined as an object for DNS on macvlan networks`
          )
        }
        const networkConfig = serviceNetworks[match[1]]
        if (
          networkConfig === undefined ||
          networkConfig === null ||
          networkConfig.ipv4_address === undefined
        ) {
          throw new pulumi.RunError(
            `IPv4 address for network '${match[1]}' must be defined for macvlan networks`
          )
        }

        // Add A record for IPv4
        const ipv4Records: DNSRecordDefinition[] = [
          {
            name: `${stackName}-${serviceKey}-${match[1]}-ipv4`,
            domain: value,
            type: 'A',
            record: networkConfig.ipv4_address,
            ttl: 0, // Default TTL
          },
        ]

        // Add AAAA record for IPv6 if available
        const ipv6Records: DNSRecordDefinition[] = networkConfig.ipv6_address
          ? [
              {
                name: `${stackName}-${serviceKey}-${match[1]}-ipv6`,
                domain: value,
                type: 'AAAA',
                record: networkConfig.ipv6_address,
                ttl: 0, // Default TTL
              },
            ]
          : []

        return [...ipv4Records, ...ipv6Records]
      } else {
        const name = match[1]
        if (network['host-bind-ip'] === undefined) {
          throw new pulumi.RunError(
            `Host bind IP for network '${name}' must be defined for bridge networks`
          )
        }
        const record = network['host-bind-ip']
        if (serviceNetworks === undefined) {
          throw new pulumi.RunError(
            `Service networks for '${name}' must be defined for DNS on bridge networks`
          )
        }
        if (Array.isArray(serviceNetworks) && !serviceNetworks.includes(name)) {
          throw new pulumi.RunError(
            `Service network must include network '${name}' to create DNS record`
          )
        } else if (
          typeof serviceNetworks === 'object' &&
          !Object.keys(serviceNetworks).includes(name)
        ) {
          throw new pulumi.RunError(
            `Service network must include network '${name}' to create DNS record`
          )
        }

        // Bridge networks only support IPv4
        return [
          {
            name: `${stackName}-${serviceKey}-${name}`,
            domain: value,
            type: 'A',
            record,
            ttl: 0, // Default TTL
          },
        ]
      }
    })
}

function validateAndDeduplicateDNSRecords(records: DNSRecordDefinition[]): DNSRecordDefinition[] {
  // Check for records with same domain but different type or record value
  records.forEach((record) => {
    records
      .filter((r) => r.domain === record.domain)
      .forEach((r) => {
        if (r.record !== record.record) {
          if (
            (r.type === 'A' && record.type === 'AAAA') ||
            (r.type === 'AAAA' && record.type === 'A')
          ) {
            // Allow A and AAAA records for the same domain with different record values
            return
          }
          throw new pulumi.RunError(
            `Conflicting DNS records found for domain '${record.domain}': (${record.type}, ${record.record}) vs (${r.type}, ${r.record})`
          )
        }
      })
  })
  return records.reduce((acc: DNSRecordDefinition[], record) => {
    if (acc.find((r) => r.domain === record.domain) !== undefined) {
      return acc
    }
    return [...acc, record]
  }, [])
}
