import type {
    IDataObject,
    ILoadOptionsFunctions,
    IRequestOptions,
    IHttpRequestMethods,
    IAllExecuteFunctions,
} from 'n8n-workflow';

import { NodeApiError } from 'n8n-workflow';

/**
 * Helper to build a fully qualified Parseur API URL.
 */
export function getUri(baseURL:string, path: string): string {
    return `${baseURL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Sends a request to the Parseur API using the given method, path, and data.
 * Includes authentication and handles errors with NodeApiError.
 */
export async function parseurApiRequest(
    this: IAllExecuteFunctions | ILoadOptionsFunctions,
    method: IHttpRequestMethods,
    path: string,
    body: IDataObject = {},
    query: IDataObject = {},
    formData?: IDataObject,
): Promise<any> {
    const credentials = await this.getCredentials('parseurApi');
    const apiKey = credentials.apiKey as string;
    const baseURL = credentials.url as string

	const options: IRequestOptions = {
		method,
		url: getUri(baseURL, path),
		auth: { bearer: apiKey },
		qs: query,
	};

	if (formData) {
		options.formData = formData;
		options.json = false;
	} else {
		options.json = true;
		if (Object.keys(body).length > 0) {
			options.body = body;
		}
	}

    try {
        return await this.helpers.request(options);
    } catch (error) {
        throw new NodeApiError(this.getNode(), {
            message: 'Error while communicating with the Parseur API',
        });
    }
}

/**
 * Loads the list of available parsers from the Parseur API for dynamic dropdowns.
 */
export async function getParsers(this: ILoadOptionsFunctions): Promise<{ name: string; value: string }[]> {
    const response = await parseurApiRequest.call(this, 'GET', '/user/parser_set');

    if (!Array.isArray(response)) {
        throw new NodeApiError(this.getNode(), {
            message: 'Expected an array of parsers from Parseur API',
        });
    }

    return response.map((parser: { id: string; name: string }) => ({
        name: parser.name,
        value: parser.id,
    }));
}