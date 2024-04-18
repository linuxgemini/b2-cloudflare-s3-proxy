import { AwsClient } from "aws4fetch";

import { SignatureInvalidException, SignatureMissingException } from "./abstractErrors";

/**
 * Extract the region from the endpoint
 * @param {string} AWS_S3_ENDPOINT
 * @returns {string?}
 */
const getBackblazeB2S3CompatRegion = (AWS_S3_ENDPOINT) => {
    const endpointRegex = /^s3\.([a-zA-Z0-9-]+)\.backblazeb2\.com$/;
    const [ , aws_region ] = AWS_S3_ENDPOINT.match(endpointRegex);
    return aws_region;
};

export class AbstractBackblazeB2S3CompatClient extends AwsClient {
    /**
     * @param {string} AWS_ACCESS_KEY_ID
     * @param {string} AWS_SECRET_ACCESS_KEY
     * @param {string} AWS_S3_ENDPOINT
     */
    constructor(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_ENDPOINT) {
        super({
            "accessKeyId": AWS_ACCESS_KEY_ID,
            "secretAccessKey": AWS_SECRET_ACCESS_KEY,
            "service": "s3",
            "region": getBackblazeB2S3CompatRegion(AWS_S3_ENDPOINT),
        });
    }

    /**
     * Verify the signature on the incoming request
     * @param {import("@cloudflare/workers-types").Request} request
     */
    async _cmd_verifySignature(request) {
        const authorization = request.headers.get("Authorization");
        if (!authorization) {
            throw new SignatureMissingException(403, "Missing signature");
        }

        // Parse the AWS V4 signature value
        const re = /^AWS4-HMAC-SHA256 Credential=([^,]+),\s*SignedHeaders=([^,]+),\s*Signature=(.+)$/;
        let [ , credential, signedHeaders, signature ] = authorization.match(re); // eslint-disable-line prefer-const

        credential = credential.split("/");
        signedHeaders = signedHeaders.split(";");

        // Verify that the request was signed with the expected key
        if (credential[0] != this.accessKeyId) {
            throw new SignatureInvalidException(403, "Request is signed with wrong accessKeyId");
        }

        // Use the timestamp from the incoming signature
        const datetime = request.headers.get("x-amz-date");

        // Extract the headers that we want from the complete set of incoming headers
        const headersToSign = signedHeaders
            .map(key => ({
                name: key,
                value: request.headers.get(key),
            }))
            .reduce((obj, item) => (obj[item.name] = item.value, obj), {});

        const signedRequest = await this.sign(request.url, {
            method: request.method,
            headers: headersToSign,
            body: request.body,
            aws: { datetime: datetime, allHeaders:true },
        });

        // All we need is the signature component of the Authorization header
        const [ , , , generatedSignature] = signedRequest.headers.get("Authorization").match(re);

        if (signature !== generatedSignature) {
            throw new SignatureInvalidException(403, "Calculated signature does not match the request signature");
        }
    }

}
