import { INodeProperties } from 'n8n-workflow';

export const companyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['company'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a company' },
			{ name: 'Get', value: 'get', action: 'Get a company' },
			{ name: 'Update', value: 'update', action: 'Update a company' },
			{ name: 'Delete', value: 'delete', action: 'Delete a company' },
			{ name: 'List', value: 'list', action: 'List companies' },
			{ name: 'Search', value: 'search', action: 'Search companies' },
		],
		default: 'create',
	},
];

export const companyFields: INodeProperties[] = [
	{
		displayName: 'Company ID',
		name: 'companyId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['company'], operation: ['get', 'update', 'delete'] } },
	},
	{
		displayName: 'Company Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['company'], operation: ['create'] } },
	},

	// ── Fixed Fields ──────────────────────────────────────────────────────────
	{
		displayName: 'Fixed Fields',
		name: 'fixedFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['company'], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Title', name: 'TITLE', type: 'string', default: '', displayOptions: { show: { '/operation': ['update'] } } },
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{ displayName: 'Phone', name: 'PHONE', type: 'string', default: '' },
			{ displayName: 'Email', name: 'EMAIL', type: 'string', default: '' },
			{ displayName: 'Website', name: 'WEB', type: 'string', default: '' },
			{ displayName: 'Industry', name: 'INDUSTRY', type: 'string', default: '', description: 'e.g. IT, MANUFACTURING, FINANCE' },
			{ displayName: 'Employees', name: 'EMPLOYEES', type: 'string', default: '', description: 'Number of employees range code' },
			{ displayName: 'Annual Revenue', name: 'REVENUE', type: 'number', default: 0 },
			{ displayName: 'Currency', name: 'CURRENCY_ID', type: 'string', default: 'BRL' },
			{ displayName: 'Comment', name: 'COMMENTS', type: 'string', typeOptions: { rows: 3 }, default: '' },
			{ displayName: 'Source', name: 'SOURCE_ID', type: 'string', default: '' },
		],
	},

	// ── Custom Fields ─────────────────────────────────────────────────────────
	{
		displayName: 'Custom Fields (UF_)',
		name: 'customFields',
		type: 'fixedCollection',
		placeholder: 'Add Custom Field',
		default: {},
		typeOptions: { multipleValues: true },
		displayOptions: { show: { resource: ['company'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name',
						name: 'fieldName',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getCompanyCustomFields' },
						default: '',
					},
					{ displayName: 'Value', name: 'value', type: 'string', default: '' },
				],
			},
		],
	},

	// ── List ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Quick Filters',
		name: 'quickFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['company'], operation: ['list'] } },
		options: [
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{ displayName: 'Industry', name: 'INDUSTRY', type: 'string', default: '' },
			{ displayName: 'Created After', name: 'DATE_CREATE_from', type: 'dateTime', default: '' },
			{ displayName: 'Created Before', name: 'DATE_CREATE_to', type: 'dateTime', default: '' },
		],
	},
	{
		displayName: 'Advanced Filter (Raw JSON)',
		name: 'advancedFilter',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['company'], operation: ['list'] } },
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 50,
		displayOptions: { show: { resource: ['company'], operation: ['list'] } },
	},
	{
		displayName: 'Search Query',
		name: 'searchQuery',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['company'], operation: ['search'] } },
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';

export async function executeCompany(
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
		if (fields.PHONE) fields.PHONE = [{ VALUE: fields.PHONE, VALUE_TYPE: 'WORK' }];
		if (fields.EMAIL) fields.EMAIL = [{ VALUE: fields.EMAIL, VALUE_TYPE: 'WORK' }];
		if (fields.WEB) fields.WEB = [{ VALUE: fields.WEB, VALUE_TYPE: 'WORK' }];
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.company.add', { fields });
		responseData = { id: res.result, success: true };
	}
	else if (operation === 'get') {
		const id = this.getNodeParameter('companyId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.company.get', { id });
		responseData = res.result as IDataObject;
	}
	else if (operation === 'update') {
		const id = this.getNodeParameter('companyId', i) as string;
		const fixedFields = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;
		const fields: IDataObject = { ...fixedFields };
		for (const cf of (customFieldsRaw.field as IDataObject[]) || []) {
			fields[cf.fieldName as string] = cf.value;
		}
		if (fields.PHONE) fields.PHONE = [{ VALUE: fields.PHONE, VALUE_TYPE: 'WORK' }];
		if (fields.EMAIL) fields.EMAIL = [{ VALUE: fields.EMAIL, VALUE_TYPE: 'WORK' }];
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.company.update', { id, fields });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'delete') {
		const id = this.getNodeParameter('companyId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.company.delete', { id });
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
			const items = await bitrix24ApiRequestAllItems.call(this, 'POST', 'crm.company.list', { filter, select: ['*', 'UF_*'] });
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.company.list', { filter, select: ['*', 'UF_*'], start: 0 });
			responseData = { items: res.result, total: res.total };
		}
	}
	else if (operation === 'search') {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.company.list', { filter: { '%TITLE': query }, select: ['*'] });
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}
