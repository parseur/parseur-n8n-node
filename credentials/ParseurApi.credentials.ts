import type { IAuthenticateGeneric, ICredentialType, ICredentialTestRequest, INodeProperties, Icon } from 'n8n-workflow';

export class ParseurApi implements ICredentialType {
	name = 'parseurApi';
	displayName = 'Parseur API';
	icon = 'file:parseur.svg' as Icon;
	documentationUrl = 'https://help.parseur.com/';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'url',
			type: 'string',
			default: 'https://api.parseur.com',
			description: 'Override the default base URL for the API',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			hint: ('Required to authenticate API requests to Parseur.'
				+ '<br/><strong>Do not share this token.</strong><br/>'
				+ 'You can find your API Key in your Parseur account settings: <a href="https://app.parseur.com/account" target="_blank">https://app.parseur.com/account</a>.'),
			description: ('Your personal API Key used to authenticate requests to the Parseur API. '
				+ 'Keep this key secure and do not share it.'),
		},
		{
			displayName: 'Webhook Token',
			name: 'webhookToken',
			type: 'string',
			default: '',
			required: true,
			// eslint-disable-next-line n8n-nodes-base/cred-class-field-type-options-password-missing
			typeOptions: {
				password: false,
			},
			hint: ('Required to verify that incoming webhook requests are from n8n.'
				+ '<br/><strong>Do not share this token.</strong><br/>'
				+ 'Generate a secure token (e.g., using <a href="https://www.uuidgenerator.net/" target="_blank">https://www.uuidgenerator.net/</a>) and paste it here.'),
			description: (
				'Token used to authorize incoming webhook requests. '
				+ 'The HTTP header <code>X-Parseur-Token</code> must exactly match this value.'),
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.url }}',
			url: '/user',
		},
	}
}