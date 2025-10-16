import * as pulumi from '@pulumi/pulumi'
import * as portainer from '@pulumi/portainer'
import * as yaml from 'js-yaml'
import { portainerProvider, portainerEndpointId } from './providers'
import { DockerCompose } from './compose'
import { Network } from './networks'
import { EnvVarDefinition, createEnvVars } from './envVars'
import { DNSRecordDefinition, createDNSRecord } from './dns'
import { DnsRecord } from '@pulumi/unifi'

export type StackDefinition = {
  stackName: string
  composeObject: DockerCompose
  envVars: EnvVarDefinition[]
  dnsRecords: DNSRecordDefinition[]
  requiredNetworks: string[] // list of network names that must be present in the compose file
}

export abstract class Stack extends pulumi.ComponentResource {
  protected stack: portainer.Stack
  protected dnsRecords: DnsRecord[]
  constructor(
    type: string,
    args: StackDefinition,
    networks: Network[],
    opts?: pulumi.ComponentResourceOptions
  ) {
    super(`recursive-cloud:${type}`, args.stackName, args, opts)

    const networkDependencies = networks
      .filter((network) => args.requiredNetworks.includes(network.fullName))
      .map((network) => network.networkResource)
      .filter((n) => n !== undefined)

    const composeFileYaml = pulumi.output(args.composeObject).apply(yaml.dump)
    const envVars = createEnvVars(args.stackName, args.envVars, this)
    this.stack = new portainer.Stack(
      `stack-${args.stackName}`,
      {
        endpointId: portainerEndpointId,
        name: args.stackName,
        deploymentType: 'standalone',
        method: 'string',
        stackFileContent: composeFileYaml,
        envs: envVars,
      },
      {
        provider: portainerProvider,
        parent: this,
        dependsOn: networkDependencies,
      }
    )

    this.dnsRecords = args.dnsRecords.map((dnsRecord) => createDNSRecord(dnsRecord, this))

    this.registerOutputs({
      stack: this.stack.id,
      dnsRecords: pulumi.all(this.dnsRecords.map((r) => r.id)),
    })
  }
}
