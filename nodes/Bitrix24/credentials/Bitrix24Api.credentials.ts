import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class Bitrix24Api implements ICredentialType {
	name = 'bitrix24Api';
	displayName = 'Bitrix24 API';
	documentationUrl = 'https://apidocs.bitrix24.com/';

	properties: INodeProperties[] = [
		{
			displayName: 'Authentication Mode',
			name: 'authMode',
			type: 'options',
			options: [
				{
					name: 'Webhook (Inbound)',
					value: 'webhook',
					description: 'Use a Bitrix24 inbound webhook URL with embedded token',
				},
				{
					name: 'OAuth2',
					value: 'oauth2',
					description: 'Use OAuth2 for registered Bitrix24 marketplace apps',
				},
			],
			default: 'webhook',
		},

		// ── WEBHOOK MODE ──────────────────────────────────────────────────────────
		{
			displayName: 'Webhook URL',
			name: 'webhookUrl',
			type: 'string',
			default: '',
			placeholder: 'https://your-domain.bitrix24.com/rest/1/your-token/',
			description:
				'Full inbound webhook URL from Bitrix24 → Developer → Inbound webhooks. Include the trailing slash.',
			displayOptions: { show: { authMode: ['webhook'] } },
		},

		// ── OAUTH2 MODE ───────────────────────────────────────────────────────────
		{
			displayName: 'Bitrix24 Domain',
			name: 'domain',
			type: 'string',
			default: '',
			placeholder: 'your-domain.bitrix24.com',
			description: 'Your Bitrix24 portal domain without https://',
			displayOptions: { show: { authMode: ['oauth2'] } },
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			displayOptions: { show: { authMode: ['oauth2'] } },
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: { show: { authMode: ['oauth2'] } },
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'OAuth2 access token obtained after authorization',
			displayOptions: { show: { authMode: ['oauth2'] } },
		},
		{
			displayName: 'Refresh Token',
			name: 'refreshToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			displayOptions: { show: { authMode: ['oauth2'] } },
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.authMode === "webhook" ? $credentials.webhookUrl : "https://" + $credentials.domain + "/rest/"}}',
			url: 'app.info',
			method: 'GET',
		},
	};
}
