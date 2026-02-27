import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	IDataObject,
} from 'n8n-workflow';

// ── CRM ───────────────────────────────────────────────────────────────────────
import { dealOperations, dealFields, executeDeal } from './resources/crm/deal';
import { leadOperations, leadFields, executeLead } from './resources/crm/lead';
import { contactOperations, contactFields, executeContact } from './resources/crm/contact';
import { companyOperations, companyFields, executeCompany } from './resources/crm/company';
import {
	timelineCommentOperations, timelineCommentFields, executeTimelineComment,
	timelineNoteOperations, timelineNoteFields, executeTimelineNote,
	timelineBindingOperations, timelineBindingFields, executeTimelineBinding,
	timelineActivityOperations, timelineActivityFields, executeTimelineActivity,
} from './resources/crm/timeline';
import { productRowOperations, productRowFields, executeProductRow } from './resources/crm/productRows';

// ── Tasks ─────────────────────────────────────────────────────────────────────
import {
	taskOperations, taskFields,
	taskCommentOperations, taskCommentFields,
	executeTask, executeTaskComment,
} from './resources/tasks/task';

// ── Users ─────────────────────────────────────────────────────────────────────
import { userOperations, userFields, executeUser } from './resources/users/user';

// ── Open Channels ─────────────────────────────────────────────────────────────
import {
	openChannelMessageOperations, openChannelMessageFields,
	conversationOperations, conversationFields,
	executeOpenChannelMessage, executeConversation,
} from './resources/openChannels/message';

// ── Chatbot ───────────────────────────────────────────────────────────────────
import {
	botOperations, botFields,
	botMessageOperations, botMessageFields,
	executeBot, executeBotMessage,
} from './resources/chatbot/bot';

// ── Drive ─────────────────────────────────────────────────────────────────────
import {
	driveFileOperations, driveFileFields,
	driveFolderOperations, driveFolderFields,
	executeDriveFile, executeDriveFolder,
} from './resources/drive/file';

// ── Document Generator ────────────────────────────────────────────────────────
import {
	documentGeneratorOperations, documentGeneratorFields,
	executeDocumentGenerator,
} from './resources/documentGenerator/document';

// ── News Feed ─────────────────────────────────────────────────────────────────
import {
	blogPostOperations, blogPostFields,
	crmActivityOperations, crmActivityFields,
	executeBlogPost, executeCrmActivity,
} from './resources/newsFeed/newsFeed';

// ── Raw API ───────────────────────────────────────────────────────────────────
import { rawApiOperations, rawApiFields, executeRawApi } from './resources/rawApi/rawApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
import {
	getUsers, getDealCategories, getDealStages, getLeadStatuses,
	getCrmCustomFields, getOpenLines, getChatBots, getDriveStorages,
} from './GenericFunctions';

