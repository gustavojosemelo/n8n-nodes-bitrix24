import { INodeProperties } from 'n8n-workflow';

// ─── Operations ───────────────────────────────────────────────────────────────
export const documentGeneratorOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['documentGenerator'] } },
		options: [
			{
				name: 'List Templates',
				value: 'listTemplates',
				description: 'List all available document templates',
				action: 'List document templates',
			},
			{
				name: 'Get Template',
				value: 'getTemplate',
				description: 'Get details of a specific template',
				action: 'Get a template',
			},
			{
				name: 'Generate Document',
				value: 'generate',
				description: 'Generate a document from a template bound to a CRM entity',
				action: 'Generate a document',
			},
			{
				name: 'Get Document',
				value: 'getDocument',
				description: 'Get details and status of a generated document',
				action: 'Get a document',
			},
			{
				name: 'List Documents',
				value: 'listDocuments',
				description: 'List generated documents',
				action: 'List documents',
			},
			{
				name: 'Get Download URL',
				value: 'getDownloadUrl',
				description: 'Get the PDF download URL for a generated document',
				action: 'Get document download URL',
			},
			{
				name: 'Delete Document',
				value: 'deleteDocument',
				description: 'Delete a generated document',
				action: 'Delete a document',
			},
		],
		default: 'listTemplates',
	},
];

