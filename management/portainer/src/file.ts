import * as fs from 'fs'

export function getStackComposeFile(stackName: string): string {
  return fs.readFileSync(`./stacks/docker-compose.${stackName}.yaml`, {
    encoding: 'utf8',
  })
}
