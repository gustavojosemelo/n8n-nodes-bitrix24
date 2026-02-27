import { INodeProperties } from 'n8n-workflow';
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';
import { makePhoneField, makeEmailField, makeCustomFieldsSection, processPhones, processEmails, processCustomFields } from './crmHelpers';

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
	// ── IDs ───────────────────────────────────────────────────────────────────
	{
		displayName: 'Company ID',
		name: 'companyId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['company'], operation: ['get', 'update', 'delete'] } },
	},
	{
		displayName: 'Company Name',
		name: 'companyName',
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
			{ displayName: 'Company Name', name: 'TITLE', type: 'string', default: '', displayOptions: { show: { '/operation': ['update'] } } },
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{
				displayName: 'Industry',
				name: 'INDUSTRY',
				type: 'options',
				options: [
					{ name: 'IT', value: 'IT' },
					{ name: 'Communications', value: 'COMMUNICATIONS' },
					{ name: 'Finance', value: 'FINANCE' },
					{ name: 'Manufacturing', value: 'MANUFACTURING' },
					{ name: 'Retail', value: 'RETAIL' },
					{ name: 'Healthcare', value: 'HEALTHCARE' },
					{ name: 'Education', value: 'EDUCATION' },
					{ name: 'Transportation', value: 'TRANSPORTATION' },
					{ name: 'Services', value: 'SERVICE' },
					{ name: 'Other', value: 'OTHER' },
				],
				default: '',
			},
			{
				displayName: 'Company Type',
				name: 'COMPANY_TYPE',
				type: 'options',
				options: [
					{ name: 'Customer', value: 'CUSTOMER' },
					{ name: 'Partner', value: 'PARTNER' },
					{ name: 'Competitor', value: 'COMPETITOR' },
					{ name: 'Other', value: 'OTHER' },
				],
				default: '',
			},
			{ displayName: 'Revenue', name: 'REVENUE', type: 'number', default: 0 },
			{ displayName: 'Employees Count', name: 'EMPLOYEES', type: 'string', default: '' },
			{ displayName: 'Website', name: 'WEB', type: 'string', default: '' },
			{ displayName: 'Address', name: 'ADDRESS', type: 'string', default: '' },
			{ displayName: 'Comment', name: 'COMMENTS', type: 'string', typeOptions: { rows: 3 }, default: '' },
		],
	},

	// ── Phones ────────────────────────────────────────────────────────────────
	makePhoneField('company'),

	// ── Emails ────────────────────────────────────────────────────────────────
	makeEmailField('company'),

	// ── Custom Fields ─────────────────────────────────────────────────────────
	makeCustomFieldsSection('company', 'getCompanyCustomFields'),

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
			{ displayName: 'Company Name', name: 'TITLE', type: 'string', default: '' },
			{ displayName: 'Industry', name: 'INDUSTRY', type: 'string', default: '' },
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
		description: 'Set to 0 to fetch all records',
		displayOptions: { show: { resource: ['company'], operation: ['list'] } },
	},

	// ── Search ────────────────────────────────────────────────────────────────
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
export async function executeCompany(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const title = this.getNodeParameter('companyName', i) as string;
		const fixed = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const phonesRaw = this.getNodeParameter('phones', i, {}) as IDataObject;
		const emailsRaw = this.getNodeParameter('emails', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;

		const fields: IDataObject = { TITLE: title, ...fixed };

		const phones = processPhones(phonesRaw);
		if (phones) fields.PHONE = phones;

		const emails = processEmails(emailsRaw);
		if (emails) fields.EMAIL = emails;

		Object.assign(fields, processCustomFields(customFieldsRaw));

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
		const fixed = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const phonesRaw = this.getNodeParameter('phones', i, {}) as IDataObject;
		const emailsRaw = this.getNodeParameter('emails', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;

		const fields: IDataObject = { ...fixed };

		const phones = processPhones(phonesRaw);
		if (phones) fields.PHONE = phones;

		const emails = processEmails(emailsRaw);
		if (emails) fields.EMAIL = emails;

		Object.assign(fields, processCustomFields(customFieldsRaw));

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
		const filter: IDataObject = { ...quickFilters, ...advancedFilter };

		if (limit === 0) {
			const items = await bitrix24ApiRequestAllItems.call(
				this, 'POST', 'crm.company.list', { filter, select: ['*', 'UF_*', 'PHONE', 'EMAIL'] },
			);
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.company.list', {
				filter,
				select: ['*', 'UF_*', 'PHONE', 'EMAIL'],
				start: 0,
			});
			responseData = { items: res.result, total: res.total };
		}
	}

	else if (operation === 'search') {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.company.list', {
			filter: { '%TITLE': query },
			select: ['*', 'UF_*', 'PHONE', 'EMAIL'],
		});
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}
