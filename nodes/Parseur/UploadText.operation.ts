import type {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeProperties,
} from 'n8n-workflow';

import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { parseurApiRequest } from './GenericFunctions';

export const uploadTextDescription: INodeProperties[] = [
    {
        displayName: 'Mailbox Email',
        name: 'recipient',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
            show: {
                operation: ['uploadText'],
            },
        },
        description: 'Email address of the Mailbox to send the document to',
    },
    {
        displayName: 'Subject',
        name: 'subject',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
            show: {
                operation: ['uploadText'],
            },
        },
        description: 'Subject line for the document',
    },
    {
        displayName: 'Sender',
        name: 'sender',
        type: 'string',
        default: '',
        displayOptions: {
            show: {
                operation: ['uploadText'],
            },
        },
        description: 'Email of the sender (optional)',
    },
    {
        displayName: 'HTML Content',
        name: 'body_html',
        type: 'string',
        typeOptions: {
            rows: 6,
        },
        default: '',
        displayOptions: {
            show: {
                operation: ['uploadText'],
            },
        },
        description: 'HTML or plain text content to upload as document',
    },
];

function toNodeJsonValue(value: unknown): IDataObject | string | number | boolean | null {
    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
    ) {
        return value;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as IDataObject;
    }

    return {
        value: JSON.stringify(value),
    };
}

export async function uploadTextExecute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        try {
            const recipient = this.getNodeParameter('recipient', itemIndex) as string;
            const subject = this.getNodeParameter('subject', itemIndex) as string;
            const sender = this.getNodeParameter('sender', itemIndex, '') as string;
            const body_html = this.getNodeParameter('body_html', itemIndex, '') as string;

            const body = {
                recipient,
                subject,
                from: sender,
                body_html,
            };

            const response = await parseurApiRequest.call(this, 'POST', '/email', body);

            returnData.push({
                json: {
                    message: 'Text sent successfully',
                    response: toNodeJsonValue(response),
                },
                pairedItem: { item: itemIndex },
            });
        } catch (error: unknown) {
            if (this.continueOnFail()) {
                returnData.push({
                    json: {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    },
                    pairedItem: { item: itemIndex },
                });
                continue;
            }

            if (error instanceof NodeOperationError) {
                throw error;
            }

            if (error instanceof NodeApiError) {
                throw error;
            }

            throw new NodeApiError(
                this.getNode(),
                {
                    message: error instanceof Error ? error.message : 'Failed to send text to Parseur',
                },
                { itemIndex },
            );
        }
    }

    return [returnData];
}