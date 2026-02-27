import { INodeProperties, IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';
import { makeCustomFieldsSection, processCustomFields } from './crmHelpers';

export const dealOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['deal'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a deal' },
			{ name: 'Get', value: 'get', action: 'Get a deal' },
			{ name: 'Update', value: 'update', action: 'Update a deal' },
			{ name: 'Delete', value: 'delete', action: 'Delete a deal' },
			{ name: 'List', value: 'list', action: 'List deals' },
			{ name: 'Search', value: 'search', action: 'Search deals' },
		],
		default: 'create',
	},
];

export const dealFields: INodeProperties[] = [
	// ── IDs ───────────────────────────────────────────────────────────────────
	{
		displayName: 'Deal ID',
		name: 'dealId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['deal'], operation: ['get', 'update', 'delete'] } },
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['deal'], operation: ['create'] } },
	},

	// ── Fixed Fields ──────────────────────────────────────────────────────────
	{
		displayName: 'Fixed Fields',
		name: 'fixedFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['deal'], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Title', name: 'TITLE', type: 'string', default: '', displayOptions: { show: { '/operation': ['update'] } } },
			{
				displayName: 'Pipeline',
				name: 'CATEGORY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getDealCategories' },
				default: '',
			},
			{
				displayName: 'Stage',
				name: 'STAGE_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getDealStages' },
				default: '',
			},
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{ displayName: 'Amount', name: 'OPPORTUNITY', type: 'number', default: 0 },
			{ displayName: 'Currency', name: 'CURRENCY_ID', type: 'string', default: 'BRL' },
			{ displayName: 'Contact ID', name: 'CONTACT_ID', type: 'string', default: '' },
			{ displayName: 'Company ID', name: 'COMPANY_ID', type: 'string', default: '' },
			{ displayName: 'Close Date', name: 'CLOSEDATE', type: 'dateTime', default: '' },
			{ displayName: 'Comments', name: 'COMMENTS', type: 'string', typeOptions: { rows: 3 }, default: '' },
			{
				displayName: 'Is Closed',
				name: 'CLOSED',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Is Won',
				name: 'IS_NEW',
				type: 'boolean',
				default: false,
				description: 'Mark as new deal',
			},
		],
	},

	// ── Custom Fields ─────────────────────────────────────────────────────────
	makeCustomFieldsSection('deal', 'getDealCustomFields'),

	// ── List ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Quick Filters',
		name: 'quickFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['deal'], operation: ['list'] } },
		options: [
			{ displayName: 'Pipeline', name: 'CATEGORY_ID', type: 'options', typeOptions: { loadOptionsMethod: 'getDealCategories' }, default: '' },
			{ displayName: 'Stage', name: 'STAGE_ID', type: 'options', typeOptions: { loadOptionsMethod: 'getDealStages' }, default: '' },
			{ displayName: 'Responsible User', name: 'ASSIGNED_BY_ID', type: 'options', typeOptions: { loadOptionsMethod: 'getUsers' }, default: '' },
			{ displayName: 'Contact ID', name: 'CONTACT_ID', type: 'string', default: '' },
			{ displayName: 'Company ID', name: 'COMPANY_ID', type: 'string', default: '' },
			{ displayName: 'Is Closed', name: 'CLOSED', type: 'options', options: [{ name: 'Yes', value: 'Y' }, { name: 'No', value: 'N' }], default: '' },
			{ displayName: 'Created After', name: 'DATE_CREATE_from', type: 'dateTime', default: '' },
			{ displayName: 'Created Before', name: 'DATE_CREATE_to', type: 'dateTime', default: '' },
		],
	},
	{
		displayName: 'Advanced Filter (Raw JSON)',
		name: 'advancedFilter',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['deal'], operation: ['list'] } },
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 50,
		description: 'Set to 0 to fetch all records',
		displayOptions: { show: { resource: ['deal'], operation: ['list'] } },
	},
	{
		displayName: 'Search Query',
		name: 'searchQuery',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['deal'], operation: ['search'] } },
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
export async function executeDeal(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const title = this.getNodeParameter('title', i) as string;
		const fixed = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;
		const fields: IDataObject = { TITLE: title, ...fixed };
		Object.assign(fields, processCustomFields(customFieldsRaw));
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.deal.add', { fields });
		responseData = { id: res.result, success: true };
	}
	else if (operation === 'get') {
		const id = this.getNodeParameter('dealId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.deal.get', { id });
		responseData = res.result as IDataObject;
	}
	else if (operation === 'update') {
		const id = this.getNodeParameter('dealId', i) as string;
		const fixed = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;
		const fields: IDataObject = { ...fixed };
		Object.assign(fields, processCustomFields(customFieldsRaw));
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.deal.update', { id, fields });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'delete') {
		const id = this.getNodeParameter('dealId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.deal.delete', { id });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'list') {
		const quickFilters = this.getNodeParameter('quickFilters', i, {}) as IDataObject;
		const advancedRaw = this.getNodeParameter('advancedFilter', i, '{}') as string;
		const limit = this.getNodeParameter('limit', i, 50) as number;
		let advancedFilter: IDataObject = {};
		try { advancedFilter = JSON.parse(advancedRaw); } catch (_) {}
		const filter = { ...quickFilters, ...advancedFilter };
		if (limit === 0) {
			const items = await bitrix24ApiRequestAllItems.call(this, 'POST', 'crm.deal.list', { filter, select: ['*', 'UF_*'] });
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.deal.list', { filter, select: ['*', 'UF_*'], start: 0 });
			responseData = { items: res.result, total: res.total };
		}
	}
	else if (operation === 'search') {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.deal.list', { filter: { '%TITLE': query }, select: ['*', 'UF_*'] });
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}
