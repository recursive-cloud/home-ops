import * as fs from 'fs'
import * as pulumi from '@pulumi/pulumi'
import { config, portainerHostName } from './config'
import { remote, types } from '@pulumi/command'

export function getStackComposeFile(stackName: string): string {
  return fs.readFileSync(`./stacks/docker-compose.${stackName}.yaml`, {
    encoding: 'utf8',
  })
}

export function stackConfigDirectoryExists(stackName: string): boolean {
  return fs.existsSync(`./stacks/${stackName}`)
}

export function uploadStackConfigDirectory(
  stackName: string,
  parent: pulumi.ComponentResource
): remote.CopyToRemote {
  const connection: types.input.remote.ConnectionArgs = {
    host: portainerHostName,
    user: 'portainer', // TODO: make configurable
    privateKey: config.requireSecret('config-upload-ssh-key'),
    port: config.requireNumber('config-upload-ssh-port'),
  }

  const validateRemote = new remote.Command(
    `validate-remote-dir-${stackName}`,
    {
      connection: connection,
      create: `[ -d "/app-config/${stackName}" ] && { echo "Error: Directory '/app-config/${stackName}' already exists on remote host."; exit 1; } || exit 0`,
      delete: `rm -rf /app-config/${stackName}`,
    },
    { parent: parent }
  )

  return new remote.CopyToRemote(
    `copy-config-dir-${stackName}`,
    {
      connection: connection,
      source: new pulumi.asset.FileArchive(`./stacks/${stackName}`),
      remotePath: `/app-config`,
    },
    { parent: parent, dependsOn: [validateRemote] }
  )
}
