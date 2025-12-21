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
  const remotePath = config.require('config-uploader-mount-path')
  const connection: types.input.remote.ConnectionArgs = {
    host: portainerHostName,
    user: config.require('config-upload-ssh-username'),
    privateKey: config.requireSecret('config-upload-ssh-key'),
    port: config.requireNumber('config-upload-ssh-port'),
  }

  const validateRemote = new remote.Command(
    `validate-remote-dir-${stackName}`,
    {
      connection: connection,
      create: `[ -d "${remotePath}/${stackName}" ] && { echo "Error: Directory '${remotePath}/${stackName}' already exists on remote host."; exit 1; } || exit 0`,
      delete: `rm -rf ${remotePath}/${stackName}`,
    },
    { parent: parent }
  )

  return new remote.CopyToRemote(
    `copy-config-dir-${stackName}`,
    {
      connection: connection,
      source: new pulumi.asset.FileArchive(`./stacks/${stackName}`),
      remotePath: `${remotePath}`,
    },
    { parent: parent, dependsOn: [validateRemote] }
  )
}