export class Bitrix24 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bitrix24',
		name: 'bitrix24',
		icon: 'file:bitrix24.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Bitrix24 — CRM, Tasks, Open Channels, Chatbots, Drive, Documents, News Feed and Raw API',
		defaults: { name: 'Bitrix24' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'bitrix24Api', required: true }],

		properties: [

			// ── Category ──────────────────────────────────────────────────────
			{
				displayName: 'Category',
				name: 'category',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: '📋 CRM', value: 'crm' },
					{ name: '✅ Tasks', value: 'tasks' },
					{ name: '👤 Users', value: 'users' },
					{ name: '💬 Open Channels', value: 'openChannels' },
					{ name: '🤖 Chatbot', value: 'chatbot' },
					{ name: '📁 Drive', value: 'drive' },
					{ name: '📄 Document Generator', value: 'documentGenerator' },
					{ name: '📰 News Feed', value: 'newsFeed' },
					{ name: '⚡ Raw API', value: 'rawApi' },
				],
				default: 'crm',
			},

			// ── Resources ─────────────────────────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { category: ['crm'] } },
				options: [
					{ name: 'Deal (Negócio)', value: 'deal' },
					{ name: 'Lead', value: 'lead' },
					{ name: 'Contact (Contato)', value: 'contact' },
					{ name: 'Company (Empresa)', value: 'company' },
					{ name: 'Timeline Comment', value: 'timelineComment' },
					{ name: 'Timeline Note', value: 'timelineNote' },
					{ name: 'Timeline Binding', value: 'timelineBinding' },
					{ name: 'Timeline Activity', value: 'timelineActivity' },
					{ name: 'Product Row (Linha de Produto)', value: 'productRow' },
				],
				default: 'deal',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { category: ['tasks'] } },
				options: [
					{ name: 'Task (Tarefa)', value: 'task' },
					{ name: 'Task Comment', value: 'taskComment' },
				],
				default: 'task',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { category: ['users'] } },
				options: [{ name: 'User', value: 'user' }],
				default: 'user',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { category: ['openChannels'] } },
				options: [
					{ name: 'Message', value: 'openChannelMessage' },
					{ name: 'Conversation (Session)', value: 'conversation' },
				],
				default: 'openChannelMessage',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { category: ['chatbot'] } },
				options: [
					{ name: 'Bot', value: 'chatbot' },
					{ name: 'Bot Message', value: 'chatbotMessage' },
				],
				default: 'chatbot',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { category: ['drive'] } },
				options: [
					{ name: 'File', value: 'driveFile' },
					{ name: 'Folder', value: 'driveFolder' },
				],
				default: 'driveFile',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { category: ['documentGenerator'] } },
				options: [{ name: 'Document', value: 'documentGenerator' }],
				default: 'documentGenerator',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { category: ['newsFeed'] } },
				options: [
					{ name: 'Blog Post (Live Feed)', value: 'blogPost' },
					{ name: 'CRM Activity', value: 'crmActivity' },
				],
				default: 'blogPost',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { category: ['rawApi'] } },
				options: [{ name: 'API Call', value: 'rawApi' }],
				default: 'rawApi',
			},

			// ── Operations & Fields ───────────────────────────────────────────
			...dealOperations,           ...dealFields,
			...leadOperations,           ...leadFields,
			...contactOperations,        ...contactFields,
			...companyOperations,        ...companyFields,
				...timelineCommentOperations,  ...timelineCommentFields,
				...timelineNoteOperations,     ...timelineNoteFields,
				...timelineBindingOperations,  ...timelineBindingFields,
				...timelineActivityOperations, ...timelineActivityFields,
				...productRowOperations,       ...productRowFields,
			...taskOperations,           ...taskFields,
			...taskCommentOperations,    ...taskCommentFields,
			...userOperations,           ...userFields,
			...openChannelMessageOperations, ...openChannelMessageFields,
			...conversationOperations,   ...conversationFields,
			...botOperations,            ...botFields,
			...botMessageOperations,     ...botMessageFields,
			...driveFileOperations,      ...driveFileFields,
			...driveFolderOperations,    ...driveFolderFields,
			...documentGeneratorOperations, ...documentGeneratorFields,
			...blogPostOperations,       ...blogPostFields,
			...crmActivityOperations,    ...crmActivityFields,
			...rawApiOperations,         ...rawApiFields,
		],
	};

	// ── loadOptions ───────────────────────────────────────────────────────────
	methods = {
		loadOptions: {
			async getUsers(this: ILoadOptionsFunctions) { return getUsers.call(this); },
			async getDealCategories(this: ILoadOptionsFunctions) { return getDealCategories.call(this); },
			async getDealStages(this: ILoadOptionsFunctions) { return getDealStages.call(this); },
			async getLeadStatuses(this: ILoadOptionsFunctions) { return getLeadStatuses.call(this); },
			async getDealCustomFields(this: ILoadOptionsFunctions) { return getCrmCustomFields.call(this, 'deal'); },
			async getLeadCustomFields(this: ILoadOptionsFunctions) { return getCrmCustomFields.call(this, 'lead'); },
			async getContactCustomFields(this: ILoadOptionsFunctions) { return getCrmCustomFields.call(this, 'contact'); },
			async getCompanyCustomFields(this: ILoadOptionsFunctions) { return getCrmCustomFields.call(this, 'company'); },
			async getOpenLines(this: ILoadOptionsFunctions) { return getOpenLines.call(this); },
			async getChatBots(this: ILoadOptionsFunctions) { return getChatBots.call(this); },
			async getDriveStorages(this: ILoadOptionsFunctions) { return getDriveStorages.call(this); },
		},
	};

	// ── Execute ───────────────────────────────────────────────────────────────
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let responseData: IDataObject = {};

				switch (resource) {
					case 'deal':               responseData = await executeDeal.call(this, operation, i); break;
					case 'lead':               responseData = await executeLead.call(this, operation, i); break;
					case 'contact':            responseData = await executeContact.call(this, operation, i); break;
					case 'company':            responseData = await executeCompany.call(this, operation, i); break;
					case 'timelineComment':    responseData = await executeTimelineComment.call(this, operation, i); break;
					case 'timelineNote':       responseData = await executeTimelineNote.call(this, operation, i); break;
					case 'timelineBinding':    responseData = await executeTimelineBinding.call(this, operation, i); break;
					case 'timelineActivity':   responseData = await executeTimelineActivity.call(this, operation, i); break;
					case 'productRow':         responseData = await executeProductRow.call(this, operation, i); break;
					case 'task':               responseData = await executeTask.call(this, operation, i); break;
					case 'taskComment':        responseData = await executeTaskComment.call(this, operation, i); break;
					case 'user':               responseData = await executeUser.call(this, operation, i); break;
					case 'openChannelMessage': responseData = await executeOpenChannelMessage.call(this, operation, i); break;
					case 'conversation':       responseData = await executeConversation.call(this, operation, i); break;
					case 'chatbot':            responseData = await executeBot.call(this, operation, i); break;
					case 'chatbotMessage':     responseData = await executeBotMessage.call(this, operation, i); break;
					case 'driveFile':          responseData = await executeDriveFile.call(this, operation, i); break;
					case 'driveFolder':        responseData = await executeDriveFolder.call(this, operation, i); break;
					case 'documentGenerator':  responseData = await executeDocumentGenerator.call(this, operation, i); break;
					case 'blogPost':           responseData = await executeBlogPost.call(this, operation, i); break;
					case 'crmActivity':        responseData = await executeCrmActivity.call(this, operation, i); break;
					case 'rawApi':             responseData = await executeRawApi.call(this, operation, i); break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
				}

				returnData.push({ json: responseData });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
