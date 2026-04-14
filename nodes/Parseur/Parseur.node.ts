import type {
    INodeType,
    INodeTypeDescription,
    INodeExecutionData,
    IExecuteFunctions
} from 'n8n-workflow';
import { NodeOperationError, NodeConnectionTypes } from 'n8n-workflow';
import { uploadFileDescription, uploadFileExecute } from './UploadFile.operation';
import { uploadTextDescription, uploadTextExecute } from './UploadText.operation';
import { getParsers } from './GenericFunctions';

export class Parseur implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Parseur',
        name: 'parseur',
        icon: 'file:parseur.svg',
        group: ['input'],
        version: 1,
        subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
        description: 'Interact with Parseur to upload text or files',
        defaults: {
            name: 'Parseur',
        },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        usableAsTool: true,
        credentials: [
            {
                name: 'parseurApi',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Upload File',
                        value: 'uploadFile',
                        description: 'Upload a file to a mailbox',
                        action: 'Upload a file to a mailbox',
                    },
                    {
                        name: 'Upload Text',
                        value: 'uploadText',
                        description: 'Upload a text/HTML document to a mailbox',
                        action: 'Upload a text html document to a mailbox',
                    },
                ],
                default: 'uploadFile',
            },
            ...uploadFileDescription,
            ...uploadTextDescription,
        ],
    };

    methods = {
        loadOptions: {
            getParsers,
        },
    };

    // This method is executed by n8n with `this` bound to IExecuteFunctions
    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        try {
            const operation = this.getNodeParameter('operation', 0) as string;

            if (operation === 'uploadFile') {
                return await uploadFileExecute.call(this);
            }

            if (operation === 'uploadText') {
                return await uploadTextExecute.call(this);
            }

            throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
        } catch (error: unknown) {
            if (this.continueOnFail()) {
                return [[
                    {
                        json: {
                            error: error instanceof Error ? error.message : 'Unknown error',
                        },
                        pairedItem: { item: 0 },
                    },
                ]];
            }

            throw error;
        }
    }
}