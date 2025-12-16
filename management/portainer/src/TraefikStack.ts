import * as z from 'zod/v4'
import * as pulumi from '@pulumi/pulumi'
import { DockerCompose } from './compose'
import {
  Network,
  NetworkDefinition,
  findNetworkByName,
  validateMacVlanIpAddress,
  getBridgeIpAddress,
} from './networks'
import { DNSRecordDefinition } from './dns'
import { Stack, StackDefinition } from './stack'
import { extractEnvVarDefinitions } from './envVars'

const config = new pulumi.Config('portainer.traefik')
const hostname = config.require('hostname') // maybe this needs to a globally available config variable?
const baseDomain = config.require('base-domain')
const appDataBasePath = config.require('app-data-base-path')

const traefikIngressSchema = z.object({
  network: z.string(),
  'macvlan-ip': z.ipv4().optional(),
})

export type TraefikIngressDefinition = {
  stackName: string
  domainName: string
  networkBaseDomain: string
  ipAddress: string
  exposeOnMacVlan: boolean
  bridgeNetworkName: string
  macvlanNetworkName: string
}

export function extractTraefikIngressDefinitions(
  traefikIngresses: unknown[],
  networkDefinitions: NetworkDefinition[]
): TraefikIngressDefinition[] {
  return traefikIngresses.map((traefikConfig) => {
    const result = traefikIngressSchema.safeParse(traefikConfig)
    if (!result.success) {
      throw new Error(`Invalid Traefik ingress configuration: ${z.prettifyError(result.error)}`)
    }
    const item = result.data
    const stackName = `traefik-${item.network}`
    const networkBaseDomain = `${item.network}.${baseDomain}`
    const domainName = `traefik-${hostname}.${networkBaseDomain}`
    const bridgeNetworkName = `${item.network}-bridge`
    const macvlanNetworkName = `${item.network}-macvlan`
    const exposeOnMacVlan = item['macvlan-ip'] !== undefined
    const bridgeNetwork = findNetworkByName(stackName, bridgeNetworkName, networkDefinitions)
    if (bridgeNetwork.type !== 'bridge') {
      throw new pulumi.RunError(
        `Network ${bridgeNetworkName} for Traefik ingress in stack ${stackName} must be of type 'bridge'`
      )
    }
    const macvlanNetwork = exposeOnMacVlan
      ? findNetworkByName(stackName, macvlanNetworkName, networkDefinitions)
      : undefined
    const ipAddress =
      item['macvlan-ip'] !== undefined && macvlanNetwork?.type === 'macvlan'
        ? validateMacVlanIpAddress(macvlanNetwork, item['macvlan-ip'])
        : getBridgeIpAddress(stackName, bridgeNetwork)

    return {
      stackName: stackName,
      domainName: domainName,
      networkBaseDomain: networkBaseDomain,
      ipAddress: ipAddress,
      exposeOnMacVlan: exposeOnMacVlan,
      bridgeNetworkName: bridgeNetworkName,
      macvlanNetworkName: macvlanNetworkName,
    }
  })
}

export function traefikIngressesToStackDefinitions(
  ingressDefinition: TraefikIngressDefinition
): StackDefinition {
  const composeObject = createComposeObject(ingressDefinition)
  const envVarNames = ['SECRET__CLOUDFLARE_DNS_API_TOKEN', 'SECRET__TRAEFIK_DASHBOARD_CREDENTIALS']
  const envVarDefinitions = extractEnvVarDefinitions(envVarNames, config)

  const requiredNetworks = ingressDefinition.exposeOnMacVlan
    ? [ingressDefinition.bridgeNetworkName, ingressDefinition.macvlanNetworkName]
    : [ingressDefinition.bridgeNetworkName]

  const dnsRecords = createDNSRecordDefinitions(ingressDefinition)

  return {
    stackName: ingressDefinition.stackName,
    composeObject: composeObject,
    envVars: envVarDefinitions,
    dnsRecords: dnsRecords,
    requiredNetworks: requiredNetworks,
  }
}

