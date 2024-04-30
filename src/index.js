/**
 * b2-cloudflare-s3-proxy
 *
 * Psuedo-passthrough Cloudflare Workers proxy for the S3 compliant
 * API of Backblaze B2 including Zonal `PUT` requests.
 *
 * This repository is a modern-ish merging and expansion of Backblaze's
 * examples hosted at https://github.com/backblaze-b2-samples/cloudflare-b2-proxy
 * and https://github.com/backblaze-b2-samples/cloudflare-b2
 *
 * @author İlteriş Yağıztegin Eroğlu (linuxgemini) <ilteris@asenkron.com.tr>
 * @license
 * Copyright 2024 İlteriş Yağıztegin Eroğlu (linuxgemini) <ilteris@asenkron.com.tr>
 * SPDX-License-Identifier: MIT
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { AbstractBackblazeB2S3CompatClient } from "./s3Handler";
import { SignatureMissingException } from "./abstractErrors";
import { generateAccessDeniedMessage, generateServerErrorMessage, generateValidationFailureMessage } from "./textGenerators";
import { v4 as uuidv4 } from "uuid";

// How many times to retry a range request where the response is missing content-range
const RANGE_RETRY_ATTEMPTS = 3;

const DEFAULT_ERROR_RESPONSE_HEADERS = {
    "Content-Type": "application/xml",
    "Cache-Control": "max-age=0, no-cache, no-store",
};

const DEFAULT_ERROR_RESPONSE_CONFIG = (status = 403) => {
    return {
        status,
        headers: DEFAULT_ERROR_RESPONSE_HEADERS,
    };
};

const UNSIGNABLE_HEADERS = [
    // These headers appear in the request, but are not passed upstream
    "x-forwarded-proto",
    "x-real-ip",
    // (linuxgemini): this is something i add via configuration rules
    "x-true-client-ip",
    // We can't include accept-encoding in the signature because Cloudflare
    // sets the incoming accept-encoding header to "gzip, br", then modifies
    // the outgoing request to set accept-encoding to "gzip".
    // Not cool, Cloudflare!
    "accept-encoding",
    // (linuxgemini): just to make sure we do not accidentally keep anything misconfigured
    "host",
];

/**
 * Filter out cf-* and any other headers we don't want to include in the signature
 * @param {import("@cloudflare/workers-types").Headers} headers
 * @returns {Array<string, string>[]}
 */
const filterHeaders = (headers) => {
    return new Headers(Array.from(headers.entries())
        .filter(pair =>
            !UNSIGNABLE_HEADERS.includes(pair[0])
            && !pair[0].startsWith("cf-"),
        ));
};

