import {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';

import { bitrix24ApiRequest } from './GenericFunctions';

export class Bitrix24Trigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bitrix24 Trigger',
		name: 'bitrix24Trigger',
		icon: 'file:bitrix24.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts workflow on Bitrix24 CRM, Task or Messaging events via webhook',
		defaults: {
			name: 'Bitrix24 Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'bitrix24Api',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],

		properties: [
			// ── Event Category ─────────────────────────────────────────────────
			{
				displayName: 'Event Category',
				name: 'eventCategory',
				type: 'options',
				options: [
					{ name: 'CRM — Deal (Negócio)', value: 'crmDeal' },
					{ name: 'CRM — Lead', value: 'crmLead' },
					{ name: 'CRM — Contact (Contato)', value: 'crmContact' },
					{ name: 'CRM — Company (Empresa)', value: 'crmCompany' },
					{ name: 'Tasks', value: 'tasks' },
					{ name: 'Messages & Chat', value: 'messages' },
				],
				default: 'crmDeal',
			},

			// ── CRM Deal Events ────────────────────────────────────────────────
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				displayOptions: { show: { eventCategory: ['crmDeal'] } },
				options: [
					{ name: 'Deal Created', value: 'ONCRMDEALADD' },
					{ name: 'Deal Updated', value: 'ONCRMDEALUPDATE' },
					{ name: 'Deal Stage Changed', value: 'ONCRMDEALMOVE' },
					{ name: 'Deal Deleted', value: 'ONCRMDEALDELETION' },
				],
				default: 'ONCRMDEALADD',
			},

			// ── CRM Lead Events ────────────────────────────────────────────────
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				displayOptions: { show: { eventCategory: ['crmLead'] } },
				options: [
					{ name: 'Lead Created', value: 'ONCRMLEAD​ADD' },
					{ name: 'Lead Updated', value: 'ONCRMLEADUPDATE' },
					{ name: 'Lead Status Changed', value: 'ONCRMLEADSTATUSCHANGED' },
					{ name: 'Lead Deleted', value: 'ONCRMLEADDELETION' },
				],
				default: 'ONCRMLEADADD',
			},

			// ── CRM Contact Events ─────────────────────────────────────────────
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				displayOptions: { show: { eventCategory: ['crmContact'] } },
				options: [
					{ name: 'Contact Created', value: 'ONCRMCONTACTADD' },
					{ name: 'Contact Updated', value: 'ONCRMCONTACTUPDATE' },
					{ name: 'Contact Deleted', value: 'ONCRMCONTACTDELETION' },
				],
				default: 'ONCRMCONTACTADD',
			},

			// ── CRM Company Events ─────────────────────────────────────────────
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				displayOptions: { show: { eventCategory: ['crmCompany'] } },
				options: [
					{ name: 'Company Created', value: 'ONCRMCOMPANYADD' },
					{ name: 'Company Updated', value: 'ONCRMCOMPANYUPDATE' },
					{ name: 'Company Deleted', value: 'ONCRMCOMPANYDELETION' },
				],
				default: 'ONCRMCOMPANYADD',
			},

			// ── Task Events ────────────────────────────────────────────────────
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				displayOptions: { show: { eventCategory: ['tasks'] } },
				options: [
					{ name: 'Task Created', value: 'ONTASKADD' },
					{ name: 'Task Updated', value: 'ONTASKUPDATE' },
					{ name: 'Task Deleted', value: 'ONTASKDELETE' },
					{ name: 'Task Comment Added', value: 'ONTASKCOMMENTADD' },
				],
				default: 'ONTASKADD',
			},

			// ── Message Events ─────────────────────────────────────────────────
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				displayOptions: { show: { eventCategory: ['messages'] } },
				options: [
					{ name: 'New Open Channel Message', value: 'ONIMBOTMESSAGEADD' },
					{ name: 'Open Line Session Created', value: 'ONOPENLINESSESSIONSTART' },
					{ name: 'Open Line Session Closed', value: 'ONOPENLINESSESSIONFINISH' },
					{ name: 'Chat Message Received', value: 'ONIMMESSAGEADD' },
					{ name: 'User Joined Chat', value: 'ONIMJOINCHAT' },
				],
				default: 'ONIMBOTMESSAGEADD',
			},

			// ── Options ────────────────────────────────────────────────────────
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Include Full Object',
						name: 'fetchFull',
						type: 'boolean',
						default: false,
						description:
							'After receiving the event, fetch the full object from the API (adds an extra request but gives all fields)',
					},
				],
			},
		],
	};

	// ── Webhook lifecycle ─────────────────────────────────────────────────────
	webhookMethods = {
		default: {
			// Called when workflow is ACTIVATED — register the webhook on Bitrix24
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				// If we have a stored handler ID the binding likely exists
				return webhookData.handlerId !== undefined;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const event = this.getNodeParameter('event') as string;
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				const res = await bitrix24ApiRequest.call(this, 'POST', 'event.bind', {
					event,
					handler: webhookUrl,
				});

				if (res.result) {
					const webhookData = this.getWorkflowStaticData('node');
					webhookData.handlerId = `${event}::${webhookUrl}`;
					webhookData.event = event;
					return true;
				}
				return false;
			},

			// Called when workflow is DEACTIVATED — remove the webhook from Bitrix24
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const event = webhookData.event as string;
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				try {
					await bitrix24ApiRequest.call(this, 'POST', 'event.unbind', {
						event,
						handler: webhookUrl,
					});
					delete webhookData.handlerId;
					delete webhookData.event;
					return true;
				} catch (_) {
					return false;
				}
			},
		},
	};

	// ── Incoming webhook handler ──────────────────────────────────────────────
	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const body = req.body as IDataObject;
		const options = this.getNodeParameter('options', {}) as IDataObject;

		let outputData: IDataObject = { ...body };

		// Optionally fetch the full object from Bitrix24 for CRM events
		if (options.fetchFull && body.data) {
			const data = body.data as IDataObject;
			const eventName = (body.event as string ?? '').toUpperCase();

			// Use a direct HTTP request here since IWebhookFunctions is not compatible
			// with bitrix24ApiRequest (which requires IExecuteFunctions context).
			// We re-implement a minimal fetch using this.helpers.request directly.
			const credentials = await this.getCredentials('bitrix24Api');
			const mode = credentials.authMode as string;
			const baseUrl = mode === 'webhook'
				? (credentials.webhookUrl as string).replace(/\/$/, '')
				: `https://${(credentials.domain as string).replace(/\/$/, '')}/rest`;

			const callMethod = async (method: string, params: IDataObject): Promise<IDataObject> => {
				const qs: IDataObject = {};
				if (mode === 'oauth2') qs.auth = credentials.accessToken;
				const response = await this.helpers.request({
					method: 'POST',
					uri: `${baseUrl}/${method}.json`,
					qs,
					body: params,
					json: true,
				});
				return response as IDataObject;
			};

			try {
				const fields = data.FIELDS as IDataObject | undefined;
				const fieldsAfter = data.FIELDS_AFTER as IDataObject | undefined;
				const entityId = fields?.ID as string | undefined;
				const taskId = fieldsAfter?.ID as string | undefined;

				if (eventName.includes('DEAL') && entityId) {
					const res = await callMethod('crm.deal.get', { id: entityId });
					outputData.fullObject = res.result;
				} else if (eventName.includes('LEAD') && entityId) {
					const res = await callMethod('crm.lead.get', { id: entityId });
					outputData.fullObject = res.result;
				} else if (eventName.includes('CONTACT') && entityId) {
					const res = await callMethod('crm.contact.get', { id: entityId });
					outputData.fullObject = res.result;
				} else if (eventName.includes('COMPANY') && entityId) {
					const res = await callMethod('crm.company.get', { id: entityId });
					outputData.fullObject = res.result;
				} else if (eventName.includes('TASK') && taskId) {
					const res = await callMethod('tasks.task.get', { taskId });
					outputData.fullObject = (res.result as IDataObject)?.task;
				}
			} catch (_) {
				// fetchFull is best-effort; don't break on error
			}
		}

		return {
			workflowData: [[{ json: outputData }]],
		};
	}
}
