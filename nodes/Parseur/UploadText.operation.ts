import type { IExecuteFunctions } from 'n8n-workflow';
import type { INodeExecutionData, INodeProperties } from 'n8n-workflow';
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

export async function uploadTextExecute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
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

        try {
            const response = await parseurApiRequest.call(this, 'POST', 'email', body);
            returnData.push({ json: { message: 'Text sent successfully', response } });
        } catch (error) {
            if (this.continueOnFail()) {
                returnData.push({
                    json: {
                        error: (error as Error).message,
                    },
                    pairedItem: itemIndex,
                });
            } else {
                if (error instanceof NodeOperationError) {
                    throw error;
                } else if (error instanceof NodeApiError) {
                    throw new NodeApiError(this.getNode(), { message: error.message }, { itemIndex });
                } else {
                    throw new NodeApiError(this.getNode(), error, { itemIndex });
                }
            }
        }
    }

    return [returnData];
};