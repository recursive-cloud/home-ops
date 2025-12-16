import * as z from 'zod/v4'
import * as yaml from 'js-yaml'
import * as pulumi from '@pulumi/pulumi'

/**
 * TODO: Go through this only covering the options that are relevant to the current setup.
 * Make objects strictObjects so that errors are thrown if an unknown key is used and an update can be made
 * to the schema.
 *
 * Primarily remove options that relate to swarm mode, as this is not used in the current setup.
 */

const stringOrNumber = z.string().or(z.number())
const stringOrBoolean = z.string().or(z.boolean())
const stringOrList = z.string().or(z.array(z.string()))
const listOrDict = z
  .record(z.string(), z.string().or(z.number()).or(z.boolean()).or(z.null()))
  .or(z.array(z.string()))

const command = z
  .null()
  .or(z.string())
  .or(z.array(z.string()))
  .describe('Command to run in the container')

const envFile = z
  .string()
  .or(
    z.array(
      z.string().or(
        z.object({
          path: z.string(),
          format: z.string().optional(),
          required: stringOrBoolean.default(true).optional(),
        })
      )
    )
  )
  .describe('Add environment variables from a file')

const healthcheck = z
  .object({
    disable: stringOrBoolean.optional().describe('Disable any container-specified healthcheck'),
    interval: z.string().optional().describe('Time between running the check'),
    retries: stringOrNumber
      .optional()
      .describe('Number of consecutive failures needed to consider unhealthy'),
    test: z
      .string()
      .or(z.array(z.string()))
      .optional()
      .describe('The test to perform to check container health'),
    timeout: z.string().optional().describe('Maximum time to allow one check to run'),
    start_period: z.string().optional().describe('Start period for container to initialize'),
    start_interval: z
      .string()
      .optional()
      .describe('Time between running check during start period'),
  })
  .describe('Configure a health check for the container')

// const build = z
//   .string()
//   .or(
//     z.object({
//       context: z.string().optional().describe('Path to the build context'),
//       dockerfile: z.string().optional().describe('Name of the Dockerfile to use'),
//       dockerfile_inline: z.string().optional().describe('Inline Dockerfile content'),
//       args: listOrDict.optional().describe('Build-time variables'),
//       cache_from: z.array(z.string()).optional().describe('List of sources for cache resolution'),
//       cache_to: z.array(z.string()).optional().describe('Cache destinations'),
//       no_cache: stringOrBoolean.optional().describe('Do not use cache when building'),
//       network: z.string().optional().describe('Network mode for the build'),
//       pull: stringOrBoolean.optional().describe('Always attempt to pull newer version'),
//       target: z.string().optional().describe('Build stage to target'),
//       shm_size: stringOrNumber.optional().describe('Size of /dev/shm for build container'),
//       platforms: z.array(z.string()).optional().describe('Platforms to build for'),
//     })
//   )
//   .describe('Configuration options for building the service image')

const port = z
  .number()
  .or(z.string())
  .or(
    z.object({
      target: stringOrNumber.optional().describe('The port inside the container'),
      published: stringOrNumber.optional().describe('The publicly exposed port'),
      protocol: z.string().optional().describe('The port protocol (tcp or udp)'),
      mode: z.string().optional().describe('Port binding mode'),
      host_ip: z.string().optional().describe('The host IP address to bind the port to'),
    })
  )

const volume = z.string().or(
  z.object({
    type: z
      .enum(['bind', 'volume', 'tmpfs', 'cluster', 'npipe', 'image'])
      .describe('The mount type'),
    source: z.string().optional().describe('The source of the mount'),
    target: z.string().optional().describe('The path in the container where volume is mounted'),
    read_only: stringOrBoolean.optional().describe('Flag to set the volume as read-only'),
  })
)

const serviceNetworks = z
  .array(z.string())
  .or(
    z.record(
      z.string(),
      z
        .object({
          aliases: z
            .array(z.string())
            .optional()
            .describe('Alternative hostnames for this service'),
          ipv4_address: z.string().optional().describe('Specify a static IPv4 address'),
          ipv6_address: z.string().optional().describe('Specify a static IPv6 address'),
        })
        .or(z.null())
    )
  )
  .optional()
  .describe('Networks to join')

