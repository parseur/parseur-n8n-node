import { describe, expect, it } from 'vitest';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import {
	uploadTextDescription,
	uploadTextExecute,
} from '../../../nodes/Parseur/UploadText.operation';
import { createMockContext, errorWithStatus, requestOptions } from '../../helpers/mockContext';

const PARAMS = {
	recipient: 'inbox@mailbox.example.test',
	subject: 'Invoice 42',
	sender: 'billing@vendor.example.test',
	body_html: '<p>Total: 10 EUR</p>',
};

describe('uploadTextDescription', () => {
	it('declares recipient, subject, sender and body_html, shown only for uploadText', () => {
		expect(uploadTextDescription.map((p) => p.name)).toEqual([
			'recipient',
			'subject',
			'sender',
			'body_html',
		]);
		for (const property of uploadTextDescription) {
			expect(property.displayOptions?.show?.operation).toEqual(['uploadText']);
			expect(property.type).toBe('string');
		}
	});

	it('requires only recipient and subject', () => {
		const required = uploadTextDescription.filter((p) => p.required).map((p) => p.name);
		expect(required).toEqual(['recipient', 'subject']);
	});
});

describe('uploadTextExecute', () => {
	it('posts the document as an email payload, mapping sender to "from"', async () => {
		const { ctx, http } = createMockContext({ params: PARAMS, httpResponse: { DocumentID: 'd1' } });

		const result = await uploadTextExecute.call(ctx);

		expect(requestOptions(http)).toStrictEqual({
			method: 'POST',
			url: 'https://api.example.test/email',
			qs: {},
			json: true,
			body: {
				recipient: PARAMS.recipient,
				subject: PARAMS.subject,
				from: PARAMS.sender,
				body_html: PARAMS.body_html,
			},
		});
		expect(result).toEqual([
			[
				{
					json: { message: 'Text sent successfully', response: { DocumentID: 'd1' } },
					pairedItem: { item: 0 },
				},
			],
		]);
	});

	it('defaults the optional sender and content to empty strings', async () => {
		const { ctx, http, getNodeParameter } = createMockContext({
			params: { recipient: PARAMS.recipient, subject: PARAMS.subject },
		});

		await uploadTextExecute.call(ctx);

		expect(getNodeParameter).toHaveBeenCalledWith('sender', 0, '');
		expect(getNodeParameter).toHaveBeenCalledWith('body_html', 0, '');
		expect(requestOptions(http).body).toEqual({
			recipient: PARAMS.recipient,
			subject: PARAMS.subject,
			from: '',
			body_html: '',
		});
	});

	it('sends one request per input item, in order, with per-item parameters', async () => {
		const { ctx, http } = createMockContext({
			params: [
				{ ...PARAMS, subject: 'first' },
				{ ...PARAMS, subject: 'second' },
				{ ...PARAMS, subject: 'third' },
			],
			items: [{ json: {} }, { json: {} }, { json: {} }],
			httpResponses: [{ n: 1 }, { n: 2 }, { n: 3 }],
		});

		const [output] = await uploadTextExecute.call(ctx);

		expect(http).toHaveBeenCalledTimes(3);
		expect(
			[0, 1, 2].map((i) => (requestOptions(http, i).body as { subject: string }).subject),
		).toEqual(['first', 'second', 'third']);
		expect(output.map((o) => o.pairedItem)).toEqual([{ item: 0 }, { item: 1 }, { item: 2 }]);
		expect(output.map((o) => o.json.response)).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
	});

	it.each([
		['array', ['a'], { value: '["a"]' }],
		['string', 'accepted', 'accepted'],
		['object', { id: 1 }, { id: 1 }],
	])(
		'normalises a %s API response into a valid item json value',
		async (_label, response, expected) => {
			const { ctx } = createMockContext({ params: PARAMS, httpResponse: response });

			const [[item]] = await uploadTextExecute.call(ctx);

			expect(item.json.response).toEqual(expected);
		},
	);

	it('rethrows API failures as NodeApiError with the fixed message and HTTP code', async () => {
		const { ctx } = createMockContext({
			params: PARAMS,
			httpError: errorWithStatus('Bad request', 400),
		});

		const error = await uploadTextExecute.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('Error while communicating with the Parseur API');
		expect((error as NodeApiError).httpCode).toBe('400');
	});

	it('returns an error item and continues when continueOnFail is set', async () => {
		const { ctx, http } = createMockContext({
			params: PARAMS,
			items: [{ json: {} }, { json: {} }],
			httpError: errorWithStatus('Bad request', 400),
			continueOnFail: true,
		});

		const [output] = await uploadTextExecute.call(ctx);

		expect(http).toHaveBeenCalledTimes(2);
		expect(output).toEqual([
			{
				json: { error: 'Error while communicating with the Parseur API' },
				pairedItem: { item: 0 },
			},
			{
				json: { error: 'Error while communicating with the Parseur API' },
				pairedItem: { item: 1 },
			},
		]);
	});

	it('wraps unexpected plain errors into a NodeApiError with the item index', async () => {
		const { ctx, getNodeParameter } = createMockContext({ params: PARAMS });
		getNodeParameter.mockImplementation(() => {
			throw new Error('parameter resolution failed');
		});

		const error = await uploadTextExecute.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect(error).not.toBeInstanceOf(NodeOperationError);
		expect((error as NodeApiError).message).toBe('parameter resolution failed');
		expect((error as NodeApiError).context.itemIndex).toBe(0);
	});

	it('rethrows a NodeOperationError raised while resolving parameters', async () => {
		const { ctx, getNodeParameter, node } = createMockContext({ params: PARAMS });
		getNodeParameter.mockImplementation(() => {
			throw new NodeOperationError(node, 'Bad parameter');
		});

		const error = await uploadTextExecute.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeOperationError);
		expect((error as NodeOperationError).message).toBe('Bad parameter');
	});
});
