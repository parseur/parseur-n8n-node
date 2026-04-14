import type {
    IDataObject,
    ILoadOptionsFunctions,
    IHttpRequestMethods,
    IAllExecuteFunctions,
    IHttpRequestOptions,
    JsonObject,
} from 'n8n-workflow';

import { NodeApiError } from 'n8n-workflow';

/**
 * Helper to build a fully qualified Parseur API URL.
 */
export function getUri(baseURL: string, path: string): string {
    return `${baseURL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Sends a request to the Parseur API using the given method, path, and data.
 * Includes authentication and handles errors with NodeApiError.
 */
export async function parseurApiRequest<T = JsonObject>(
    this: IAllExecuteFunctions | ILoadOptionsFunctions,
    method: IHttpRequestMethods,
    path: string,
    body: IDataObject | FormData = {},
    query: IDataObject = {},
): Promise<T> {
    const credentials = await this.getCredentials('parseurApi');
    const baseURL = credentials.url as string;

    const options: IHttpRequestOptions = {
        method,
        url: getUri(baseURL, path),
        qs: query,
    };

    if (body instanceof FormData) {
        options.body = body;
        options.json = false;
    } else {
        options.json = true;
        if (Object.keys(body).length > 0) {
            options.body = body;
        }
    }

    try {
        return await this.helpers.httpRequestWithAuthentication.call(this, 'parseurApi', options);
    } catch (error) {
        throw new NodeApiError(this.getNode(), error as JsonObject, {
            message: 'Error while communicating with the Parseur API',
        });
    }
}

/**
 * Loads the list of available parsers from the Parseur API for dynamic dropdowns.
 */
export async function getParsers(
    this: ILoadOptionsFunctions,
): Promise<Array<{ name: string; value: string }>> {
    const response = await parseurApiRequest.call(
        this,
        'GET',
        '/user/parser_set',
    );

    if (!Array.isArray(response)) {
        throw new NodeApiError(this.getNode(), {
            message: 'Expected an array of parsers from Parseur API',
        });
    }

    return response.map((parser) => ({
        name: parser.name,
        value: parser.id,
    }));
}