type JRD = {
  subject: string
  links: {
    rel: string
    href: string
  }[]
}

export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/.well-known/webfinger') {
      return new Response('Not found', { status: 404 })
    }

    const resource = url.searchParams.get('resource')
    if (!resource) {
      return new Response('Bad request', { status: 400 })
    }

    const resourceEnvKey = resource.replace(/[:/@]/g, '_').toUpperCase()
    const rawJRD = env[resourceEnvKey]
    if (!rawJRD) {
      return new Response('Not found', { status: 404 })
    }
    const jrd: JRD = JSON.parse(rawJRD)

    const searchParamRels = url.searchParams.getAll('rel')
    const rels =
      searchParamRels.length > 0 ? searchParamRels : ['http://openid.net/specs/connect/1.0/issuer']

    return Response.json({
      subject: jrd.subject,
      links: jrd.links.filter((link) => rels.includes(link.rel)),
    })
  },
}