const service = z
  .object({
    // This is not optional here even though it is in the Docker Compose spec.
    image: z.string().describe('Specify the image to start the container from'),
    container_name: z.string().describe('Specify a custom container name'),
    command: command.optional(),
    entrypoint: command.optional().describe('Override the default entrypoint'),
    environment: listOrDict.optional().describe('Add environment variables'),
    env_file: envFile.optional(),
    ports: z.array(port).optional().describe('Expose container ports'),
    volumes: z.array(volume).optional().describe('Mount host paths or named volumes'),
    networks: serviceNetworks,
    depends_on: z
      .array(z.string())
      .or(
        z.record(
          z.string(),
          z.object({
            condition: z
              .enum(['service_started', 'service_healthy', 'service_completed_successfully'])
              .describe('Condition to wait for'),
            restart: stringOrBoolean.optional().describe('Whether to restart dependent services'),
            required: z
              .boolean()
              .default(true)
              .optional()
              .describe('Whether the dependency is required'),
          })
        )
      )
      .optional()
      .describe('Express dependency between services'),
    restart: z.string().optional().describe('Restart policy for the service container'),
    healthcheck: healthcheck.optional(),
    labels: listOrDict.optional().describe('Add metadata to containers using Docker labels'),
    expose: z.array(stringOrNumber).optional().describe('Expose ports without publishing to host'),
    dns: stringOrList.optional().describe('Custom DNS servers'),
    hostname: z.string().optional().describe('Define a custom hostname'),
    privileged: stringOrBoolean
      .optional()
      .describe('Give extended privileges to the service container'),
    user: z.string().optional().describe('Username or UID to run the container process as'),
    working_dir: z.string().optional().describe('The working directory for entrypoint or command'),
    stdin_open: stringOrBoolean.optional().describe('Keep STDIN open even if not attached'),
    tty: stringOrBoolean.optional().describe('Allocate a pseudo-TTY'),
    read_only: stringOrBoolean.optional().describe('Mount the container filesystem as read only'),
    init: stringOrBoolean.optional().describe('Run as an init process'),
    network_mode: z.string().optional().describe('Network mode'),
    cap_add: z.array(z.string()).optional().describe('Add Linux capabilities'),
    cap_drop: z.array(z.string()).optional().describe('Drop Linux capabilities'),
    security_opt: z.array(z.string()).optional().describe('Security options for the container'),
    devices: z
      .array(
        z.string().or(
          z.object({
            source: z.string().describe('Path on the host to the device'),
            target: z.string().optional().describe('Path in container where device will be mapped'),
            permissions: z.string().optional().describe('Cgroup permissions for the device'),
          })
        )
      )
      .optional()
      .describe('List of device mappings'),
    mem_limit: stringOrNumber.optional().describe('Memory limit for the container'),
    cpus: stringOrNumber.optional().describe('Number of CPUs to use'),
    platform: z.string().optional().describe('Target platform to run on'),
    profiles: z.array(z.string()).optional().describe('List of profiles for this service'),
    secrets: z
      .array(
        z.string().or(
          z.object({
            source: z.string().optional().describe('Name of the secret'),
            target: z.string().optional().describe('Path where secret will be mounted'),
            mode: stringOrNumber.optional().describe('File permission mode'),
          })
        )
      )
      .optional()
      .describe('Grant access to Secrets'),
    configs: z
      .array(
        z.string().or(
          z.object({
            source: z.string().optional().describe('Name of the config'),
            target: z.string().optional().describe('Path where config will be mounted'),
            mode: stringOrNumber.optional().describe('File permission mode'),
          })
        )
      )
      .optional()
      .describe('Grant access to Configs'),
    deploy: z
      .object({
        replicas: stringOrNumber.optional().describe('Number of replicas'),
        resources: z
          .object({
            limits: z
              .object({
                cpus: stringOrNumber.optional().describe('CPU limit'),
                memory: z.string().optional().describe('Memory limit'),
              })
              .optional(),
            reservations: z
              .object({
                cpus: stringOrNumber.optional().describe('CPU reservation'),
                memory: z.string().optional().describe('Memory reservation'),
              })
              .optional(),
          })
          .optional()
          .describe('Resource constraints and reservations'),
        restart_policy: z
          .object({
            condition: z.string().optional().describe('Condition for restarting'),
            delay: z.string().optional().describe('Delay between restart attempts'),
            max_attempts: stringOrNumber.optional().describe('Maximum number of restart attempts'),
          })
          .optional()
          .describe('Restart policy for service containers'),
      })
      .optional()
      .describe('Deployment configuration'),
  })
  .describe('Configuration for a service')

const networks = z.record(
  z.string(),
  z
    .object({
      external: z
        .boolean()
        .or(z.string())
        .or(
          z.object({
            name: z.string().optional(),
          })
        )
        .optional()
        .describe('Specifies that this network already exists'),
    })
    .describe('Network configuration')
)

