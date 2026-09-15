import { describe, expect, it } from 'vitest';
import { NodeApiError } from 'n8n-workflow';
import { ParseurTrigger } from '../../../nodes/Parseur/ParseurTrigger.node';
import { getParsers } from '../../../nodes/Parseur/GenericFunctions';
import {
	createMockContext,
	DEFAULT_WEBHOOK_URL,
	errorWithStatus,
	requestOptions,
	TEST_CREDENTIALS,
	TEST_NODE,
} from '../../helpers/mockContext';

const trigger = new ParseurTrigger();
const { getTableFields } = trigger.methods.loadOptions;
const { checkExists, create, delete: deleteWebhook } = trigger.webhookMethods.default;

const EVENTS = [
	'document.export_failed',
	'document.processed',
	'document.processed.flattened',
	'document.template_needed',
	'table.processed',
	'table.processed.flattened',
];

describe('ParseurTrigger node description', () => {
	it('is a trigger node with no inputs and one main output', () => {
		expect(trigger.description.name).toBe('parseurTrigger');
		expect(trigger.description.group).toEqual(['trigger']);
		expect(trigger.description.inputs).toEqual([]);
		expect(trigger.description.outputs).toHaveLength(1);
		expect(trigger.description.credentials).toEqual([{ name: 'parseurApi', required: true }]);
	});

	it('registers a single POST webhook that answers as soon as it is received', () => {
		expect(trigger.description.webhooks).toEqual([
			{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'parseur' },
		]);
	});

	it('offers the six Parseur events, sorted alphabetically by display name', () => {
		const event = trigger.description.properties.find((p) => p.name === 'event');
		const options = (event?.options ?? []) as Array<{ name: string; value: string }>;
		expect(options.map((o) => o.value)).toEqual(EVENTS);
		expect(options.map((o) => o.name)).toEqual([...options.map((o) => o.name)].sort());
		expect(event?.default).toBe('document.processed');
		expect(event?.required).toBe(true);
	});

	it('loads mailboxes via getParsers and refreshes them when the event changes', () => {
		const parserId = trigger.description.properties.find((p) => p.name === 'parserId');
		expect(parserId?.required).toBe(true);
		expect(parserId?.typeOptions).toEqual({
			loadOptionsMethod: 'getParsers',
			loadOptionsDependsOn: ['event'],
		});
		expect(trigger.methods.loadOptions.getParsers).toBe(getParsers);
	});

	it('shows the table field selector only for table events', () => {
		const tableFieldId = trigger.description.properties.find((p) => p.name === 'tableFieldId');
		expect(tableFieldId?.displayOptions?.show?.event).toEqual([
			'table.processed',
			'table.processed.flattened',
		]);
		expect(tableFieldId?.typeOptions).toEqual({
			loadOptionsMethod: 'getTableFields',
			loadOptionsDependsOn: ['parserId', 'event'],
		});
	});
});

describe('loadOptions.getTableFields', () => {
	it('asks for a mailbox first when none is selected', async () => {
		const { ctx, http } = createMockContext({ params: { parserId: '', event: 'table.processed' } });

		const error = await getTableFields.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('Select a Mailbox first.');
		expect(http).not.toHaveBeenCalled();
	});

	it('lists the table fields of the selected mailbox', async () => {
		const { ctx, http } = createMockContext({
			params: { parserId: 'p1', event: 'table.processed' },
			httpResponse: [
				{ id: 't1', name: 'Line items', type: 'TABLE' },
				{ id: 't2', name: 'Taxes' },
			],
		});

		const options = await getTableFields.call(ctx);

		expect(requestOptions(http)).toMatchObject({
			method: 'GET',
			url: 'https://api.example.test/parser/p1/table_set',
		});
		expect(options).toEqual([
			{ name: 'Line items', value: 't1' },
			{ name: 'Taxes', value: 't2' },
		]);
	});

	it('rejects a mailbox without table fields when a table event is selected', async () => {
		const { ctx } = createMockContext({
			params: { parserId: 'p1', event: 'table.processed.flattened' },
			httpResponse: [],
		});

		const error = await getTableFields.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toMatch(/^This Mailbox has no table fields configured/);
	});

	it('returns an empty list for a document event when the mailbox has no tables', async () => {
		const { ctx } = createMockContext({
			params: { parserId: 'p1', event: 'document.processed' },
			httpResponse: [],
		});

		await expect(getTableFields.call(ctx)).resolves.toEqual([]);
	});

	it('propagates API failures as NodeApiError', async () => {
		const { ctx } = createMockContext({
			params: { parserId: 'p1', event: 'table.processed' },
			httpError: errorWithStatus('Forbidden', 403),
		});

		const error = await getTableFields.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('403');
	});
});

