import { describe, expect, it } from 'vitest';
import { NodeApiError } from 'n8n-workflow';
import { getParsers, getUri, parseurApiRequest } from '../../../nodes/Parseur/GenericFunctions';
import {
	createMockContext,
	errorWithStatus,
	requestOptions,
	TEST_NODE,
} from '../../helpers/mockContext';

describe('getUri', () => {
	it('joins base URL and path, adding the missing slash', () => {
		expect(getUri('https://api.example.test', 'user/parser_set')).toBe(
			'https://api.example.test/user/parser_set',
		);
	});

	it('does not double the slash when the path already starts with one', () => {
		expect(getUri('https://api.example.test', '/email')).toBe('https://api.example.test/email');
	});

	it('does not normalise a trailing slash on the base URL (documented behaviour)', () => {
		expect(getUri('https://api.example.test/', '/email')).toBe('https://api.example.test//email');
	});
});

describe('parseurApiRequest', () => {
	it('authenticates with the parseurApi credential and sends a JSON body', async () => {
		const { ctx, http } = createMockContext({ httpResponse: { ok: true } });

		const result = await parseurApiRequest.call(ctx, 'POST', '/email', { recipient: 'a@b.c' });

		expect(result).toEqual({ ok: true });
		expect(http).toHaveBeenCalledTimes(1);
		expect(http.mock.calls[0][0]).toBe('parseurApi');
		expect(requestOptions(http)).toEqual({
			method: 'POST',
			url: 'https://api.example.test/email',
			qs: {},
			json: true,
			body: { recipient: 'a@b.c' },
		});
	});

	it('omits the body entirely when it is empty', async () => {
		const { ctx, http } = createMockContext({ httpResponse: [] });

		await parseurApiRequest.call(ctx, 'GET', '/user/parser_set');

		const options = requestOptions(http);
		expect(options.json).toBe(true);
		expect(options).not.toHaveProperty('body');
	});

	it('passes query parameters through as qs', async () => {
		const { ctx, http } = createMockContext();

		await parseurApiRequest.call(ctx, 'GET', '/user', {}, { page: 2 });

		expect(requestOptions(http).qs).toEqual({ page: 2 });
	});

	it('sends FormData as-is with json disabled', async () => {
		const { ctx, http } = createMockContext();
		const formData = new FormData();
		formData.append('file', new Blob(['x']), 'x.txt');

		await parseurApiRequest.call(ctx, 'POST', '/parser/p1/upload', formData);

		const options = requestOptions(http);
		expect(options.body).toBe(formData);
		expect(options.json).toBe(false);
	});

	it('uses the base URL from the credential', async () => {
		const { ctx, http } = createMockContext({ credentials: { url: 'https://eu.example.test' } });

		await parseurApiRequest.call(ctx, 'GET', 'user');

		expect(requestOptions(http).url).toBe('https://eu.example.test/user');
	});

	it('returns the helper response unchanged, whatever its shape', async () => {
		const { ctx } = createMockContext({ httpResponse: 'plain text' });

		await expect(parseurApiRequest.call(ctx, 'GET', '/x')).resolves.toBe('plain text');
	});

	it('wraps a plain error object into a NodeApiError, keeping the HTTP code', async () => {
		const { ctx } = createMockContext({ httpError: { message: 'Not found', httpCode: '404' } });

		const error = await parseurApiRequest.call(ctx, 'GET', '/x').catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('Error while communicating with the Parseur API');
		expect((error as NodeApiError).httpCode).toBe('404');
		expect((error as NodeApiError).description).toBe('Not found');
	});

	it('derives the HTTP code from a statusCode on a thrown Error', async () => {
		const { ctx } = createMockContext({ httpError: errorWithStatus('Server exploded', 500) });

		const error = await parseurApiRequest.call(ctx, 'GET', '/x').catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('500');
	});

	it('passes an existing NodeApiError through unchanged (same instance)', async () => {
		const original = new NodeApiError(TEST_NODE, { message: 'Already wrapped', httpCode: '403' });
		const { ctx } = createMockContext({ httpError: original });

		const error = await parseurApiRequest.call(ctx, 'GET', '/x').catch((e: unknown) => e);

		expect(error).toBe(original);
		expect((error as NodeApiError).message).toBe(original.message);
		expect((error as NodeApiError).httpCode).toBe('403');
	});
});

describe('getParsers', () => {
	it('lists the parsers from /user/parser_set as dropdown options', async () => {
		const { ctx, http } = createMockContext({
			httpResponse: [
				{ id: 'p1', name: 'Invoices', extra: true },
				{ id: 'p2', name: 'Receipts' },
			],
		});

		const options = await getParsers.call(ctx);

		expect(requestOptions(http)).toMatchObject({
			method: 'GET',
			url: 'https://api.example.test/user/parser_set',
		});
		expect(options).toEqual([
			{ name: 'Invoices', value: 'p1' },
			{ name: 'Receipts', value: 'p2' },
		]);
	});

	it('returns an empty list when the account has no parsers', async () => {
		const { ctx } = createMockContext({ httpResponse: [] });

		await expect(getParsers.call(ctx)).resolves.toEqual([]);
	});

	it.each([{ results: [] }, null, 'nope', 42])(
		'rejects a non-array response (%j) with a NodeApiError',
		async (response) => {
			const { ctx } = createMockContext({ httpResponse: response });

			const error = await getParsers.call(ctx).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(NodeApiError);
			expect((error as NodeApiError).message).toBe('Expected an array of parsers from Parseur API');
		},
	);

	it('propagates API failures as NodeApiError', async () => {
		const { ctx } = createMockContext({ httpError: errorWithStatus('Unauthorized', 401) });

		const error = await getParsers.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).httpCode).toBe('401');
	});
});
