import { extractNetworkDefinitions, createNetworks } from './src/networks'
import { TraefikStack, extractTraefikIngressDefinitions } from './src/TraefikStack'
import { buildAppStackDefinitions, AppStack } from './src/AppStack'
import { config } from './src/config'

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

traefikIngressDefinitions.forEach((ingressConfig) => {
  TraefikStack.buildTraefikStack(ingressConfig, networks)
})

appStackDefinitions.forEach((stackConfig) => {
  new AppStack(stackConfig, networks)
})
