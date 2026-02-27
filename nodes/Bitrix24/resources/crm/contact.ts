import { INodeProperties } from 'n8n-workflow';

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
			{ displayName: 'Phone', name: 'PHONE', type: 'string', default: '', description: 'Main phone number' },
			{ displayName: 'Email', name: 'EMAIL', type: 'string', default: '' },
			{ displayName: 'Company ID', name: 'COMPANY_ID', type: 'string', default: '', description: 'ID of associated company' },
			{ displayName: 'Position', name: 'POST', type: 'string', default: '', description: 'Job title/position' },
			{ displayName: 'Source', name: 'SOURCE_ID', type: 'string', default: '' },
			{ displayName: 'Comment', name: 'COMMENTS', type: 'string', typeOptions: { rows: 3 }, default: '' },
			{ displayName: 'Birthday', name: 'BIRTHDATE', type: 'dateTime', default: '' },
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
		displayOptions: { show: { resource: ['contact'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name',
						name: 'fieldName',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getContactCustomFields' },
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
		displayOptions: { show: { resource: ['contact'], operation: ['list'] } },
		options: [
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{ displayName: 'Created After', name: 'DATE_CREATE_from', type: 'dateTime', default: '' },
			{ displayName: 'Created Before', name: 'DATE_CREATE_to', type: 'dateTime', default: '' },
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
		displayOptions: { show: { resource: ['contact'], operation: ['list'] } },
	},
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
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';

export async function executeContact(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const firstName = this.getNodeParameter('firstName', i) as string;
		const fixedFields = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;
		const fields: IDataObject = { NAME: firstName, ...fixedFields };
		for (const cf of (customFieldsRaw.field as IDataObject[]) || []) {
			fields[cf.fieldName as string] = cf.value;
		}
		// Wrap phone/email as Bitrix24 multi-field format
		if (fields.PHONE) fields.PHONE = [{ VALUE: fields.PHONE, VALUE_TYPE: 'WORK' }];
		if (fields.EMAIL) fields.EMAIL = [{ VALUE: fields.EMAIL, VALUE_TYPE: 'WORK' }];
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
		const fixedFields = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;
		const fields: IDataObject = { ...fixedFields };
		for (const cf of (customFieldsRaw.field as IDataObject[]) || []) {
			fields[cf.fieldName as string] = cf.value;
		}
		if (fields.PHONE) fields.PHONE = [{ VALUE: fields.PHONE, VALUE_TYPE: 'WORK' }];
		if (fields.EMAIL) fields.EMAIL = [{ VALUE: fields.EMAIL, VALUE_TYPE: 'WORK' }];
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
		const filter = { ...quickFilters, ...advancedFilter };
		if (limit === 0) {
			const items = await bitrix24ApiRequestAllItems.call(this, 'POST', 'crm.contact.list', { filter, select: ['*', 'UF_*'] });
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.contact.list', { filter, select: ['*', 'UF_*'], start: 0 });
			responseData = { items: res.result, total: res.total };
		}
	}
	else if (operation === 'search') {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.contact.list', {
			filter: { '%NAME': query },
			select: ['*'],
		});
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}
