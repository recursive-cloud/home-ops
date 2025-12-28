import * as pulumi from '@pulumi/pulumi'
import * as cloudflare from '@pulumi/cloudflare'
import { config } from './config'
import { cloudflareProvider } from './provider'

const accountName = config.require('account-name')

export const accountId: pulumi.Output<string> = cloudflare
  .getAccountOutput({ filter: { name: accountName } }, { provider: cloudflareProvider })
  .apply((account) => {
    if (account.accountId === undefined) {
      throw new pulumi.RunError(`Cloudflare account "${accountName}" not found`)
    }
    return account.accountId
  })
