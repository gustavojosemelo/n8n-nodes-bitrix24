import { INodeProperties } from 'n8n-workflow';

export const leadOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['lead'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a lead' },
			{ name: 'Get', value: 'get', action: 'Get a lead' },
			{ name: 'Update', value: 'update', action: 'Update a lead' },
			{ name: 'Delete', value: 'delete', action: 'Delete a lead' },
			{ name: 'List', value: 'list', action: 'List leads' },
			{ name: 'Search', value: 'search', action: 'Search leads' },
		],
		default: 'create',
	},
];

export const leadFields: INodeProperties[] = [
	{
		displayName: 'Lead ID',
		name: 'leadId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['lead'], operation: ['get', 'update', 'delete'] } },
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['lead'], operation: ['create'] } },
	},

	// ── Fixed fields (create + update) ────────────────────────────────────────
	{
		displayName: 'Fixed Fields',
		name: 'fixedFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['lead'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Title',
				name: 'TITLE',
				type: 'string',
				default: '',
				displayOptions: { show: { '/operation': ['update'] } },
			},
			{
				displayName: 'First Name',
				name: 'NAME',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Last Name',
				name: 'LAST_NAME',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Status',
				name: 'STATUS_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getLeadStatuses' },
				default: '',
				description: 'Current status of the lead',
			},
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{
				displayName: 'Phone',
				name: 'PHONE',
				type: 'string',
				default: '',
				description: 'Phone number (main)',
			},
			{
				displayName: 'Email',
				name: 'EMAIL',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Company Name',
				name: 'COMPANY_TITLE',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Amount',
				name: 'OPPORTUNITY',
				type: 'number',
				default: 0,
			},
			{
				displayName: 'Currency',
				name: 'CURRENCY_ID',
				type: 'string',
				default: 'BRL',
			},
			{
				displayName: 'Source',
				name: 'SOURCE_ID',
				type: 'string',
				default: '',
				description: 'Source ID (CALL, EMAIL, WEB, etc.)',
			},
			{
				displayName: 'Comments',
				name: 'COMMENTS',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
			},
		],
	},

	// ── Custom Fields (UF_) ───────────────────────────────────────────────────
	{
		displayName: 'Custom Fields (UF_)',
		name: 'customFields',
		type: 'fixedCollection',
		placeholder: 'Add Custom Field',
		default: {},
		typeOptions: { multipleValues: true },
		displayOptions: { show: { resource: ['lead'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name',
						name: 'fieldName',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getLeadCustomFields' },
						default: '',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
					},
				],
			},
		],
	},

	// ── List filters ──────────────────────────────────────────────────────────
	{
		displayName: 'Quick Filters',
		name: 'quickFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['lead'], operation: ['list'] } },
		options: [
			{
				displayName: 'Status',
				name: 'STATUS_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getLeadStatuses' },
				default: '',
			},
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{
				displayName: 'Created After',
				name: 'DATE_CREATE_from',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Created Before',
				name: 'DATE_CREATE_to',
				type: 'dateTime',
				default: '',
			},
		],
	},
	{
		displayName: 'Advanced Filter (Raw JSON)',
		name: 'advancedFilter',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['lead'], operation: ['list'] } },
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 50,
		displayOptions: { show: { resource: ['lead'], operation: ['list'] } },
	},
	{
		displayName: 'Search Query',
		name: 'searchQuery',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['lead'], operation: ['search'] } },
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';

export async function executeLead(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const title = this.getNodeParameter('title', i) as string;
		const fixedFields = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;
		const fields: IDataObject = { TITLE: title, ...fixedFields };
		for (const cf of (customFieldsRaw.field as IDataObject[]) || []) {
			fields[cf.fieldName as string] = cf.value;
		}
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.lead.add', { fields });
		responseData = { id: res.result, success: true };
	}
	else if (operation === 'get') {
		const id = this.getNodeParameter('leadId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.lead.get', { id });
		responseData = res.result as IDataObject;
	}
	else if (operation === 'update') {
		const id = this.getNodeParameter('leadId', i) as string;
		const fixedFields = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;
		const fields: IDataObject = { ...fixedFields };
		for (const cf of (customFieldsRaw.field as IDataObject[]) || []) {
			fields[cf.fieldName as string] = cf.value;
		}
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.lead.update', { id, fields });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'delete') {
		const id = this.getNodeParameter('leadId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.lead.delete', { id });
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
			const items = await bitrix24ApiRequestAllItems.call(this, 'POST', 'crm.lead.list', { filter, select: ['*', 'UF_*'] });
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.lead.list', { filter, select: ['*', 'UF_*'], start: 0 });
			responseData = { items: res.result, total: res.total };
		}
	}
	else if (operation === 'search') {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.lead.list', { filter: { '%TITLE': query }, select: ['*'] });
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}
