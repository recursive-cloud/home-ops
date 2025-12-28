# WebFinger Cloudflare Integration

This project provides a simple way to expose WebFinger endpoints using Cloudflare Workers, based on [RFC7033 Section 4.4](https://datatracker.ietf.org/doc/html/rfc7033#section-4.4).

## Usage

**Task:**  
Deploy the worker to your Cloudflare account. Once deployed, you can query the WebFinger endpoint:

```sh
curl "https://<your-domain>/.well-known/webfinger?resource=acct:username@your-domain"
```

The worker will respond with a JSON Resource Descriptor as specified in RFC7033.

## Reference

- [RFC7033 Section 4.4](https://datatracker.ietf.org/doc/html/rfc7033#section-4.4)
- Cloudflare Workers documentation
