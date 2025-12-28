import * as cloudflare from '@pulumi/cloudflare'

/**
 * The Cloudflare provider instance used for all Cloudflare resources.
 *
 * Provider configuration must be provided via Pulumi ESC environment variables:
 *
 * CLOUDFLARE_API_TOKEN - The API token to use for authentication.
 */
export const cloudflareProvider = new cloudflare.Provider('default')
