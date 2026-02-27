import { INodeProperties } from 'n8n-workflow';

// ─── Message Operations ───────────────────────────────────────────────────────
export const openChannelMessageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['openChannelMessage'] } },
		options: [
			{ name: 'Send Message', value: 'send', action: 'Send a message to an open channel chat' },
			{ name: 'Get History', value: 'history', action: 'Get chat message history' },
			{ name: 'Delete Message', value: 'delete', action: 'Delete a message' },
		],
		default: 'send',
	},
];

export const openChannelMessageFields: INodeProperties[] = [
	// ── SEND ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the open channel chat/session',
		displayOptions: { show: { resource: ['openChannelMessage'], operation: ['send', 'history'] } },
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		required: true,
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: { show: { resource: ['openChannelMessage'], operation: ['send'] } },
	},
	{
		displayName: 'Additional Options',
		name: 'sendOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['openChannelMessage'], operation: ['send'] } },
		options: [
			{
				displayName: 'Keyboard Buttons (JSON)',
				name: 'keyboard',
				type: 'json',
				default: '{}',
				description: 'JSON for quick reply keyboard buttons',
			},
			{
				displayName: 'Attach (JSON)',
				name: 'attach',
				type: 'json',
				default: '[]',
				description: 'Attach rich blocks (cards, images, etc.)',
			},
			{
				displayName: 'System Message',
				name: 'system',
				type: 'boolean',
				default: false,
				description: 'Send as a system notification (no author name)',
			},
		],
	},

	// ── HISTORY ───────────────────────────────────────────────────────────────
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 20,
		description: 'Number of messages to return',
		displayOptions: { show: { resource: ['openChannelMessage'], operation: ['history'] } },
	},

	// ── DELETE ────────────────────────────────────────────────────────────────
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['openChannelMessage'], operation: ['delete'] } },
	},
];

// ─── Conversation Operations ──────────────────────────────────────────────────
export const conversationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['conversation'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get a conversation/session' },
			{ name: 'List', value: 'list', action: 'List open channel sessions' },
			{ name: 'Complete', value: 'complete', action: 'Complete/close a conversation' },
			{ name: 'Assign', value: 'assign', action: 'Assign conversation to a user' },
		],
		default: 'list',
	},
];

export const conversationFields: INodeProperties[] = [
	{
		displayName: 'Session ID',
		name: 'sessionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['conversation'], operation: ['get', 'complete', 'assign'] } },
	},
	{
		displayName: 'Open Line',
		name: 'lineId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getOpenLines' },
		default: '',
		displayOptions: { show: { resource: ['conversation'], operation: ['list'] } },
	},
	{
		displayName: 'Assign To User',
		name: 'assignUserId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getUsers' },
		default: '',
		displayOptions: { show: { resource: ['conversation'], operation: ['assign'] } },
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 20,
		displayOptions: { show: { resource: ['conversation'], operation: ['list'] } },
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest } from '../../GenericFunctions';

export async function executeOpenChannelMessage(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'send') {
		const chatId = this.getNodeParameter('chatId', i) as string;
		const message = this.getNodeParameter('message', i) as string;
		const sendOptions = this.getNodeParameter('sendOptions', i, {}) as IDataObject;

		const body: IDataObject = {
			CHAT_ID: chatId,
			MESSAGE: message,
		};

		if (sendOptions.keyboard) {
			try { body.KEYBOARD = JSON.parse(sendOptions.keyboard as string); } catch (_) {}
		}
		if (sendOptions.attach) {
			try { body.ATTACH = JSON.parse(sendOptions.attach as string); } catch (_) {}
		}
		if (sendOptions.system) {
			body.SYSTEM = 'Y';
		}

		const res = await bitrix24ApiRequest.call(this, 'POST', 'imopenlines.bot.message.add', body);
		responseData = { messageId: res.result, success: true };
	}
	else if (operation === 'history') {
		const chatId = this.getNodeParameter('chatId', i) as string;
		const limit = this.getNodeParameter('limit', i, 20) as number;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'im.dialog.messages.get', {
			DIALOG_ID: `chat${chatId}`,
			LIMIT: limit,
		});
		responseData = res.result as IDataObject;
	}
	else if (operation === 'delete') {
		const messageId = this.getNodeParameter('messageId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'im.message.delete', { MESSAGE_ID: messageId });
		responseData = { success: res.result as boolean };
	}

	return responseData;
}

export async function executeConversation(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'get') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imopenlines.session.get', { SESSION_ID: sessionId });
		responseData = res.result as IDataObject;
	}
	else if (operation === 'list') {
		const lineId = this.getNodeParameter('lineId', i, '') as string;
		const limit = this.getNodeParameter('limit', i, 20) as number;
		const body: IDataObject = { LIMIT: limit };
		if (lineId) body.LINE_ID = lineId;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imopenlines.session.list', body);
		responseData = { items: res.result, total: res.total };
	}
	else if (operation === 'complete') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imopenlines.session.finish', { SESSION_ID: sessionId });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'assign') {
		const sessionId = this.getNodeParameter('sessionId', i) as string;
		const userId = this.getNodeParameter('assignUserId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'imopenlines.session.transfer', {
			SESSION_ID: sessionId,
			USER_ID: userId,
		});
		responseData = { success: res.result as boolean };
	}

	return responseData;
}
