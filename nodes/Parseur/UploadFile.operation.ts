import { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
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
        description: 'Select a parser Mailbox to upload the file to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>.',
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


export async function uploadFileExecute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {

        const parserId = this.getNodeParameter('parserId', itemIndex) as string;
        const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
        try {
            if (!items[itemIndex].binary || !items[itemIndex].binary![binaryPropertyName]) {
                throw new NodeOperationError(this.getNode(), `No binary data property "${binaryPropertyName}" found on item ${itemIndex}`, {
                    itemIndex,
                });
            }

            const binaryData = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
            const binaryMeta = items[itemIndex].binary![binaryPropertyName];

            const formData = {
                file: {
                    value: binaryData,
                    options: {
                        filename: binaryMeta.fileName || 'upload.dat',
                        contentType: binaryMeta.mimeType || 'application/octet-stream',
                    },
                },
            };

            const response = await parseurApiRequest.call(this, 'POST', `/parser/${parserId}/upload`, {}, {}, formData);

            returnData.push({
                json: {
                    message: 'File uploaded successfully',
                    response,
                },
                pairedItem: itemIndex,
            });
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
}