export default {
    /** @type {import("@cloudflare/workers-types").ExportedHandlerFetchHandler} */
    async fetch(request, env, ctx) { // eslint-disable-line no-unused-vars
        const requestIdentifier = uuidv4();

        if (!env["AWS_ACCESS_KEY_ID"] || !env["AWS_SECRET_ACCESS_KEY"] || !env["AWS_S3_ENDPOINT"] || !env["AWS_S3_BUCKET"]) {
            return new Response(generateServerErrorMessage("Server not configured"), {
                status: 500,
                headers: DEFAULT_ERROR_RESPONSE_HEADERS,
            });
        }

        const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_ENDPOINT, AWS_S3_BUCKET } = env;
        const aws = new AbstractBackblazeB2S3CompatClient(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_ENDPOINT);

        // Set upstream target hostname.
        const url = new URL(request.url);
        url.protocol = "https:";
        url.hostname = (url.hostname.startsWith(`${AWS_S3_BUCKET}.`) ? `${AWS_S3_BUCKET}.${AWS_S3_ENDPOINT}` : AWS_S3_ENDPOINT);
        url.port = "443";

        const alwaysValidate = (env["ALLOW_UNAUTHENTICATED_PULLS"] !== "true");
        const requestHasAuthorizationHeader = request.headers.has("Authorization");
        const methodAlwaysRequiresAuthorization = !["GET", "HEAD", "OPTIONS"].includes(request.method);

        let signUpstreamRequestEvenOnUnauthenticatedPulls = false;
        let allowRootPathCallsEvenOnUnauthenticatedPulls = false;
        if (!alwaysValidate) {
            signUpstreamRequestEvenOnUnauthenticatedPulls = (env["ALLOW_UNAUTHENTICATED_SIGNED_PULLS"] === "true");
            allowRootPathCallsEvenOnUnauthenticatedPulls = (env["ALLOW_UNAUTHENTICATED_LISTING_CALLS"] === "true");
        }

        if (!allowRootPathCallsEvenOnUnauthenticatedPulls && url.pathname.match(/\/+$/)) {
            return new Response(generateAccessDeniedMessage(), DEFAULT_ERROR_RESPONSE_CONFIG());
        }

        // Certain headers appear in the incoming request but are
        // removed from the outgoing request. If they are in the
        // signed headers, B2 can't validate the signature.
        const filteredHeaders = filterHeaders(request.headers);

        // default request is always unsigned, with headers filtered
        let requestToSend = new Request(url, {
            method: request.method,
            headers: filteredHeaders,
            body: request.body,
        });

        if (signUpstreamRequestEvenOnUnauthenticatedPulls) {
            // Sign the new request
            const signedRequest = await aws.sign(url, {
                method: request.method,
                headers: filteredHeaders,
                body: request.body,
            });

            // Send the signed request
            requestToSend = signedRequest;
        }

        if (alwaysValidate || requestHasAuthorizationHeader || methodAlwaysRequiresAuthorization) {
            // Only handle requests signed by our configured key.
            try {
                await aws._cmd_verifySignature(request);
            } catch (e) {
                const message = e.message || undefined;
                const code = e.code || 403;

                // Signature is missing or bad - deny the request
                return new Response(
                    ((e instanceof SignatureMissingException) ?
                        generateAccessDeniedMessage(message) :
                        generateValidationFailureMessage(message, requestIdentifier)),
                    DEFAULT_ERROR_RESPONSE_CONFIG(code),
                );
            }

            // Sign the new request
            const signedRequest = await aws.sign(url, {
                method: request.method,
                headers: filteredHeaders,
                body: request.body,
            });

            // Send the signed request
            requestToSend = signedRequest;
        }

        // For large files, Cloudflare will return the entire file, rather than the requested range
        // So, if there is a range header in the request, check that the response contains the
        // content-range header. If not, abort the request and try again.
        // See https://community.cloudflare.com/t/cloudflare-worker-fetch-ignores-byte-request-range-on-initial-request/395047/4
        if (requestToSend.headers.has("range")) {
            let attempts = RANGE_RETRY_ATTEMPTS;
            let response;
            do {
                const controller = new AbortController();
                response = await fetch(requestToSend.url, {
                    method: requestToSend.method,
                    headers: requestToSend.headers,
                    signal: controller.signal,
                });
                if (response.headers.has("content-range")) {
                    // Only log if it didn't work first time
                    if (attempts < RANGE_RETRY_ATTEMPTS) {
                        console.log(`Retry for ${requestToSend.url} succeeded - response has content-range header`);
                    }
                    // Break out of loop and return the response
                    break;
                } else if (response.ok) {
                    attempts -= 1;
                    console.error(`Range header in request for ${requestToSend.url} but no content-range header in response. \
Will retry ${attempts} more times`);
                    // Do not abort on the last attempt, as we want to return the response
                    if (attempts > 0) {
                        controller.abort();
                    }
                } else {
                    // Response is not ok, so don't retry
                    break;
                }
            } while (attempts > 0);

            if (attempts <= 0) {
                console.error(`Tried range request for ${requestToSend.url} ${RANGE_RETRY_ATTEMPTS} times, but no \
content-range in response.`);
            }

            // Return whatever response we have rather than an error response
            // This response cannot be aborted, otherwise it will raise an exception
            return response;
        }

        return fetch(requestToSend);
    },
};
