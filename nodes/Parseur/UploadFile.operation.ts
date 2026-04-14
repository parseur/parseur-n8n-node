import type {
    IBinaryData,
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeProperties,
} from 'n8n-workflow';

import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { parseurApiRequest } from './GenericFunctions';

export const uploadFileDescription: INodeProperties[] = [
    {
        displayName: 'Mailbox Name or ID',
        name: 'parserId',
        type: 'options',
        default: '',
        required: true,
        typeOptions: {
            loadOptionsMethod: 'getParsers',
        },
        displayOptions: {
            show: {
                operation: ['uploadFile'],
            },
        },
        description:
            'Select a parser Mailbox to upload the file to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
    },
    {
        displayName: 'File Property',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        required: true,
        displayOptions: {
            show: {
                operation: ['uploadFile'],
            },
        },
        description: 'Name of the binary property containing the file (from previous node)',
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

export async function uploadFileExecute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        try {
            const parserId = this.getNodeParameter('parserId', itemIndex) as string;
            const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;

            const binary = items[itemIndex].binary;
            const binaryMeta = binary?.[binaryPropertyName] as IBinaryData | undefined;

            if (!binaryMeta) {
                throw new NodeOperationError(
                    this.getNode(),
                    `No binary data property "${binaryPropertyName}" found on item ${itemIndex}`,
                    { itemIndex },
                );
            }

            const binaryData = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

            const formData = new FormData();
            formData.append(
                'file',
                new Blob([binaryData], {
                    type: binaryMeta.mimeType ?? 'application/octet-stream',
                }),
                binaryMeta.fileName ?? 'upload.dat',
            );

            const response = await parseurApiRequest.call(
                this,
                'POST',
                `/parser/${parserId}/upload`,
                formData,
            );

            returnData.push({
                json: {
                    message: 'File uploaded successfully',
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

            throw new NodeApiError(this.getNode(), {
                message: error instanceof Error ? error.message : 'Failed to upload file to Parseur',
            }, { itemIndex });
        }
    }

    return [returnData];
}