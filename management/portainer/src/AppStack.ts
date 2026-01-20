import * as pulumi from '@pulumi/pulumi'
import {
  ensureServicesCanAccessConfigDir,
  parseComposeFile,
  ensureComposeWithIPv6,
} from './compose'
import { Network, NetworkDefinition, validateDockerComposeNetworks } from './networks'
import { TraefikIngressDefinition } from './TraefikStack'
import { getStackComposeFile } from './file'
import {
  extractEnvVarDefinitions,
  extractEnvVarsFromComposeFile,
  getBuiltInEnvVarDefinitions,
} from './envVars'
import { Stack, StackDefinition } from './Stack'
import { extractDNSRecordsFromComposeObject } from './dns'
import { stackConfigDirectoryExists } from './file'

export function buildAppStackDefinitions(
  stackNames: string[],
  networks: NetworkDefinition[],
  traefikStacks: TraefikIngressDefinition[]
): StackDefinition[] {
  return stackNames.map((stackName) => {
    const stackConfig = new pulumi.Config(`portainer.${stackName}`)
    const rawComposeFile = getStackComposeFile(stackName)
    const configDirExists = stackConfigDirectoryExists(stackName)
    const builtInEnvVars = getBuiltInEnvVarDefinitions(stackName, configDirExists)
    const extractedEnvVarNames = extractEnvVarsFromComposeFile(rawComposeFile)
    // if the stack config directory exists, the directory on the host file system needs to be an env var
    // stack definition will need an optional upload config dir boolean
    // also add group_add to the compose object to ensure the files will be readable by the container process
    const envVarDefinitions = extractEnvVarDefinitions(
      extractedEnvVarNames,
      builtInEnvVars,
      stackConfig
    )
    const composeObject = parseComposeFile(rawComposeFile)

    // Ensure compose object has IPv6 addresses for macvlan networks with IPv6 enabled
    const composeWithIPv6 = ensureComposeWithIPv6(stackName, composeObject, networks)

    // extract dns records from traefik labels and custom labels
    const dnsRecordDefinitions = extractDNSRecordsFromComposeObject(
      stackName,
      composeWithIPv6,
      envVarDefinitions,
      networks,
      traefikStacks
    )
    // validate networks and return list of network names required by this compose file
    const requiredNetworks = validateDockerComposeNetworks(stackName, composeWithIPv6, networks)
    const configDirEnabledDockerCompose = configDirExists
      ? ensureServicesCanAccessConfigDir(composeWithIPv6)
      : composeWithIPv6
    return {
      stackName: stackName,
      composeObject: configDirEnabledDockerCompose,
      envVars: envVarDefinitions,
      dnsRecords: dnsRecordDefinitions,
      requiredNetworks: requiredNetworks,
      uploadConfigDir: configDirExists,
    }
  })
}

export class AppStack extends Stack {
  constructor(args: StackDefinition, networks: Network[], opts?: pulumi.ComponentResourceOptions) {
    super('AppStack', args, networks, opts)
  }
}
