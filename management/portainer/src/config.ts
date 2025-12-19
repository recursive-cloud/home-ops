import * as pulumi from '@pulumi/pulumi'

export const config = new pulumi.Config('portainer')

export const portainerHostName = config.require('portainer-hostname')