describe('webhook()', () => {
	const validHeaders = {
		'x-parseur-token': TEST_CREDENTIALS.webhookToken as string,
		'x-parseur-event': 'document.processed',
	};

	it('rejects a request without the webhook token', async () => {
		const { ctx } = createMockContext({ params: { event: 'document.processed' }, headers: {} });

		const error = await trigger.webhook.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('Unauthorized webhook: token mismatch');
	});

	it('rejects a request with a wrong webhook token', async () => {
		const { ctx } = createMockContext({
			params: { event: 'document.processed' },
			headers: { ...validHeaders, 'x-parseur-token': 'someone-elses-token' },
		});

		await expect(trigger.webhook.call(ctx)).rejects.toThrow('Unauthorized webhook: token mismatch');
	});

	it('rejects a request without the event header', async () => {
		const { ctx } = createMockContext({
			params: { event: 'document.processed' },
			headers: { 'x-parseur-token': validHeaders['x-parseur-token'] },
		});

		await expect(trigger.webhook.call(ctx)).rejects.toThrow('Unauthorized webhook: event mismatch');
	});

	it('rejects an event that differs from the one the node listens to', async () => {
		const { ctx } = createMockContext({
			params: { event: 'table.processed' },
			headers: validHeaders,
		});

		await expect(trigger.webhook.call(ctx)).rejects.toThrow('Unauthorized webhook: event mismatch');
	});

	it('emits the payload as a single item when token and event match', async () => {
		const body = { DocumentID: 'd1', Total: '10.00' };
		const { ctx, getCredentials } = createMockContext({
			params: { event: 'document.processed' },
			headers: validHeaders,
			body,
		});

		const result = await trigger.webhook.call(ctx);

		expect(getCredentials).toHaveBeenCalledWith('parseurApi');
		expect(result).toEqual({ workflowData: [[{ json: body, pairedItem: { item: 0 } }]] });
	});

	it('relies on lower-cased header names (documents the n8n/Node behaviour)', async () => {
		const { ctx } = createMockContext({
			params: { event: 'document.processed' },
			headers: {
				'X-Parseur-Token': validHeaders['x-parseur-token'],
				'X-Parseur-Event': 'document.processed',
			},
		});

		await expect(trigger.webhook.call(ctx)).rejects.toThrow('Unauthorized webhook: token mismatch');
	});
});

describe('webhookMethods.default.checkExists', () => {
	it('is false until a webhook id has been stored', async () => {
		const { ctx, http } = createMockContext();

		await expect(checkExists.call(ctx)).resolves.toBe(false);
		expect(http).not.toHaveBeenCalled();
	});

	it('is true once a webhook id is stored in the node static data', async () => {
		const { ctx } = createMockContext({ staticData: { webhookId: 'wh_1' } });

		await expect(checkExists.call(ctx)).resolves.toBe(true);
	});
});

