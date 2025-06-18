import {
	ILoadOptionsFunctions,
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	IWebhookResponseData,
} from 'n8n-workflow';

import { NodeApiError } from 'n8n-workflow';
import { parseurApiRequest, getParsers } from './GenericFunctions';

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
		credentials: [{ name: 'parseurApi', required: true }],
		inputs: [],
		outputs: ['main'],
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
				description: 'For table events, make sure to re-select the Mailbox to refresh table list',
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
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
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
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
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
			}
		],
	};

	methods = {
		loadOptions: {
			/**
			 * Return available mailbox parsers.
			 */
			getParsers,

			/**
			 * Return table fields of a parser if a table event is selected.
			 */
			getTableFields: async function (this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const parserId = this.getNodeParameter('parserId') as string;
				const event = this.getNodeParameter('event') as string;
				const isTable = event.startsWith('table');

				if (!parserId) {
					throw new NodeApiError(this.getNode(), { message: 'Select a Mailbox before.' });
				}

				const response = await parseurApiRequest.call(this, 'GET', `/parser/${parserId}/table_set`)
				const options = response.map((field: any) => ({
					name: field.name,
					value: field.id,
				}));

				if (isTable && (!options || options.length === 0)) {
					throw new NodeApiError(this.getNode(), {
						message: 'This Mailbox has no table fields configured. Please select another Mailbox or change the event type.',
					});
				}

				return options;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		const credentials = await this.getCredentials('parseurApi');
		const receivedToken = this.getHeaderData()['x-parseur-token'];
		const receivedEvent = this.getHeaderData()['x-parseur-event'];
		const expectedToken = credentials.webhookToken;
		const expectedEvent = this.getNodeParameter('event') as string;

		if (!receivedToken || receivedToken !== expectedToken) {
			throw new NodeApiError(this.getNode(), { message: 'Unauthorized webhook: token mismatch' });
		}

		if (!receivedEvent || receivedEvent !== expectedEvent) {
			throw new NodeApiError(this.getNode(), { message: 'Unauthorized webhook: event mismatch' });
		}

		return {
			workflowData: [[{ json: body }]],
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

				const body = {
					target: url,
					headers: {
						'X-Parseur-Token': credentials.webhookToken,
					},
				};

				const response = await parseurApiRequest.call(this, 'POST', route, body);
				staticData.webhookId = response.id;
				return true;
			},

			delete: async function (this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const webhookId = staticData.webhookId;

				if (!webhookId) return true;
				try {
					await parseurApiRequest.call(this, 'DELETE', `webhook/${webhookId}`);
				} catch (error) {
					if (error instanceof NodeApiError) {
						/**
						 * Failed to delete webhook, but ignoring.
						 * */
					} else {
						throw error;
					}
				}
				return true;
			},
		},
	};
}
