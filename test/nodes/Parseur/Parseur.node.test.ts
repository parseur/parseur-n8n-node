import { describe, expect, it } from 'vitest';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { Parseur } from '../../../nodes/Parseur/Parseur.node';
import { getParsers } from '../../../nodes/Parseur/GenericFunctions';
import {
	binaryItem,
	createMockContext,
	errorWithStatus,
	requestOptions,
} from '../../helpers/mockContext';

const node = new Parseur();

describe('Parseur node description', () => {
	it('identifies itself as the parseur node, usable as an AI tool', () => {
		expect(node.description.name).toBe('parseur');
		expect(node.description.displayName).toBe('Parseur');
		expect(node.description.version).toBe(1);
		expect(node.description.usableAsTool).toBe(true);
		expect(node.description.group).toEqual(['input']);
	});

	it('requires the parseurApi credential', () => {
		expect(node.description.credentials).toEqual([{ name: 'parseurApi', required: true }]);
	});

	it('offers exactly the Upload File and Upload Text operations, defaulting to Upload File', () => {
		const operation = node.description.properties.find((p) => p.name === 'operation');
		expect(operation?.type).toBe('options');
		expect(operation?.noDataExpression).toBe(true);
		expect(operation?.default).toBe('uploadFile');
		expect((operation?.options ?? []).map((o) => (o as { value: string }).value)).toEqual([
			'uploadFile',
			'uploadText',
		]);
		for (const option of operation?.options ?? []) {
			expect((option as { action?: string }).action).toBeTruthy();
		}
	});

	it('includes the parameters of both operations', () => {
		const names = node.description.properties.map((p) => p.name);
		expect(names).toEqual([
			'operation',
			'parserId',
			'binaryPropertyName',
			'recipient',
			'subject',
			'sender',
			'body_html',
		]);
	});

	it('wires every loadOptionsMethod used by a parameter to an implemented method', () => {
		const used = node.description.properties
			.map((p) => p.typeOptions?.loadOptionsMethod)
			.filter((m): m is string => typeof m === 'string');
		expect(used).toEqual(['getParsers']);
		expect(node.methods.loadOptions.getParsers).toBe(getParsers);
	});

	it('has themed light/dark icons', () => {
		expect(node.description.icon).toEqual({
			light: 'file:parseur.light.svg',
			dark: 'file:parseur.dark.svg',
		});
	});
});

describe('Parseur.execute', () => {
	it('routes the uploadFile operation to the multipart upload endpoint', async () => {
		const { ctx, http } = createMockContext({
			params: { operation: 'uploadFile', parserId: 'p1', binaryPropertyName: 'data' },
			items: [binaryItem('data', { fileName: 'a.pdf' })],
			binaryBuffers: { data: Buffer.from('a') },
			httpResponse: { id: 'd1' },
		});

		const [output] = await node.execute.call(ctx);

		expect(requestOptions(http)).toMatchObject({
			method: 'POST',
			url: 'https://api.example.test/parser/p1/upload',
			json: false,
		});
		expect(requestOptions(http).body).toBeInstanceOf(FormData);
		expect(output[0].json.message).toBe('File uploaded successfully');
	});

	it('routes the uploadText operation to the email endpoint', async () => {
		const { ctx, http, getNodeParameter } = createMockContext({
			params: { operation: 'uploadText', recipient: 'r@example.test', subject: 's' },
			httpResponse: { id: 'd1' },
		});

		const [output] = await node.execute.call(ctx);

		expect(getNodeParameter).toHaveBeenCalledWith('operation', 0);
		expect(requestOptions(http)).toMatchObject({
			method: 'POST',
			url: 'https://api.example.test/email',
			json: true,
		});
		expect(output[0].json.message).toBe('Text sent successfully');
	});

	it('rejects an unknown operation with a NodeOperationError without calling the API', async () => {
		const { ctx, http } = createMockContext({ params: { operation: 'deleteEverything' } });

		const error = await node.execute.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toBe('Unknown operation: deleteEverything');
		expect(http).not.toHaveBeenCalled();
	});

	it('returns a single error item for an unknown operation when continueOnFail is set', async () => {
		const { ctx } = createMockContext({ params: { operation: 'nope' }, continueOnFail: true });

		await expect(node.execute.call(ctx)).resolves.toEqual([
			[{ json: { error: 'Unknown operation: nope' }, pairedItem: { item: 0 } }],
		]);
	});

	it('lets the operation handle per-item failures when continueOnFail is set', async () => {
		const { ctx, http } = createMockContext({
			params: { operation: 'uploadText', recipient: 'r@example.test', subject: 's' },
			items: [{ json: {} }, { json: {} }],
			httpError: errorWithStatus('Bad gateway', 502),
			continueOnFail: true,
		});

		const [output] = await node.execute.call(ctx);

		expect(http).toHaveBeenCalledTimes(2);
		expect(output).toHaveLength(2);
		expect(output.map((o) => o.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
	});

	it('converts an API failure into a NodeOperationError when continueOnFail is off', async () => {
		const { ctx } = createMockContext({
			params: { operation: 'uploadText', recipient: 'r@example.test', subject: 's' },
			httpError: errorWithStatus('Bad gateway', 502),
		});

		const error = await node.execute.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect(error).not.toBeInstanceOf(NodeApiError);
		expect((error as NodeOperationError).message).toBe(
			'Error while communicating with the Parseur API',
		);
	});

	it('passes an operation NodeOperationError through unchanged', async () => {
		const { ctx } = createMockContext({
			params: { operation: 'uploadFile', parserId: 'p1', binaryPropertyName: 'data' },
			items: [{ json: {} }],
		});

		const error = await node.execute.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toContain(
			'No binary data property "data" found on item 0',
		);
		expect((error as NodeOperationError).context.itemIndex).toBe(0);
	});

	it('reports "Unknown error" when something non-Error is thrown', async () => {
		const { ctx, getNodeParameter } = createMockContext({ continueOnFail: true });
		getNodeParameter.mockImplementation(() => {
			throw 'string failure';
		});

		await expect(node.execute.call(ctx)).resolves.toEqual([
			[{ json: { error: 'Unknown error' }, pairedItem: { item: 0 } }],
		]);
	});

	it('throws a NodeOperationError("Unknown error") for non-Error throwables when continueOnFail is off', async () => {
		const { ctx, getNodeParameter } = createMockContext();
		getNodeParameter.mockImplementation(() => {
			throw 'string failure';
		});

		const error = await node.execute.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toBe('Unknown error');
	});
});
