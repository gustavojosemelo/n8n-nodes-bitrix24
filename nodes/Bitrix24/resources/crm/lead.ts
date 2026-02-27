import { INodeProperties, IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';
import { makePhoneField, makeEmailField, makeCustomFieldsSection, processPhones, processEmails, processCustomFields } from './crmHelpers';

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

	// ── Fixed Fields ──────────────────────────────────────────────────────────
	{
		displayName: 'Fixed Fields',
		name: 'fixedFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['lead'], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Title', name: 'TITLE', type: 'string', default: '', displayOptions: { show: { '/operation': ['update'] } } },
			{ displayName: 'First Name', name: 'NAME', type: 'string', default: '' },
			{ displayName: 'Last Name', name: 'LAST_NAME', type: 'string', default: '' },
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
			{ displayName: 'Company Name', name: 'COMPANY_TITLE', type: 'string', default: '' },
			{ displayName: 'Amount', name: 'OPPORTUNITY', type: 'number', default: 0 },
			{ displayName: 'Currency', name: 'CURRENCY_ID', type: 'string', default: 'BRL' },
			{ displayName: 'Source', name: 'SOURCE_ID', type: 'string', default: '', description: 'Source ID (CALL, EMAIL, WEB, etc.)' },
			{ displayName: 'Comments', name: 'COMMENTS', type: 'string', typeOptions: { rows: 3 }, default: '' },
		],
	},

	// ── Phones ────────────────────────────────────────────────────────────────
	makePhoneField('lead'),

	// ── Emails ────────────────────────────────────────────────────────────────
	makeEmailField('lead'),

	// ── Custom Fields ─────────────────────────────────────────────────────────
	makeCustomFieldsSection('lead', 'getLeadCustomFields'),

	// ── List ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Quick Filters',
		name: 'quickFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['lead'], operation: ['list'] } },
		options: [
			{ displayName: 'Status', name: 'STATUS_ID', type: 'options', typeOptions: { loadOptionsMethod: 'getLeadStatuses' }, default: '' },
			{ displayName: 'Responsible User', name: 'ASSIGNED_BY_ID', type: 'options', typeOptions: { loadOptionsMethod: 'getUsers' }, default: '' },
			{ displayName: 'Created After', name: 'DATE_CREATE_from', type: 'dateTime', default: '' },
			{ displayName: 'Created Before', name: 'DATE_CREATE_to', type: 'dateTime', default: '' },
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
		description: 'Set to 0 to fetch all records',
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
export async function executeLead(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const title = this.getNodeParameter('title', i) as string;
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
			const items = await bitrix24ApiRequestAllItems.call(this, 'POST', 'crm.lead.list', { filter, select: ['*', 'UF_*', 'PHONE', 'EMAIL'] });
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.lead.list', { filter, select: ['*', 'UF_*', 'PHONE', 'EMAIL'], start: 0 });
			responseData = { items: res.result, total: res.total };
		}
	}
	else if (operation === 'search') {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.lead.list', { filter: { '%TITLE': query }, select: ['*', 'PHONE', 'EMAIL'] });
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}