// ─── Fields ───────────────────────────────────────────────────────────────────
export const documentGeneratorFields: INodeProperties[] = [

	// ── GET TEMPLATE ──────────────────────────────────────────────────────────
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the document template',
		displayOptions: {
			show: { resource: ['documentGenerator'], operation: ['getTemplate', 'generate'] },
		},
	},

	// ── LIST TEMPLATES ────────────────────────────────────────────────────────
	{
		displayName: 'Filter Templates',
		name: 'templateFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['documentGenerator'], operation: ['listTemplates'] } },
		options: [
			{
				displayName: 'Entity Type',
				name: 'entityTypeId',
				type: 'options',
				options: [
					{ name: 'Deal (Negócio)', value: 2 },
					{ name: 'Lead', value: 1 },
					{ name: 'Contact (Contato)', value: 3 },
					{ name: 'Company (Empresa)', value: 4 },
					{ name: 'Quote (Orçamento)', value: 7 },
					{ name: 'Invoice (Fatura)', value: 31 },
				],
				default: 2,
				description: 'Filter templates by CRM entity type',
			},
			{
				displayName: 'Active Only',
				name: 'active',
				type: 'boolean',
				default: true,
			},
		],
	},

	// ── GENERATE ──────────────────────────────────────────────────────────────
	{
		displayName: 'Entity Type',
		name: 'entityTypeId',
		type: 'options',
		required: true,
		options: [
			{ name: 'Deal (Negócio)', value: 2 },
			{ name: 'Lead', value: 1 },
			{ name: 'Contact (Contato)', value: 3 },
			{ name: 'Company (Empresa)', value: 4 },
			{ name: 'Quote (Orçamento)', value: 7 },
			{ name: 'Invoice (Fatura)', value: 31 },
		],
		default: 2,
		description: 'CRM entity type the document will be generated for',
		displayOptions: { show: { resource: ['documentGenerator'], operation: ['generate'] } },
	},
	{
		displayName: 'Entity ID',
		name: 'entityId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the CRM entity (Deal ID, Lead ID, etc.)',
		displayOptions: { show: { resource: ['documentGenerator'], operation: ['generate'] } },
	},
	{
		displayName: 'Generate Options',
		name: 'generateOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['documentGenerator'], operation: ['generate'] } },
		options: [
			{
				displayName: 'Values (JSON)',
				name: 'values',
				type: 'json',
				default: '{}',
				description:
					'Override template placeholder values. Example: {"ClientName": "Acme Corp", "Amount": "R$ 5.000"}',
			},
			{
				displayName: 'Stamp Enabled',
				name: 'stampsEnabled',
				type: 'boolean',
				default: false,
				description: 'Include stamp/signature block in the document',
			},
		],
	},

	// ── GET / DELETE / DOWNLOAD DOCUMENT ─────────────────────────────────────
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['documentGenerator'],
				operation: ['getDocument', 'deleteDocument', 'getDownloadUrl'],
			},
		},
	},

	// ── LIST DOCUMENTS ────────────────────────────────────────────────────────
	{
		displayName: 'Filter Documents',
		name: 'documentFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['documentGenerator'], operation: ['listDocuments'] } },
		options: [
			{
				displayName: 'Entity Type',
				name: 'entityTypeId',
				type: 'options',
				options: [
					{ name: 'Deal (Negócio)', value: 2 },
					{ name: 'Lead', value: 1 },
					{ name: 'Contact (Contato)', value: 3 },
					{ name: 'Company (Empresa)', value: 4 },
				],
				default: 2,
			},
			{
				displayName: 'Entity ID',
				name: 'entityId',
				type: 'string',
				default: '',
				description: 'Filter documents by a specific entity ID',
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				default: '',
			},
		],
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 50,
		displayOptions: {
			show: { resource: ['documentGenerator'], operation: ['listDocuments', 'listTemplates'] },
		},
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';

export async function executeDocumentGenerator(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'listTemplates') {
		const filters = this.getNodeParameter('templateFilters', i, {}) as IDataObject;
		const limit = this.getNodeParameter('limit', i, 50) as number;

		const body: IDataObject = { start: 0 };
		if (filters.entityTypeId) body.entityTypeId = filters.entityTypeId;
		if (filters.active !== undefined) body.active = filters.active ? 'Y' : 'N';

		if (limit === 0) {
			const items = await bitrix24ApiRequestAllItems.call(
				this, 'POST', 'crm.documentgenerator.template.list', body,
			);
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(
				this, 'POST', 'crm.documentgenerator.template.list', { ...body, count: limit },
			);
			responseData = { items: (res.result as IDataObject)?.items ?? res.result, total: res.total };
		}
	}

	else if (operation === 'getTemplate') {
		const id = this.getNodeParameter('templateId', i) as string;
		const res = await bitrix24ApiRequest.call(
			this, 'POST', 'crm.documentgenerator.template.get', { id },
		);
		const resultObj = res.result as IDataObject;
		responseData = (resultObj?.template as IDataObject) ?? resultObj;
	}

	else if (operation === 'generate') {
		const templateId = this.getNodeParameter('templateId', i) as string;
		const entityTypeId = this.getNodeParameter('entityTypeId', i) as number;
		const entityId = this.getNodeParameter('entityId', i) as string;
		const opts = this.getNodeParameter('generateOptions', i, {}) as IDataObject;

		const body: IDataObject = {
			templateId,
			entityTypeId,
			entityId,
			stampsEnabled: opts.stampsEnabled ? 'Y' : 'N',
		};

		if (opts.values) {
			try {
				body.values = JSON.parse(opts.values as string);
			} catch (_) {
				body.values = opts.values;
			}
		}

		const res = await bitrix24ApiRequest.call(
			this, 'POST', 'crm.documentgenerator.document.add', body,
		);
		const resultObj = res.result as IDataObject;
		responseData = (resultObj?.document as IDataObject) ?? { id: res.result, success: true };
	}

	else if (operation === 'getDocument') {
		const id = this.getNodeParameter('documentId', i) as string;
		const res = await bitrix24ApiRequest.call(
			this, 'POST', 'crm.documentgenerator.document.get', { id },
		);
		const resultObj = res.result as IDataObject;
		responseData = (resultObj?.document as IDataObject) ?? resultObj;
	}

	else if (operation === 'listDocuments') {
		const filters = this.getNodeParameter('documentFilters', i, {}) as IDataObject;
		const limit = this.getNodeParameter('limit', i, 50) as number;

		const body: IDataObject = { start: 0 };
		if (filters.entityTypeId) body.entityTypeId = filters.entityTypeId;
		if (filters.entityId) body.entityId = filters.entityId;
		if (filters.templateId) body.templateId = filters.templateId;

		if (limit === 0) {
			const items = await bitrix24ApiRequestAllItems.call(
				this, 'POST', 'crm.documentgenerator.document.list', body,
			);
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(
				this, 'POST', 'crm.documentgenerator.document.list', { ...body, count: limit },
			);
			const resultObj = res.result as IDataObject;
			responseData = { items: (resultObj?.items as IDataObject[]) ?? res.result, total: res.total };
		}
	}

	else if (operation === 'getDownloadUrl') {
		const id = this.getNodeParameter('documentId', i) as string;
		const res = await bitrix24ApiRequest.call(
			this, 'POST', 'crm.documentgenerator.document.get', { id },
		);
		const resultObj = res.result as IDataObject;
		const doc = (resultObj?.document as IDataObject) ?? resultObj;
		responseData = {
			documentId: id,
			downloadUrl: (doc.pdfUrl ?? doc.downloadUrl ?? doc.URL) as string,
			title: (doc.title ?? doc.TITLE) as string,
			status: doc.status as string,
		};
	}

	else if (operation === 'deleteDocument') {
		const id = this.getNodeParameter('documentId', i) as string;
		const res = await bitrix24ApiRequest.call(
			this, 'POST', 'crm.documentgenerator.document.delete', { id },
		);
		responseData = { success: res.result as boolean };
	}

	return responseData;
}
