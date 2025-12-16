import * as pulumi from '@pulumi/pulumi'
import * as portainer from '@pulumi/portainer'
import * as unifi from '@pulumi/unifi'

const config = new pulumi.Config('portainer')

const apiKey = config.require('portainer-api-key')
const portainerEndpoint = config.require('portainer-endpoint')

export const portainerEndpointId = config.getNumber('portainer-endpoint-id') || 3 // Default to 3

export const portainerProvider = new portainer.Provider(
  'default',
  {
    endpoint: portainerEndpoint,
    apiKey: apiKey,
  },
  { aliases: [{ name: 'portainer' }] }
)

export const unifiProvider = new unifi.Provider('default', {
  allowInsecure: true,
  apiKey: config.requireSecret('unifi-api-key'),
  apiUrl: config.require('unifi-api-url'),
  site: 'default',
})
