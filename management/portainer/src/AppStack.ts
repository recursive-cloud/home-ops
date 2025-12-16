import * as pulumi from '@pulumi/pulumi'
import { parseComposeFile } from './compose'
import { Network, NetworkDefinition, validateDockerComposeNetworks } from './networks'
import { TraefikIngressDefinition } from './TraefikStack'
import { getStackComposeFile } from './file'
import {
  extractEnvVarDefinitions,
  extractEnvVarsFromComposeFile,
} from './envVars'
import { Stack, StackDefinition } from './stack'
import { extractDNSRecordsFromComposeObject } from './dns'

export function buildAppStackDefinitions(
  stackNames: string[],
  networks: NetworkDefinition[],
  traefikStacks: TraefikIngressDefinition[]
): StackDefinition[] {
  return stackNames.map((stackName) => {
    const stackConfig = new pulumi.Config(`portainer.${stackName}`)
    const rawComposeFile = getStackComposeFile(stackName)
    const extractedEnvVarNames = extractEnvVarsFromComposeFile(rawComposeFile)
    const envVarDefinitions = extractEnvVarDefinitions(extractedEnvVarNames, stackConfig)
    const composeObject = parseComposeFile(rawComposeFile)
    // extract dns records from traefik labels and custom labels
    const dnsRecordDefinitions = extractDNSRecordsFromComposeObject(
      stackName,
      composeObject,
      networks,
      traefikStacks
    )
    // validate networks and return list of network names required by this compose file
    const requiredNetworks = validateDockerComposeNetworks(stackName, composeObject, networks)
    return {
      stackName: stackName,
      composeObject: composeObject,
      envVars: envVarDefinitions,
      dnsRecords: dnsRecordDefinitions,
      requiredNetworks: requiredNetworks,
    }
  })
}

export class AppStack extends Stack {
  constructor(
    args: StackDefinition,
    networks: Network[],
    opts?: pulumi.ComponentResourceOptions
  ) {
    super('AppStack', args, networks, opts)
  }
}
