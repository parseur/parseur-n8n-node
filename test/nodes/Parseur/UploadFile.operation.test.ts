import { describe, expect, it } from 'vitest';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import {
	uploadFileDescription,
	uploadFileExecute,
} from '../../../nodes/Parseur/UploadFile.operation';
import {
	binaryItem,
	createMockContext,
	errorWithStatus,
	readFormDataFile,
	requestOptions,
	TEST_NODE,
} from '../../helpers/mockContext';

const PDF = Buffer.from('%PDF-1.4 fake');

describe('uploadFileDescription', () => {
	it('declares the mailbox and binary property parameters, shown only for uploadFile', () => {
		expect(uploadFileDescription.map((p) => p.name)).toEqual(['parserId', 'binaryPropertyName']);
		for (const property of uploadFileDescription) {
			expect(property.displayOptions?.show?.operation).toEqual(['uploadFile']);
			expect(property.required).toBe(true);
		}
	});

	it('loads mailboxes through the getParsers loadOptions method', () => {
		const parserId = uploadFileDescription.find((p) => p.name === 'parserId');
		expect(parserId?.type).toBe('options');
		expect(parserId?.typeOptions?.loadOptionsMethod).toBe('getParsers');
	});

	it('defaults the binary property name to "data"', () => {
		expect(uploadFileDescription.find((p) => p.name === 'binaryPropertyName')?.default).toBe(
			'data',
		);
	});
});

