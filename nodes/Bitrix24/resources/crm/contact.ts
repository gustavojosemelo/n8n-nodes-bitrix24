import { INodeProperties } from 'n8n-workflow';
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';
import { makePhoneField, makeEmailField, makeCustomFieldsSection, processPhones, processEmails, processCustomFields } from './crmHelpers';

export const contactOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a contact' },
			{ name: 'Get', value: 'get', action: 'Get a contact' },
			{ name: 'Update', value: 'update', action: 'Update a contact' },
			{ name: 'Delete', value: 'delete', action: 'Delete a contact' },
			{ name: 'List', value: 'list', action: 'List contacts' },
			{ name: 'Search', value: 'search', action: 'Search contacts' },
		],
		default: 'create',
	},
];

export const contactFields: INodeProperties[] = [
	// ── IDs ───────────────────────────────────────────────────────────────────
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['contact'], operation: ['get', 'update', 'delete'] } },
	},
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
	},

	// ── Fixed Fields ──────────────────────────────────────────────────────────
	{
		displayName: 'Fixed Fields',
		name: 'fixedFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'First Name', name: 'NAME', type: 'string', default: '', displayOptions: { show: { '/operation': ['update'] } } },
			{ displayName: 'Last Name', name: 'LAST_NAME', type: 'string', default: '' },
			{ displayName: 'Second Name', name: 'SECOND_NAME', type: 'string', default: '' },
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{ displayName: 'Company ID', name: 'COMPANY_ID', type: 'string', default: '', description: 'ID of associated company' },
			{ displayName: 'Position', name: 'POST', type: 'string', default: '', description: 'Job title/position' },
			{ displayName: 'Source', name: 'SOURCE_ID', type: 'string', default: '' },
			{ displayName: 'Comment', name: 'COMMENTS', type: 'string', typeOptions: { rows: 3 }, default: '' },
			{ displayName: 'Birthday', name: 'BIRTHDATE', type: 'dateTime', default: '' },
		],
	},

	// ── Phones ────────────────────────────────────────────────────────────────
	makePhoneField('contact'),

	// ── Emails ────────────────────────────────────────────────────────────────
	makeEmailField('contact'),

	// ── Custom Fields ─────────────────────────────────────────────────────────
	makeCustomFieldsSection('contact', 'getContactCustomFields'),

	// ── List ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Quick Filters',
		name: 'quickFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['contact'], operation: ['list'] } },
		options: [
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{ displayName: 'Name', name: 'NAME', type: 'string', default: '' },
			{ displayName: 'Email', name: 'EMAIL', type: 'string', default: '' },
			{ displayName: 'Phone', name: 'PHONE', type: 'string', default: '' },
		],
	},
	{
		displayName: 'Advanced Filter (Raw JSON)',
		name: 'advancedFilter',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['contact'], operation: ['list'] } },
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 50,
		description: 'Set to 0 to fetch all records',
		displayOptions: { show: { resource: ['contact'], operation: ['list'] } },
	},

	// ── Search ────────────────────────────────────────────────────────────────
	{
		displayName: 'Search Query',
		name: 'searchQuery',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['contact'], operation: ['search'] } },
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
export async function executeContact(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const firstName = this.getNodeParameter('firstName', i) as string;
		const fixed = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const phonesRaw = this.getNodeParameter('phones', i, {}) as IDataObject;
		const emailsRaw = this.getNodeParameter('emails', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;

		const fields: IDataObject = { NAME: firstName, ...fixed };

		const phones = processPhones(phonesRaw);
		if (phones) fields.PHONE = phones;

		const emails = processEmails(emailsRaw);
		if (emails) fields.EMAIL = emails;

		Object.assign(fields, processCustomFields(customFieldsRaw));

		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.contact.add', { fields });
		responseData = { id: res.result, success: true };
	}

	else if (operation === 'get') {
		const id = this.getNodeParameter('contactId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.contact.get', { id });
		responseData = res.result as IDataObject;
	}

	else if (operation === 'update') {
		const id = this.getNodeParameter('contactId', i) as string;
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

		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.contact.update', { id, fields });
		responseData = { success: res.result as boolean };
	}

	else if (operation === 'delete') {
		const id = this.getNodeParameter('contactId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.contact.delete', { id });
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
				this, 'POST', 'crm.contact.list', { filter, select: ['*', 'UF_*', 'PHONE', 'EMAIL'] },
			);
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.contact.list', {
				filter,
				select: ['*', 'UF_*', 'PHONE', 'EMAIL'],
				start: 0,
			});
			responseData = { items: res.result, total: res.total };
		}
	}

	else if (operation === 'search') {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.contact.list', {
			filter: { '%NAME': query },
			select: ['*', 'UF_*', 'PHONE', 'EMAIL'],
		});
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}
