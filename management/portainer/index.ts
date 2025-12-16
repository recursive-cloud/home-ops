import * as pulumi from '@pulumi/pulumi'
import { extractNetworkDefinitions, createNetworks } from './src/networks'
import { TraefikStack, extractTraefikIngressDefinitions } from './src/TraefikStack'
import { buildAppStackDefinitions, AppStack } from './src/AppStack'

const config = new pulumi.Config('portainer')

const networkDefinitions = extractNetworkDefinitions(config.requireObject<unknown[]>('networks'))

const traefikIngressDefinitions = extractTraefikIngressDefinitions(
  config.requireObject<unknown[]>('traefik-ingresses'),
  networkDefinitions
)

const appStackNames = config.requireObject<string[]>('stacks')

const appStackDefinitions = buildAppStackDefinitions(
  appStackNames,
  networkDefinitions,
  traefikIngressDefinitions
)

// Make these components with their own validation methods and outputs
const networks = createNetworks(networkDefinitions)

const traefikIngressOutputs = traefikIngressDefinitions
  .map((ingressConfig) => {
    return TraefikStack.buildTraefikStack(ingressConfig, networks)
  })
  .map((stack) => stack.output)

appStackDefinitions.map((stackConfig) => {
  return new AppStack(stackConfig, networks)
})

export = {
  networks: networkDefinitions,
  'traefik-ingresses': traefikIngressOutputs,
}
