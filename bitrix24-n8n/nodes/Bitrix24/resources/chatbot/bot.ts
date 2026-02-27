import { INodeProperties } from 'n8n-workflow';

// ─── Bot Operations ───────────────────────────────────────────────────────────
export const botOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['chatbot'] } },
		options: [
			{ name: 'Register Bot', value: 'register', action: 'Register a new chatbot' },
			{ name: 'Unregister Bot', value: 'unregister', action: 'Unregister a chatbot' },
			{ name: 'List Bots', value: 'list', action: 'List registered bots' },
			{ name: 'Update Bot', value: 'update', action: 'Update bot settings' },
		],
		default: 'list',
	},
];

export const botFields: INodeProperties[] = [
	// ── REGISTER ──────────────────────────────────────────────────────────────
	{
		displayName: 'Bot Code',
		name: 'botCode',
		type: 'string',
		required: true,
		default: '',
		description: 'Unique code identifier for the bot (e.g. my_support_bot)',
		displayOptions: { show: { resource: ['chatbot'], operation: ['register'] } },
	},
	{
		displayName: 'Bot Name',
		name: 'botName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['chatbot'], operation: ['register'] } },
	},
	{
		displayName: 'Bot Type',
		name: 'botType',
		type: 'options',
		options: [
			{ name: 'Bot (responds to commands)', value: 'B' },
			{ name: 'Human (supervisor)', value: 'H' },
			{ name: 'Network (for open lines)', value: 'N' },
			{ name: 'Supervisor (moderation)', value: 'S' },
		],
		default: 'B',
		displayOptions: { show: { resource: ['chatbot'], operation: ['register'] } },
	},
	{
		displayName: 'Event Handler URL',
		name: 'handlerUrl',
		type: 'string',
		default: '',
		description: 'URL that Bitrix24 will POST events to',
		displayOptions: { show: { resource: ['chatbot'], operation: ['register'] } },
	},
	{
		displayName: 'Additional Options',
		name: 'registerOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['chatbot'], operation: ['register'] } },
		options: [
			{ displayName: 'Avatar URL', name: 'AVATAR', type: 'string', default: '' },
			{ displayName: 'Gender', name: 'GENDER', type: 'options', options: [{ name: 'Male', value: 'M' }, { name: 'Female', value: 'F' }], default: 'M' },
			{ displayName: 'Color', name: 'COLOR', type: 'string', default: '', description: 'HEX color without # (e.g. FF0000)' },
			{ displayName: 'Welcome Message', name: 'WELCOME_MESSAGE', type: 'string', default: '' },
		],
	},

	// ── UNREGISTER / UPDATE ───────────────────────────────────────────────────
	{
		displayName: 'Bot',
		name: 'botId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getChatBots' },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['chatbot'], operation: ['unregister', 'update'] } },
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['chatbot'], operation: ['update'] } },
		options: [
			{ displayName: 'Bot Name', name: 'NAME', type: 'string', default: '' },
			{ displayName: 'Event Handler URL', name: 'HANDLER', type: 'string', default: '' },
			{ displayName: 'Welcome Message', name: 'WELCOME_MESSAGE', type: 'string', default: '' },
			{ displayName: 'Avatar URL', name: 'AVATAR', type: 'string', default: '' },
		],
	},
];

// ─── Bot Message Operations ───────────────────────────────────────────────────
export const botMessageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['chatbotMessage'] } },
		options: [
			{ name: 'Send Message', value: 'send', action: 'Send a message as a chatbot' },
			{ name: 'Update Message', value: 'update', action: 'Update a bot message' },
			{ name: 'Delete Message', value: 'delete', action: 'Delete a bot message' },
		],
		default: 'send',
	},
];

