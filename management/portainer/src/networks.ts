import * as z from 'zod/v4'
import * as pulumi from '@pulumi/pulumi'
import { DockerNetwork } from '@pulumi/portainer'
import { portainerProvider, portainerEndpointId } from './providers'
import { DockerCompose, Service } from './compose'

const networkSchema = z
  .discriminatedUnion('type', [
    z.object({
      name: z.string(),
      type: z.literal('bridge'),
      'host-bind-ip': z.ipv4().optional(),
    }),
    z.object({
      name: z.string(),
      type: z.literal('macvlan'),
      subnet: z.cidrv4(),
      gateway: z.ipv4().optional(),
      'ip-range': z.cidrv4(),
      'parent-interface': z.string(),
    }),
  ])
  .transform((data) => {
    const networkName = `${data.name}-${data.type}`
    return {
      ...data,
      fullName: networkName,
    }
  })

export type NetworkDefinition = z.infer<typeof networkSchema>

export type Network = NetworkDefinition & {
  networkResource?: DockerNetwork
}

export type BridgeNetwork = Extract<NetworkDefinition, { type: 'bridge' }>

export type MacvlanNetwork = Extract<NetworkDefinition, { type: 'macvlan' }>

export function extractNetworkDefinitions(networks: unknown[]): NetworkDefinition[] {
  return networks.map((network) => {
    const result = networkSchema.safeParse(network)
    if (!result.success) {
      throw new Error(`Invalid network configuration: ${z.prettifyError(result.error)}`)
    }
    return result.data
  })
}

export function createNetworks(networkDefinitions: NetworkDefinition[]): Network[] {
  return networkDefinitions.map((network) => {
    const dockerNetwork = createDockerNetwork(network)
    return {
      ...network,
      networkResource: dockerNetwork,
    }
  })
}

function createDockerNetwork(network: NetworkDefinition): DockerNetwork {
  if (network.type === 'bridge') {
    const options: Record<string, pulumi.Input<string>> = network['host-bind-ip'] !== undefined
      ? {
          'com.docker.network.bridge.name': network.fullName,
          'com.docker.network.bridge.host_binding_ipv4': network['host-bind-ip'],
        }
      : {
          'com.docker.network.bridge.name': network.fullName,
        }
    return new DockerNetwork(
      `docker-network-${network.fullName}`,
      {
        endpointId: portainerEndpointId,
        name: network.fullName,
        driver: 'bridge',
        options: options,
        scope: 'local',
      },
      {
        provider: portainerProvider,
        // extra config to ensure replacement does not happen
        ignoreChanges: ['options', 'enableIpv4'],
      }
    )
  } else {
    const internalArg = network.gateway === undefined ? { internal: true } : {}
    return new DockerNetwork(
      `docker-network-${network.fullName}`,
      {
        endpointId: portainerEndpointId,
        name: network.fullName,
        driver: 'macvlan',
        ipamConfigs: [
          {
            subnet: network.subnet,
            gateway: network.gateway,
            ipRange: network['ip-range'],
          },
        ],
        options: {
          parent: network['parent-interface'],
        },
        scope: 'local',
        ...internalArg,
      },
      {
        provider: portainerProvider,
        // extra config to ensure replacement does not happen
        ignoreChanges: ['ipamConfigs', 'enableIpv4'],
      }
    )
  }
}

export function validateDockerComposeNetworks(
  stackName: string,
  compose: DockerCompose,
  networks: NetworkDefinition[]
): string[] {
  if (compose.networks === undefined) {
    Object.entries(compose.services).forEach(([serviceKey, service]) => {
      if (service.networks !== undefined) {
        throw new pulumi.RunError(
          `Service ${serviceKey} in stack ${stackName} has networks defined but no networks section in compose file`
        )
      }
    })
    return []
  }
  const definedNetworks = Object.keys(compose.networks)
  const matchingNetworkDefinitions = definedNetworks.map((networkName) => {
    return findNetworkByName(stackName, networkName, networks)
  })
  const utilisedNetworks = Array.from(
    new Set(
      Object.entries(compose.services).flatMap(([serviceKey, service]) => {
        return validateServiceNetworks(stackName, serviceKey, service, matchingNetworkDefinitions)
      })
    )
  )
  // find networks that are defined but not used
  const unusedNetworks = definedNetworks.filter((network) => !utilisedNetworks.includes(network))
  if (unusedNetworks.length > 0) {
    pulumi.log.warn(
      `The following networks are defined in the compose file for stack ${stackName} but not used by any service: ${unusedNetworks.join(', ')}`
    )
  }
  return utilisedNetworks
}

export function findNetworkByName(
  stackName: string,
  networkName: string,
  networks: NetworkDefinition[]
): NetworkDefinition {
  const matchingNetwork = networks.find((n) => n.fullName === networkName)
  if (matchingNetwork === undefined) {
    throw new pulumi.RunError(
      `Network ${networkName} defined in stack ${stackName} is not a valid network in this portainer instance`
    )
  }
  return matchingNetwork
}

function validateServiceNetworks(
  stackName: string,
  serviceName: string,
  service: Service,
  stackNetworks: NetworkDefinition[]
): string[] {
  if (service.networks === undefined) {
    return []
  }
  if (Array.isArray(service.networks)) {
    return service.networks.map((networkName) => {
      const matchingNetwork = stackNetworks.find((n) => n.fullName === networkName)
      if (matchingNetwork === undefined) {
        throw new pulumi.RunError(
          `Service ${serviceName} in stack ${stackName} uses network ${networkName} which is not a valid network in this portainer instance`
        )
      }
      return networkName
    })
  }
  return Object.entries(service.networks).map(([networkName, networkConfig]) => {
    const matchingNetwork = stackNetworks.find((n) => n.fullName === networkName)
    if (matchingNetwork === undefined) {
      throw new pulumi.RunError(
        `Service ${serviceName} in stack ${stackName} uses network ${networkName} which is not a valid network in this portainer instance`
      )
    }
    if (matchingNetwork.type === 'macvlan') {
      if (networkConfig === null || networkConfig.ipv4_address === undefined) {
        throw new pulumi.RunError(
          `Service ${serviceName} in stack ${stackName} uses macvlan network ${networkName} but no ipv4_address is defined`
        )
      }
      // TODO: validate macvlan ip is in the correct range
    }
    // TODO: validate bridge network config (ips in port bindings)
    return networkName
  })
}

export function validateMacVlanIpAddress(network: MacvlanNetwork, ipAddress: string): string {
  // TODO: check that configuredIp is in the network's subnet (include stackName for error messages)
  return ipAddress
}

export function getBridgeIpAddress(stackName: string, network: BridgeNetwork): string {
  if (!network['host-bind-ip']) {
    throw new pulumi.RunError(
      `Stack ${stackName} requires host-bind-ip to be defined for bridge network: ${network.fullName}`
    )
  }
  return network['host-bind-ip']
}