describe('webhookMethods.default.create', () => {
	it('registers a parser webhook for document events and stores its id', async () => {
		const { ctx, http, staticData, getNodeWebhookUrl } = createMockContext({
			params: { event: 'document.processed', parserId: 'p1' },
			httpResponse: { id: 'wh_1' },
		});

		await expect(create.call(ctx)).resolves.toBe(true);

		expect(getNodeWebhookUrl).toHaveBeenCalledWith('default');
		expect(requestOptions(http)).toStrictEqual({
			method: 'POST',
			url: 'https://api.example.test/parser/p1/n8n/document.processed',
			qs: {},
			json: true,
			body: {
				target: DEFAULT_WEBHOOK_URL,
				headers: { 'X-Parseur-Token': TEST_CREDENTIALS.webhookToken },
			},
		});
		expect(staticData.webhookId).toBe('wh_1');
	});

	it('registers a table webhook for table events, addressing the table field instead of the parser', async () => {
		const { ctx, http, staticData } = createMockContext({
			params: { event: 'table.processed.flattened', parserId: 'p1', tableFieldId: 't1' },
			httpResponse: { id: 'wh_2' },
		});

		await create.call(ctx);

		expect(requestOptions(http).url).toBe(
			'https://api.example.test/table/t1/n8n/table.processed.flattened',
		);
		expect(staticData.webhookId).toBe('wh_2');
	});

	it.each(['', undefined])(
		'refuses a table event without a table field (%j)',
		async (tableFieldId) => {
			const { ctx, http, staticData } = createMockContext({
				params: { event: 'table.processed', parserId: 'p1', tableFieldId },
			});

			const error = await create.call(ctx).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(NodeApiError);
			expect((error as NodeApiError).message).toBe(
				'For table events, you must select a Table Field.',
			);
			expect(http).not.toHaveBeenCalled();
			expect(staticData).not.toHaveProperty('webhookId');
		},
	);

	it('does not store anything when Parseur rejects the registration', async () => {
		const { ctx, staticData } = createMockContext({
			params: { event: 'document.processed', parserId: 'p1' },
			httpError: errorWithStatus('Payment required', 402),
		});

		const error = await create.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('402');
		expect(staticData).not.toHaveProperty('webhookId');
	});
});

describe('webhookMethods.default.delete', () => {
	it('is a no-op when no webhook was registered', async () => {
		const { ctx, http } = createMockContext();

		await expect(deleteWebhook.call(ctx)).resolves.toBe(true);
		expect(http).not.toHaveBeenCalled();
	});

	it('deletes the registered webhook and forgets its id', async () => {
		const { ctx, http, staticData } = createMockContext({
			staticData: { webhookId: 'wh_1' },
			httpResponse: '',
		});

		await expect(deleteWebhook.call(ctx)).resolves.toBe(true);

		expect(requestOptions(http)).toStrictEqual({
			method: 'DELETE',
			url: 'https://api.example.test/webhook/wh_1',
			qs: {},
			json: true,
		});
		expect(staticData).not.toHaveProperty('webhookId');
	});

	it.each([
		['a plain error object with httpCode', { message: 'Not found', httpCode: '404' }],
		['an Error with statusCode', errorWithStatus('Not found', 404)],
		[
			'a NodeApiError thrown by n8n-core',
			new NodeApiError(TEST_NODE, { message: 'Not found', httpCode: '404' }),
		],
	])('treats a 404 (%s) as already deleted', async (_label, httpError) => {
		const { ctx, staticData } = createMockContext({
			staticData: { webhookId: 'wh_gone' },
			httpError,
		});

		await expect(deleteWebhook.call(ctx)).resolves.toBe(true);
		expect(staticData).not.toHaveProperty('webhookId');
	});

	it('rethrows other API failures and keeps the id so deletion can be retried', async () => {
		const { ctx, staticData } = createMockContext({
			staticData: { webhookId: 'wh_1' },
			httpError: errorWithStatus('Server error', 500),
		});

		const error = await deleteWebhook.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('500');
		expect((error as NodeApiError).message).toBe('Error while communicating with the Parseur API');
		expect(staticData.webhookId).toBe('wh_1');
	});

	it('rethrows failures without an HTTP status and keeps the id', async () => {
		const { ctx, staticData } = createMockContext({
			staticData: { webhookId: 'wh_1' },
			httpError: new Error('boom'),
		});

		const error = await deleteWebhook.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBeNull();
		expect(staticData.webhookId).toBe('wh_1');
	});
});
