import type {
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData
} from 'n8n-workflow';

import { NodeApiError, NodeConnectionTypes, JsonObject } from 'n8n-workflow';

import { getParsers, parseurApiRequest } from './GenericFunctions';

type ParseurTableField = {
	id: string;
	name: string;
};

type ParseurWebhookResponse = {
	id: string;
};

export class ParseurTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Parseur Trigger',
		name: 'parseurTrigger',
		icon: 'file:parseur.svg',
		group: ['trigger'],
		version: 1,
		description: 'Trigger workflow on events sent from Parseur',
		defaults: {
			name: 'Parseur Trigger',
		},
		credentials: [
			{
				name: 'parseurApi',
				required: true,
			},
		],
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool:true,
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'parseur',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				required: true,
				description: 'For table events, re-select the Mailbox to refresh the table list',
				default: 'document.export_failed',
				options: [
					{ name: 'Document Export Failed', value: 'document.export_failed' },
					{ name: 'Document Processed', value: 'document.processed' },
					{ name: 'Document Processed (Flattened)', value: 'document.processed.flattened' },
					{ name: 'Document Processing Failed', value: 'document.template_needed' },
					{ name: 'Table Processed', value: 'table.processed' },
					{ name: 'Table Processed (Flattened)', value: 'table.processed.flattened' },
				],
			},
			{
				displayName: 'Mailbox Name or ID',
				name: 'parserId',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'getParsers',
					loadOptionsDependsOn: ['event'],
				},
				default: '',
			},
			{
				displayName: 'Table Name or ID',
				name: 'tableFieldId',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getTableFields',
					loadOptionsDependsOn: ['parserId', 'event'],
				},
				displayOptions: {
					show: {
						event: ['table.processed', 'table.processed.flattened'],
					},
				},
				default: '',
			},
		],
	};

	methods = {
		loadOptions: {
			getParsers,

			getTableFields: async function (this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const parserId = this.getNodeParameter('parserId') as string;
				const event = this.getNodeParameter('event') as string;
				const isTable = event.startsWith('table');

				if (!parserId) {
					throw new NodeApiError(this.getNode(), {
						message: 'Select a Mailbox first.',
					});
				}

				const response = (await parseurApiRequest.call(
					this,
					'GET',
					`/parser/${parserId}/table_set`,
				)) as ParseurTableField[];

				const options = response.map((field) => ({
					name: field.name,
					value: field.id,
				}));

				if (isTable && options.length === 0) {
					throw new NodeApiError(this.getNode(), {
						message:
							'This Mailbox has no table fields configured. Please select another Mailbox or change the event type.',
					});
				}

				return options;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		const credentials = await this.getCredentials('parseurApi');
		const headers = this.getHeaderData();

		const receivedToken = headers['x-parseur-token'];
		const receivedEvent = headers['x-parseur-event'];
		const expectedToken = credentials.webhookToken as string;
		const expectedEvent = this.getNodeParameter('event') as string;

		if (!receivedToken || receivedToken !== expectedToken) {
			throw new NodeApiError(this.getNode(), {
				message: 'Unauthorized webhook: token mismatch',
			});
		}

		if (!receivedEvent || receivedEvent !== expectedEvent) {
			throw new NodeApiError(this.getNode(), {
				message: 'Unauthorized webhook: event mismatch',
			});
		}

		return {
			workflowData: [
				[
					{
						json: body as JsonObject,
						pairedItem: { item: 0 },
					},
				],
			],
		};
	}

	webhookMethods = {
		default: {
			checkExists: async function (this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				return !!staticData.webhookId;
			},

			create: async function (this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('parseurApi');
				const parserId = this.getNodeParameter('parserId') as string;
				const tableFieldId = this.getNodeParameter('tableFieldId', 0) as string;
				const event = this.getNodeParameter('event') as string;
				const url = this.getNodeWebhookUrl('default');
				const staticData = this.getWorkflowStaticData('node');
				const isTable = event.startsWith('table');

				if (isTable && !tableFieldId) {
					throw new NodeApiError(this.getNode(), {
						message: 'For table events, you must select a Table Field.',
					});
				}

				const route = isTable
					? `table/${tableFieldId}/n8n/${event}`
					: `parser/${parserId}/n8n/${event}`;

				const requestBody = {
					target: url,
					headers: {
						'X-Parseur-Token': credentials.webhookToken as string,
					},
				};

				const response = (await parseurApiRequest.call(
					this,
					'POST',
					route,
					requestBody,
				)) as ParseurWebhookResponse;

				staticData.webhookId = response.id;
				return true;
			},

			delete: async function (this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookId = staticData.webhookId as string | undefined;

				if (!webhookId) {
					return true;
				}

				try {
					await parseurApiRequest.call(this, 'DELETE', `webhook/${webhookId}`);
				} catch (error: unknown) {
					if (!(error instanceof NodeApiError)) {
						throw error;
					}
				}

				return true;
			},
		},
	};
}