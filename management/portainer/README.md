## Importing DNS records from Unifi

```
pulumi import unifi:index/dnsRecord:DnsRecord dns-record-home-traefik default:686134bfb39e5c0b6d865b8a --provider 'urn:pulumi:mgmt::portainer::pulumi:providers:unifi::default'
```

The format is: `<site>:<dns-record-id>`. The id can be found via the unifi controller UI. Open dev tools, manage the DNS records and pause the record.

**Need to make sure that a fresh checkout will install the terraform providers and generated SDKs**

## Setting up storage for apps


## Setting up network to access VLAN


## Pulumi using any terraform provider

```
pulumi package add terraform-provider filipowm/unifi
```

```
pulumi package add terraform-provider portainer/portainer
```
