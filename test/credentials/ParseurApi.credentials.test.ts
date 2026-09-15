import { describe, expect, it } from 'vitest';
import { ParseurApi } from '../../credentials/ParseurApi.credentials';
import { Parseur } from '../../nodes/Parseur/Parseur.node';
import { ParseurTrigger } from '../../nodes/Parseur/ParseurTrigger.node';

const credential = new ParseurApi();
const byName = (name: string) => credential.properties.find((p) => p.name === name);

describe('ParseurApi credential', () => {
	it('is named parseurApi and links to the Parseur help centre', () => {
		expect(credential.name).toBe('parseurApi');
		expect(credential.displayName).toBe('Parseur API');
		expect(credential.documentationUrl).toMatch(/^https:\/\/help\.parseur\.com\//);
		expect(credential.icon).toEqual({
			light: 'file:parseur.light.svg',
			dark: 'file:parseur.dark.svg',
		});
	});

	it('exposes exactly the base URL, API key and webhook token fields', () => {
		expect(credential.properties.map((p) => p.name)).toEqual(['url', 'apiKey', 'webhookToken']);
	});

	it('defaults the base URL to the public Parseur API and keeps it optional', () => {
		expect(byName('url')).toMatchObject({ type: 'string', default: 'https://api.parseur.com' });
		expect(byName('url')?.required).toBeUndefined();
	});

	it.each(['apiKey', 'webhookToken'])('treats %s as a required secret', (name) => {
		expect(byName(name)).toMatchObject({
			type: 'string',
			default: '',
			required: true,
			typeOptions: { password: true },
		});
		expect(byName(name)?.hint).toContain('Do not share this token');
	});

	it('authenticates with a bearer token built from the API key', () => {
		expect(credential.authenticate).toEqual({
			type: 'generic',
			properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
		});
	});

	it('tests the credential with GET /user against the configured base URL', () => {
		expect(credential.test).toEqual({
			request: { baseURL: '={{ $credentials.url }}', url: '/user' },
		});
	});

	it('is the credential both nodes require', () => {
		for (const node of [new Parseur(), new ParseurTrigger()]) {
			expect(node.description.credentials).toEqual([{ name: credential.name, required: true }]);
		}
	});
});