describe('uploadFileExecute', () => {
	it('uploads the binary as multipart form data to the mailbox upload endpoint', async () => {
		const { ctx, http, getBinaryDataBuffer } = createMockContext({
			params: { parserId: 'p1', binaryPropertyName: 'data' },
			items: [binaryItem('data', { fileName: 'invoice.pdf', mimeType: 'application/pdf' })],
			binaryBuffers: { data: PDF },
			httpResponse: { DocumentID: 'd1', status: 'queued' },
		});

		const result = await uploadFileExecute.call(ctx);

		expect(getBinaryDataBuffer).toHaveBeenCalledWith(0, 'data');
		const options = requestOptions(http);
		expect(options).toMatchObject({
			method: 'POST',
			url: 'https://api.example.test/parser/p1/upload',
			json: false,
		});
		const file = await readFormDataFile(options.body);
		expect(file.name).toBe('invoice.pdf');
		expect(file.type).toBe('application/pdf');
		expect(file.bytes.equals(PDF)).toBe(true);

		expect(result).toEqual([
			[
				{
					json: {
						message: 'File uploaded successfully',
						response: { DocumentID: 'd1', status: 'queued' },
					},
					pairedItem: { item: 0 },
				},
			],
		]);
	});

	it('falls back to a generic mime type and file name when the binary has none', async () => {
		const { ctx, http } = createMockContext({
			params: { parserId: 'p1', binaryPropertyName: 'data' },
			items: [binaryItem('data')],
			binaryBuffers: { data: PDF },
		});

		await uploadFileExecute.call(ctx);

		const file = await readFormDataFile(requestOptions(http).body);
		expect(file.name).toBe('upload.dat');
		expect(file.type).toBe('application/octet-stream');
	});

	it('processes every input item in order with per-item parameters', async () => {
		const { ctx, http } = createMockContext({
			params: [
				{ parserId: 'p1', binaryPropertyName: 'data' },
				{ parserId: 'p2', binaryPropertyName: 'attachment' },
			],
			items: [
				binaryItem('data', { fileName: 'a.pdf' }),
				binaryItem('attachment', { fileName: 'b.pdf' }),
			],
			binaryBuffers: { data: Buffer.from('a'), attachment: Buffer.from('b') },
			httpResponses: [{ id: 1 }, { id: 2 }],
		});

		const [output] = await uploadFileExecute.call(ctx);

		expect(http).toHaveBeenCalledTimes(2);
		expect(requestOptions(http, 0).url).toBe('https://api.example.test/parser/p1/upload');
		expect(requestOptions(http, 1).url).toBe('https://api.example.test/parser/p2/upload');
		expect(output.map((o) => o.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		expect(output.map((o) => o.json.response)).toEqual([{ id: 1 }, { id: 2 }]);
	});

	it.each([
		['array', [1, 2], { value: '[1,2]' }],
		['string', 'ok', 'ok'],
		['number', 7, 7],
		['boolean', true, true],
		['null', null, null],
	])(
		'normalises a %s API response into a valid item json value',
		async (_label, response, expected) => {
			const { ctx } = createMockContext({
				params: { parserId: 'p1', binaryPropertyName: 'data' },
				items: [binaryItem('data')],
				binaryBuffers: { data: PDF },
				httpResponse: response,
			});

			const [[item]] = await uploadFileExecute.call(ctx);

			expect(item.json.response).toEqual(expected);
		},
	);

	describe('when the binary property is missing', () => {
		it('throws a NodeOperationError pointing at the item, without calling the API', async () => {
			const { ctx, http } = createMockContext({
				params: { parserId: 'p1', binaryPropertyName: 'data' },
				items: [{ json: {} }],
			});

			const error = await uploadFileExecute.call(ctx).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(NodeOperationError);
			expect((error as NodeOperationError).message).toContain(
				'No binary data property "data" found on item 0',
			);
			expect((error as NodeOperationError).context.itemIndex).toBe(0);
			expect(http).not.toHaveBeenCalled();
		});

		it('also fails when the item has binaries under a different property name', async () => {
			const { ctx } = createMockContext({
				params: { parserId: 'p1', binaryPropertyName: 'data' },
				items: [binaryItem('other')],
				binaryBuffers: { other: PDF },
			});

			await expect(uploadFileExecute.call(ctx)).rejects.toBeInstanceOf(NodeOperationError);
		});

		it('reports the error on the item and carries on when continueOnFail is set', async () => {
			const { ctx, http } = createMockContext({
				params: { parserId: 'p1', binaryPropertyName: 'data' },
				items: [{ json: {} }, binaryItem('data', { fileName: 'ok.pdf' })],
				binaryBuffers: { data: PDF },
				continueOnFail: true,
				httpResponse: { id: 'd2' },
			});

			const [output] = await uploadFileExecute.call(ctx);

			expect(output).toHaveLength(2);
			expect(output[0].json.error).toContain('No binary data property "data" found on item 0');
			expect(output[0].pairedItem).toEqual({ item: 0 });
			expect(output[1].json).toEqual({
				message: 'File uploaded successfully',
				response: { id: 'd2' },
			});
			expect(http).toHaveBeenCalledTimes(1);
		});
	});

	describe('when the API call fails', () => {
		const failing = (continueOnFail: boolean) =>
			createMockContext({
				params: { parserId: 'p1', binaryPropertyName: 'data' },
				items: [binaryItem('data')],
				binaryBuffers: { data: PDF },
				httpError: errorWithStatus('Boom', 500),
				continueOnFail,
			});

		it('rethrows a NodeApiError with the fixed message and HTTP code', async () => {
			const error = await uploadFileExecute.call(failing(false).ctx).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(NodeApiError);
			expect((error as NodeApiError).message).toBe(
				'Error while communicating with the Parseur API',
			);
			expect((error as NodeApiError).httpCode).toBe('500');
		});

		it('returns an error item when continueOnFail is set', async () => {
			const [output] = await uploadFileExecute.call(failing(true).ctx);

			expect(output).toEqual([
				{
					json: { error: 'Error while communicating with the Parseur API' },
					pairedItem: { item: 0 },
				},
			]);
		});
	});

	it('wraps unexpected errors (e.g. reading the binary) into a NodeApiError with the item index', async () => {
		const { ctx, getBinaryDataBuffer } = createMockContext({
			params: { parserId: 'p1', binaryPropertyName: 'data' },
			items: [binaryItem('data')],
		});
		getBinaryDataBuffer.mockRejectedValue(new Error('disk unavailable'));

		const error = await uploadFileExecute.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('disk unavailable');
		expect((error as NodeApiError).context.itemIndex).toBe(0);
		expect((error as NodeApiError).node).toEqual(TEST_NODE);
	});

	it('reports "Unknown error" for non-Error throwables when continueOnFail is set', async () => {
		const { ctx, getNodeParameter } = createMockContext({
			items: [{ json: {} }],
			continueOnFail: true,
		});
		getNodeParameter.mockImplementation(() => {
			throw 'not an error object';
		});

		const [output] = await uploadFileExecute.call(ctx);

		expect(output).toEqual([{ json: { error: 'Unknown error' }, pairedItem: { item: 0 } }]);
	});

	it('uses a generic upload failure message for non-Error throwables when continueOnFail is off', async () => {
		const { ctx, getNodeParameter } = createMockContext({ items: [{ json: {} }] });
		getNodeParameter.mockImplementation(() => {
			throw 'not an error object';
		});

		const error = await uploadFileExecute.call(ctx).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as NodeApiError).message).toBe('Failed to upload file to Parseur');
	});
});
