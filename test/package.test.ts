import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import { ParseurApi } from '../credentials/ParseurApi.credentials';
import { Parseur } from '../nodes/Parseur/Parseur.node';
import { ParseurTrigger } from '../nodes/Parseur/ParseurTrigger.node';

describe('package.json n8n manifest', () => {
	it('registers both nodes and the credential from dist', () => {
		expect(packageJson.n8n.n8nNodesApiVersion).toBe(1);
		expect(packageJson.n8n.nodes).toEqual([
			'dist/nodes/Parseur/Parseur.node.js',
			'dist/nodes/Parseur/ParseurTrigger.node.js',
		]);
		expect(packageJson.n8n.credentials).toEqual(['dist/credentials/ParseurApi.credentials.js']);
	});

	it('points at files whose class names match the source (build output layout)', () => {
		const classNames = [Parseur, ParseurTrigger].map((c) => c.name);
		for (const entry of packageJson.n8n.nodes) {
			const base = entry.split('/').pop()?.replace('.node.js', '');
			expect(classNames).toContain(base);
		}
		expect(packageJson.n8n.credentials[0]).toContain(ParseurApi.name);
	});

	it('ships only dist and declares n8n-workflow as an unpinned peer dependency', () => {
		expect(packageJson.files).toEqual(['dist']);
		expect(packageJson.peerDependencies).toEqual({ 'n8n-workflow': '*' });
		expect(packageJson).not.toHaveProperty('dependencies');
	});

	it('is tagged as an n8n community node package', () => {
		expect(packageJson.keywords).toContain('n8n-community-node-package');
	});
});
