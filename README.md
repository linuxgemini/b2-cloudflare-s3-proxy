# b2-cloudflare-s3-proxy

Psuedo-passthrough Cloudflare Workers proxy for the S3 compliant API of Backblaze B2 including Zonal `PUT` requests.

This repository is a modern-ish merging and expansion of Backblaze's examples hosted at https://github.com/backblaze-b2-samples/cloudflare-b2-proxy and https://github.com/backblaze-b2-samples/cloudflare-b2

Check out `wrangler.template.toml` for configuration details. To summarize:

 - You _must_ set `AWS_S3_ENDPOINT`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

 - You _must_ have a domain in Cloudflare DNS, as Custom Domains functionality is required.

 - Downstream (incoming) requests _other than `GET`, `HEAD` and `OPTIONS`_ ***always*** has to be signed with the same credentials that you configure in the worker. The worker validates the AWS V4 signature on the downstream requests and then signs the upstream (outgoing) request.

 - If you disable `ALLOW_UNAUTHENTICATED_PULLS`, _every_ downstream request has to be signed with the same credentials that you configure in the worker.

## Regarding secrets

See https://developers.cloudflare.com/workers/configuration/secrets/ for an intro about Secret variables.

To add them, you can do the following commands:

 - `echo "<your b2 application key id>" | npx wrangler secret put AWS_ACCESS_KEY_ID`

 - `echo "<your b2 application key>" | npx wrangler secret put AWS_SECRET_ACCESS_KEY`

## License

```
MIT License

Copyright (c) 2024 İlteriş Yağıztegin Eroğlu (linuxgemini) <ilteris@asenkron.com.tr>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Important

As stated in the license above, there is no warranty. If this code breaks, do report it but don't expect an immediate fix either.