export const botMessageFields: INodeProperties[] = [
	{
		displayName: 'Bot',
		name: 'botId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getChatBots' },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['chatbotMessage'] } },
	},
	{
		displayName: 'Dialog ID',
		name: 'dialogId',
		type: 'string',
		required: true,
		default: '',
		description: 'Chat ID or user ID to send to (e.g. chat123 or user|5)',
		displayOptions: { show: { resource: ['chatbotMessage'], operation: ['send'] } },
	},
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['chatbotMessage'], operation: ['update', 'delete'] } },
	},
	{
		displayName: 'Message Text',
		name: 'messageText',
		type: 'string',
		required: true,
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: { show: { resource: ['chatbotMessage'], operation: ['send', 'update'] } },
	},
	{
		displayName: 'Message Options',
		name: 'messageOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['chatbotMessage'], operation: ['send'] } },
		options: [
			{
				displayName: 'Keyboard (JSON)',
				name: 'KEYBOARD',
				type: 'json',
				default: '{}',
				description: 'Quick reply buttons. Example: {"BUTTONS": [[{"TEXT": "Yes", "ACTION": "SEND", "COMMAND": "yes"}]]}',
			},
			{
				displayName: 'Attach (JSON)',
				name: 'ATTACH',
				type: 'json',
				default: '[]',
				description: 'Rich message attachments (cards, links, images)',
			},
			{
				displayName: 'System',
				name: 'SYSTEM',
				type: 'boolean',
				default: false,
				description: 'Send as system message without author info',
			},
		],
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest } from '../../GenericFunctions';

export async function executeBot(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'register') {
		const code = this.getNodeParameter('botCode', i) as string;
		const name = this.getNodeParameter('botName', i) as string;
		const type = this.getNodeParameter('botType', i) as string;
		const handler = this.getNodeParameter('handlerUrl', i, '') as string;
		const opts = this.getNodeParameter('registerOptions', i, {}) as IDataObject;

		const body: IDataObject = { CODE: code, TYPE: type, EVENT_HANDLER: handler, PROPERTIES: { NAME: name, ...opts } };
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imbot.register', body);
		responseData = { id: res.result, success: true };
	}
	else if (operation === 'unregister') {
		const id = this.getNodeParameter('botId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imbot.unregister', { BOT_ID: id });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'list') {
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imbot.bot.list', {});
		responseData = { items: res.result, total: res.total };
	}
	else if (operation === 'update') {
		const id = this.getNodeParameter('botId', i) as string;
		const fields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imbot.update', { BOT_ID: id, FIELDS: fields });
		responseData = { success: res.result as boolean };
	}

	return responseData;
}

export async function executeBotMessage(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'send') {
		const botId = this.getNodeParameter('botId', i) as string;
		const dialogId = this.getNodeParameter('dialogId', i) as string;
		const message = this.getNodeParameter('messageText', i) as string;
		const opts = this.getNodeParameter('messageOptions', i, {}) as IDataObject;

		const body: IDataObject = { BOT_ID: botId, DIALOG_ID: dialogId, MESSAGE: message };
		if (opts.KEYBOARD) {
			try { body.KEYBOARD = JSON.parse(opts.KEYBOARD as string); } catch (_) {}
		}
		if (opts.ATTACH) {
			try { body.ATTACH = JSON.parse(opts.ATTACH as string); } catch (_) {}
		}
		if (opts.SYSTEM) body.SYSTEM = 'Y';

		const res = await bitrix24ApiRequest.call(this, 'POST', 'imbot.message.add', body);
		responseData = { messageId: res.result, success: true };
	}
	else if (operation === 'update') {
		const botId = this.getNodeParameter('botId', i) as string;
		const messageId = this.getNodeParameter('messageId', i) as string;
		const message = this.getNodeParameter('messageText', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imbot.message.update', {
			BOT_ID: botId, MESSAGE_ID: messageId, MESSAGE: message,
		});
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'delete') {
		const botId = this.getNodeParameter('botId', i) as string;
		const messageId = this.getNodeParameter('messageId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imbot.message.delete', {
			BOT_ID: botId, MESSAGE_ID: messageId,
		});
		responseData = { success: res.result as boolean };
	}

	return responseData;
}
