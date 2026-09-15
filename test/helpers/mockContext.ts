import { vi, type Mock } from 'vitest';
import type {
	IBinaryData,
	ICredentialDataDecryptedObject,
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	INode,
	INodeExecutionData,
	IWebhookFunctions,
} from 'n8n-workflow';

/**
 * Shared fixtures and a mock factory for the n8n execution contexts.
 *
 * Every Parseur API call goes through `parseurApiRequest`, which calls
 * `this.helpers.httpRequestWithAuthentication.call(this, 'parseurApi', options)`.
 * Tests therefore mock at that level and assert on the `IHttpRequestOptions` the
 * node built (`requestOptions(http, n)`), so URL building, `json`/`body`/`qs`
 * handling and error wrapping in `GenericFunctions.ts` are exercised for real.
 */

export const TEST_NODE: INode = {
	id: 'node-id',
	name: 'Parseur',
	type: 'n8n-nodes-parseur.parseur',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

// Deliberately digit-free placeholder values (the community-nodes lint rule
// `no-hardcoded-secrets` flags realistic-looking tokens).
export const TEST_CREDENTIALS: ICredentialDataDecryptedObject = {
	url: 'https://api.example.test',
	apiKey: 'dummy-api-key',
	webhookToken: 'dummy-webhook-token',
};

export const DEFAULT_WEBHOOK_URL = 'https://n8n.example.test/webhook/abc/parseur';

export interface MockContextOptions {
	/** Node parameters, either one flat object (all items) or one object per item index. */
	params?: IDataObject | IDataObject[];
	/** Items returned by `getInputData()`. */
	items?: INodeExecutionData[];
	/** Overrides merged into TEST_CREDENTIALS. */
	credentials?: Partial<ICredentialDataDecryptedObject>;
	continueOnFail?: boolean;
	/** Resolved value of the HTTP helper (every call). Defaults to `{}`. */
	httpResponse?: unknown;
	/** Resolved values of successive HTTP helper calls (first call gets index 0, ...). */
	httpResponses?: unknown[];
	/** Rejected value of the HTTP helper (plain object, Error or NodeApiError). */
	httpError?: unknown;
	/** Buffers returned by `getBinaryDataBuffer(itemIndex, propertyName)`, keyed by property name. */
	binaryBuffers?: Record<string, Buffer>;
	/** Object returned by `getWorkflowStaticData('node')` (returned by reference). */
	staticData?: IDataObject;
	webhookUrl?: string;
	/** Incoming webhook headers (lower-case keys, as n8n/Node expose them). */
	headers?: Record<string, string>;
	/** Incoming webhook body. */
	body?: IDataObject;
	node?: Partial<INode>;
}

export type AnyContext = IExecuteFunctions &
	ILoadOptionsFunctions &
	IHookFunctions &
	IWebhookFunctions;

export interface MockContext {
	ctx: AnyContext;
	http: Mock;
	getBinaryDataBuffer: Mock;
	getNodeParameter: Mock;
	getCredentials: Mock;
	getNodeWebhookUrl: Mock;
	staticData: IDataObject;
	node: INode;
}

export function createMockContext(opts: MockContextOptions = {}): MockContext {
	const node: INode = { ...TEST_NODE, ...opts.node };
	const staticData: IDataObject = opts.staticData ?? {};
	const items = opts.items ?? [{ json: {} }];
	const credentials = { ...TEST_CREDENTIALS, ...opts.credentials };

	const lookup = (name: string, itemIndex: number): unknown => {
		const source = Array.isArray(opts.params) ? opts.params[itemIndex] : opts.params;
		return source?.[name];
	};

	// n8n has two call shapes:
	//   execute():          getNodeParameter(name, itemIndex, fallback?)
	//   hooks/load/webhook: getNodeParameter(name, fallback?)
	const getNodeParameter = vi.fn((name: string, a?: unknown, b?: unknown) => {
		const isExecuteStyle = typeof a === 'number';
		const itemIndex = isExecuteStyle ? a : 0;
		const fallback = isExecuteStyle ? b : a;
		const value = lookup(name, itemIndex);
		return value === undefined ? fallback : value;
	});

	const http = vi.fn();
	if (opts.httpError !== undefined) {
		http.mockRejectedValue(opts.httpError);
	} else if (opts.httpResponses) {
		for (const value of opts.httpResponses) http.mockResolvedValueOnce(value);
	} else {
		http.mockResolvedValue('httpResponse' in opts ? opts.httpResponse : {});
	}

	const getBinaryDataBuffer = vi.fn(async (_itemIndex: number, propertyName: string) => {
		const buffer = opts.binaryBuffers?.[propertyName];
		if (!buffer) throw new Error(`No binary buffer configured for "${propertyName}"`);
		return buffer;
	});

	const getCredentials = vi.fn(async () => credentials);
	const getNodeWebhookUrl = vi.fn(() => opts.webhookUrl ?? DEFAULT_WEBHOOK_URL);

	const ctx = {
		getNode: vi.fn(() => node),
		getNodeParameter,
		getInputData: vi.fn(() => items),
		getCredentials,
		continueOnFail: vi.fn(() => opts.continueOnFail ?? false),
		getWorkflowStaticData: vi.fn(() => staticData),
		getNodeWebhookUrl,
		getHeaderData: vi.fn(() => opts.headers ?? {}),
		getBodyData: vi.fn(() => opts.body ?? {}),
		helpers: {
			httpRequestWithAuthentication: http,
			getBinaryDataBuffer,
		},
	};

	return {
		ctx: ctx as unknown as AnyContext,
		http,
		getBinaryDataBuffer,
		getNodeParameter,
		getCredentials,
		getNodeWebhookUrl,
		staticData,
		node,
	};
}

/** The `IHttpRequestOptions` passed on the n-th (0-based) HTTP helper call. */
export function requestOptions(http: Mock, callIndex = 0): IDataObject {
	const call = http.mock.calls[callIndex];
	if (!call)
		throw new Error(
			`HTTP helper was called ${http.mock.calls.length} time(s), no call #${callIndex}`,
		);
	return call[1] as IDataObject;
}

/** An input item carrying binary metadata under `propertyName` (content lives in `binaryBuffers`). */
export function binaryItem(
	propertyName: string,
	meta: { fileName?: string; mimeType?: string } = {},
): INodeExecutionData {
	return {
		json: {},
		binary: {
			// mimeType is typed as required by n8n but may be absent at runtime; the
			// operation must fall back gracefully, which is what tests exercise.
			[propertyName]: { data: '', ...meta } as IBinaryData,
		},
	};
}

/** An Error carrying an HTTP status the way n8n's request helpers surface it. */
export function errorWithStatus(
	message: string,
	statusCode: number,
): Error & { statusCode: number } {
	return Object.assign(new Error(message), { statusCode });
}

/** Reads the `file` part of a multipart body built by the Upload File operation. */
export async function readFormDataFile(
	body: unknown,
): Promise<{ name: string; type: string; bytes: Buffer }> {
	if (!(body instanceof FormData)) throw new Error('Body is not a FormData instance');
	const entry = body.get('file');
	if (!(entry instanceof Blob)) throw new Error('FormData has no "file" Blob entry');
	const name = entry instanceof File ? entry.name : '';
	return { name, type: entry.type, bytes: Buffer.from(await entry.arrayBuffer()) };
}
