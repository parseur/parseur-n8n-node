import type { INodeType, INodeTypeDescription, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
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
        inputs: ['main'],
        outputs: ['main'],
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
    async execute(this: IExecuteFunctions) {
        const operation = this.getNodeParameter('operation', 0) as string;

        if (operation === 'uploadFile') {
            return uploadFileExecute.call(this);
        }

        if (operation === 'uploadText') {
            return uploadTextExecute.call(this);
        }

        throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
    }
}