const volumeDefinition = z
  .object({
    name: z.string().optional().describe('Custom name for this volume'),
    driver: z.string().optional().describe('Specify which volume driver should be used'),
    driver_opts: z
      .record(z.string(), stringOrNumber)
      .optional()
      .describe('Driver-specific options'),
    external: z
      .boolean()
      .or(z.string())
      .or(
        z.object({
          name: z.string().optional(),
        })
      )
      .optional()
      .describe('Specifies that this volume already exists'),
    labels: listOrDict.optional().describe('Add metadata to the volume using labels'),
  })
  .describe('Volume configuration')

const secret = z
  .object({
    name: z.string().optional().describe('Custom name for this secret'),
    file: z.string().optional().describe('Path to a file containing the secret value'),
    external: z
      .boolean()
      .or(z.string())
      .or(
        z.object({
          name: z.string().optional(),
        })
      )
      .optional()
      .describe('Specifies that this secret already exists'),
    labels: listOrDict.optional().describe('Add metadata to the secret using labels'),
  })
  .describe('Secret configuration')

const config = z
  .object({
    name: z.string().optional().describe('Custom name for this config'),
    content: z.string().optional().describe('Inline content of the config'),
    file: z.string().optional().describe('Path to a file containing the config value'),
    external: z
      .boolean()
      .or(z.string())
      .or(
        z.object({
          name: z.string().optional(),
        })
      )
      .optional()
      .describe('Specifies that this config already exists'),
    labels: listOrDict.optional().describe('Add metadata to the config using labels'),
  })
  .describe('Config configuration')

const dockerComposeSchema = z
  .object({
    version: z.string().optional().describe('Declared for backward compatibility, ignored'),
    name: z.string().optional().describe('Define the Compose project name'),
    services: z
      .record(z.string(), service)
      .describe('The services that will be used by your application'),
    networks: networks.optional().describe('Networks that are shared among multiple services'),
    volumes: z
      .record(z.string(), volumeDefinition)
      .optional()
      .describe('Named volumes that are shared among multiple services'),
    secrets: z
      .record(z.string(), secret)
      .optional()
      .describe('Secrets that are shared among multiple services'),
    configs: z
      .record(z.string(), config)
      .optional()
      .describe('Configurations that are shared among multiple services'),
  })
  .describe('The Compose file is a YAML file defining a multi-containers based application')

export type DockerCompose = z.infer<typeof dockerComposeSchema>
export type Service = z.infer<typeof service>
export type ServiceNetworks = z.infer<typeof serviceNetworks>
//export type ComposeNetworks = z.infer<typeof networks>
// export type Volume = z.infer<typeof volumeDefinition>
// export type Secret = z.infer<typeof secret>
// export type Config = z.infer<typeof config>

export function parseComposeFile(rawComposeFileContent: string): DockerCompose {
  const parsed = dockerComposeSchema.safeParse(yaml.load(rawComposeFileContent))
  if (!parsed.success) {
    throw new Error(`Invalid Docker Compose configuration: ${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

export function getEnvironmentVariables(
  compose: pulumi.Input<DockerCompose>
): pulumi.Output<Record<string, string | null>> {
  return pulumi.output(compose).apply((compose: DockerCompose) => {
    const services = Object.values(compose.services)
    const initalValue: Record<string, string | null> = {}
    return services.reduce((acc: Record<string, string | null> = {}, service: Service) => {
      const serviceEnv = getEnvironmentVariablesForService(service)
      Object.entries(serviceEnv).forEach(([key, value]) => {
        if (acc[key] !== undefined) {
          if ((acc[key] !== null && value === null) || (acc[key] === null && value !== null)) {
            throw new pulumi.RunError(
              `Environment variable ${key} is defined with a value in one service and without a value in another service`
            )
          }
        }
      })
      return { ...acc, ...serviceEnv }
    }, initalValue)
  })
}

function getEnvironmentVariablesForService(service: Service): Record<string, string | null> {
  if (service.environment === undefined) {
    return {}
  }
  const initialValue: Record<string, string | null> = {}
  if (Array.isArray(service.environment)) {
    return service.environment.reduce((acc, envVar) => {
      if (envVar.includes('=')) {
        const [key, ...valueParts] = envVar.split('=')
        acc[key] = valueParts.join('=') // In case the value contains '='
      } else {
        acc[envVar] = null // Value to be taken from the environment
      }
      return acc
    }, initialValue)
  } else {
    return Object.entries(service.environment).reduce((acc, [key, value]) => {
      if (value === null) {
        acc[key] = null // Value to be taken from the environment
      } else {
        acc[key] = String(value)
      }
      return acc
    }, initialValue)
  }
}