function createComposeObject(ingressDefinition: TraefikIngressDefinition): DockerCompose {
  const containerName = ingressDefinition.stackName
  const exposeOnMacVlan = ingressDefinition.macvlanNetworkName !== undefined
  const composeNetworks = exposeOnMacVlan
    ? {
        [ingressDefinition.bridgeNetworkName]: {
          external: true,
        },
        [ingressDefinition.macvlanNetworkName]: {
          external: true,
        },
      }
    : {
        [ingressDefinition.bridgeNetworkName]: {
          external: true,
        },
      }
  const serviceNetworks = exposeOnMacVlan
    ? {
        [ingressDefinition.bridgeNetworkName]: null,
        [ingressDefinition.macvlanNetworkName]: {
          ipv4_address: ingressDefinition.ipAddress,
        },
      }
    : {
        [ingressDefinition.bridgeNetworkName]: null,
      }

  // set up port mappings with the IP address from the bridge network if not macvlan
  const ports = exposeOnMacVlan
    ? undefined
    : [`${ingressDefinition.ipAddress}:80:80`, `${ingressDefinition.ipAddress}:443:443`]
  const imageName = config.get('image-name') ?? 'public.ecr.aws/docker/library/traefik'
  const imageTag = config.require('image-tag')
  const fullImageTag = `${imageName}:${imageTag}`
  return {
    version: '3.9',
    services: {
      traefik: {
        container_name: containerName,
        image: fullImageTag,
        restart: 'unless-stopped',
        security_opt: ['no-new-privileges:true'],
        ports: ports,
        command: [
          '--providers.docker=true',
          '--providers.docker.exposedbydefault=false',
          `--providers.docker.network=${ingressDefinition.bridgeNetworkName}`,
          `--providers.docker.constraints=Label(\`traefik.docker.network\`, \`${ingressDefinition.bridgeNetworkName}\`)`,
          '--api=true',
          '--log.level=INFO',
          '--entryPoints.web.address=:80',
          '--entryPoints.websecure.address=:443',
          '--entryPoints.websecure.asDefault=true',
          // TODO: to make this more generic, the resolver, environment variables and domains will need to be parameterized
          '--entryPoints.websecure.http.tls.certResolver=cloudflare',
          `--entryPoints.websecure.http.tls.domains[0].main=*.${baseDomain}`,
          `--entryPoints.websecure.http.tls.domains[0].sans=*.${ingressDefinition.networkBaseDomain}`,
          '--entryPoints.web.http.redirections.entryPoint.to=websecure',
          '--entryPoints.web.http.redirections.entryPoint.scheme=https',
          '--certificatesresolvers.cloudflare.acme.dnsChallenge=true',
          '--certificatesresolvers.cloudflare.acme.dnschallenge.provider=cloudflare',
          '--certificatesresolvers.cloudflare.acme.dnschallenge.resolvers=1.1.1.1:53,8.8.8.8:53',
          '--certificatesresolvers.cloudflare.acme.storage=/acme/acme.json',
        ],
        environment: {
          CLOUDFLARE_DNS_API_TOKEN: '$SECRET__CLOUDFLARE_DNS_API_TOKEN',
        },
        labels: [
          'traefik.enable=true',
          `traefik.docker.network=${ingressDefinition.bridgeNetworkName}`,
          `traefik.http.routers.${ingressDefinition.stackName}.rule=Host(\`${ingressDefinition.domainName}\`)`,
          `traefik.http.routers.${ingressDefinition.stackName}.service=api@internal`,
          `traefik.http.routers.${ingressDefinition.stackName}.middlewares=${ingressDefinition.stackName}-auth`,
          // echo $(htpasswd -nB user) | sed -e s/\\$/\\$\\$/g
          // TODO: make this something that is generated in code
          `traefik.http.middlewares.${ingressDefinition.stackName}-auth.basicauth.users=$\{SECRET__TRAEFIK_DASHBOARD_CREDENTIALS\}`,
        ],
        volumes: [
          '/var/run/docker.sock:/var/run/docker.sock',
          `${appDataBasePath}/${containerName}/:/acme`,
        ],
        networks: serviceNetworks,
      },
    },
    networks: composeNetworks,
  }
}

function createDNSRecordDefinitions(
  ingressDefinition: TraefikIngressDefinition
): DNSRecordDefinition[] {
  return [
    {
      name: ingressDefinition.stackName,
      type: 'A',
      ttl: 300,
      record: ingressDefinition.ipAddress,
      domain: ingressDefinition.domainName,
    },
  ]
}

export class TraefikStack extends Stack {
  public output: pulumi.Output<TraefikIngressDefinition>
  public static buildTraefikStack(
    ingressDefinition: TraefikIngressDefinition,
    networks: Network[]
  ): TraefikStack {
    const stackDefinition = traefikIngressesToStackDefinitions(ingressDefinition)
    return new TraefikStack(stackDefinition, ingressDefinition, networks)
  }

  constructor(
    args: StackDefinition,
    ingressDefinition: TraefikIngressDefinition,
    networks: Network[],
    opts?: pulumi.ComponentResourceOptions
  ) {
    super('TraefikStack', args, networks, opts)
    this.output = pulumi.all([this.stack.id, ...this.dnsRecords.map((r) => r.id)]).apply(() => {
      return ingressDefinition
    })
  }
}
