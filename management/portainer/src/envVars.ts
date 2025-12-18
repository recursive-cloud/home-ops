import * as pulumi from '@pulumi/pulumi'
import * as random from '@pulumi/random'
import * as portainer from '@pulumi/portainer'

type ConfigEnvVar = {
  type: 'config'
  name: string
  value: string
}

type SecretEnvVar = {
  type: 'secret'
  name: string
  value: pulumi.Output<string>
}

type GeneratedPasswordEnvVar = {
  type: 'generated-password'
  name: string
  key: string
  length: number
  special: boolean
  numeric: boolean
  lower: boolean
  upper: boolean
}

type GeneratedBase64BytesEnvVar = {
  type: 'generated-base64-bytes'
  name: string
  key: string
  length: number
}

export type EnvVarDefinition =
  | ConfigEnvVar
  | SecretEnvVar
  | GeneratedPasswordEnvVar
  | GeneratedBase64BytesEnvVar

export function extractEnvVarsFromComposeFile(rawComposeFile: string): string[] {
  const envVars = new Set<string>()

  // ${VAR} (not preceded by $)
  const bracedRegex = /(?<!\$)\$\{([A-Za-z_][A-Za-z0-9_]*)}/g
  // $VAR (not preceded by $)
  const unbracedRegex = /(?<!\$)\$([A-Za-z_][A-Za-z0-9_]*)/g

  for (const match of rawComposeFile.matchAll(bracedRegex)) {
    envVars.add(match[1])
  }

  for (const match of rawComposeFile.matchAll(unbracedRegex)) {
    envVars.add(match[1])
  }

  return Array.from(envVars)
}

export function extractEnvVarDefinitions(
  envVarNames: string[],
  config: pulumi.Config
): EnvVarDefinition[] {
  return envVarNames.map((envVarName) => {
    if (envVarName.startsWith('SECRET__')) {
      const configKey = envVarName.replace('SECRET__', '').replace(/_/g, '-').toLowerCase()
      const secretValue = config.requireSecret(configKey)
      return {
        type: 'secret',
        name: envVarName,
        value: secretValue,
      }
    } else if (envVarName.startsWith('GEN_PASS_')) {
      const envVarParts = envVarName.split('__')
      const configKey = envVarParts[1].replace(/_/g, '-').toLowerCase()
      const passwordConfigParts = envVarParts[0].split('_')
      const length = passwordConfigParts[2] !== undefined ? parseInt(passwordConfigParts[2]) : 24
      const characterSelections = passwordConfigParts[3] || 'SNLU' // default to all character types if none specified
      const special = characterSelections.includes('S')
      const numeric = characterSelections.includes('N')
      const lower = characterSelections.includes('L')
      const upper = characterSelections.includes('U')
      return {
        type: 'generated-password',
        name: envVarName,
        key: configKey,
        length: length,
        special: special,
        numeric: numeric,
        lower: lower,
        upper: upper,
      }
    } else if (envVarName.startsWith('GEN_BASE64_')) {
      const envVarParts = envVarName.split('__')
      const configKey = envVarParts[1].replace(/_/g, '-').toLowerCase()
      const byteConfigParts = envVarParts[0].split('_')
      const length = byteConfigParts[2] !== undefined ? parseInt(byteConfigParts[2]) : 32
      return {
        type: 'generated-base64-bytes',
        name: envVarName,
        key: configKey,
        length: length,
      }
    } else {
      const configKey = envVarName.replace(/_/g, '-').toLowerCase()
      const configValue = config.require(configKey)
      return {
        type: 'config',
        name: envVarName,
        value: configValue,
      }
    }
  })
}

export function createEnvVars(
  stackName: string,
  envVars: EnvVarDefinition[],
  parent: pulumi.ComponentResource
): portainer.types.input.StackEnv[] {
  return envVars.map((envVar) => {
    switch (envVar.type) {
      case 'config':
      case 'secret':
        return {
          name: envVar.name,
          value: envVar.value,
        }
      case 'generated-password':
        const password = new random.RandomPassword(
          `random-password-${stackName}-${envVar.key}`,
          {
            length: envVar.length,
            special: envVar.special,
            number: envVar.numeric,
            lower: envVar.lower,
            upper: envVar.upper,
          },
          { parent: parent, protect: true }
        )
        return {
          name: envVar.name,
          value: password.result,
        }
      case 'generated-base64-bytes':
        const bytes = new random.RandomBytes(
          `random-bytes-${stackName}-${envVar.key}`,
          {
            length: envVar.length,
          },
          { parent: parent, protect: true }
        )
        return {
          name: envVar.name,
          value: bytes.base64,
        }
    }
  })
}
