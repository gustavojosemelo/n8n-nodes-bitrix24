import { INodeProperties } from 'n8n-workflow';

// ─── Operations ───────────────────────────────────────────────────────────────
export const dealOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['deal'] } },
		options: [
			{ name: 'Create', value: 'create', description: 'Create a new deal', action: 'Create a deal' },
			{ name: 'Get', value: 'get', description: 'Get a deal by ID', action: 'Get a deal' },
			{ name: 'Update', value: 'update', description: 'Update a deal', action: 'Update a deal' },
			{ name: 'Delete', value: 'delete', description: 'Delete a deal', action: 'Delete a deal' },
			{ name: 'List', value: 'list', description: 'List deals with filters', action: 'List deals' },
			{ name: 'Search', value: 'search', description: 'Search deals by query', action: 'Search deals' },
		],
		default: 'create',
	},
];

// ─── Fields ───────────────────────────────────────────────────────────────────
export const dealFields: INodeProperties[] = [

	// ── GET / DELETE ──────────────────────────────────────────────────────────
	{
		displayName: 'Deal ID',
		name: 'dealId',
		type: 'string',
		required: true,
		default: '',
		description: 'The ID of the deal',
		displayOptions: { show: { resource: ['deal'], operation: ['get', 'update', 'delete'] } },
	},

	// ── CREATE ────────────────────────────────────────────────────────────────
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		description: 'Name/title of the deal',
		displayOptions: { show: { resource: ['deal'], operation: ['create'] } },
	},

	// ── CREATE + UPDATE — Fixed Fields ────────────────────────────────────────
	{
		displayName: 'Fixed Fields',
		name: 'fixedFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['deal'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Title',
				name: 'TITLE',
				type: 'string',
				default: '',
				displayOptions: { show: { '/operation': ['update'] } },
			},
			{
				displayName: 'Pipeline',
				name: 'CATEGORY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getDealCategories' },
				default: '0',
				description: 'Sales pipeline (funnel) for this deal',
			},
			{
				displayName: 'Stage',
				name: 'STAGE_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getDealStages' },
				default: '',
				description: 'Stage within the selected pipeline',
			},
			{
				displayName: 'Responsible User',
				name: 'ASSIGNED_BY_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
				description: 'User responsible for this deal',
			},
			{
				displayName: 'Amount',
				name: 'OPPORTUNITY',
				type: 'number',
				default: 0,
				description: 'Deal value/amount',
			},
			{
				displayName: 'Currency',
				name: 'CURRENCY_ID',
				type: 'string',
				default: 'BRL',
				description: 'Currency code (e.g. BRL, USD, EUR)',
			},
			{
				displayName: 'Contact ID',
				name: 'CONTACT_ID',
				type: 'string',
				default: '',
				description: 'ID of the associated contact',
			},
			{
				displayName: 'Company ID',
				name: 'COMPANY_ID',
				type: 'string',
				default: '',
				description: 'ID of the associated company',
			},
			{
				displayName: 'Close Date',
				name: 'CLOSEDATE',
				type: 'dateTime',
				default: '',
				description: 'Expected close date',
			},
			{
				displayName: 'Comment',
				name: 'COMMENTS',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Internal comments for this deal',
			},
			{
				displayName: 'Source',
				name: 'SOURCE_ID',
				type: 'string',
				default: '',
				description: 'Source ID (e.g. CALL, EMAIL, WEB)',
			},
			{
				displayName: 'Probability (%)',
				name: 'PROBABILITY',
				type: 'number',
				default: 50,
				description: 'Win probability percentage (0–100)',
			},
		],
	},

	// ── CREATE + UPDATE — Custom Fields ───────────────────────────────────────
	{
		displayName: 'Custom Fields (UF_)',
		name: 'customFields',
		type: 'fixedCollection',
		placeholder: 'Add Custom Field',
		default: {},
		typeOptions: { multipleValues: true },
		displayOptions: { show: { resource: ['deal'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Field Name',
						name: 'fieldName',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getDealCustomFields' },
						default: '',
						description: 'Custom field (UF_*) for deals',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value to assign to this custom field',
					},
				],
			},
		],
	},

	// ── LIST ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Quick Filters',
		name: 'quickFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['deal'], operation: ['list'] } },
		options: [
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
		description:
			'Raw FILTER object passed directly to crm.deal.list. Example: {"STAGE_ID": "WON", ">OPPORTUNITY": 1000}',
		displayOptions: { show: { resource: ['deal'], operation: ['list'] } },
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 50,
		description: 'Max number of results (use 0 for all pages)',
		displayOptions: { show: { resource: ['deal'], operation: ['list'] } },
	},

	// ── SEARCH ────────────────────────────────────────────────────────────────
	{
		displayName: 'Search Query',
		name: 'searchQuery',
		type: 'string',
		required: true,
		default: '',
		description: 'Text to search across deal title and fields',
		displayOptions: { show: { resource: ['deal'], operation: ['search'] } },
	},
];

// ─── Execute logic ────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';

export async function executeDeal(
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

		// Merge custom UF_ fields
		const customArr = (customFieldsRaw.field as IDataObject[]) || [];
		for (const cf of customArr) {
			fields[cf.fieldName as string] = cf.value;
		}

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
		const fixedFields = this.getNodeParameter('fixedFields', i, {}) as IDataObject;
		const customFieldsRaw = this.getNodeParameter('customFields', i, {}) as IDataObject;

		const fields: IDataObject = { ...fixedFields };
		const customArr = (customFieldsRaw.field as IDataObject[]) || [];
		for (const cf of customArr) {
			fields[cf.fieldName as string] = cf.value;
		}

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

		const filter: IDataObject = { ...quickFilters, ...advancedFilter };

		if (limit === 0) {
			const items = await bitrix24ApiRequestAllItems.call(
				this, 'POST', 'crm.deal.list', { filter, select: ['*', 'UF_*'] },
			);
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.deal.list', {
				filter,
				select: ['*', 'UF_*'],
				start: 0,
			});
			responseData = { items: res.result, total: res.total };
		}
	}

	else if (operation === 'search') {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.deal.list', {
			filter: { '%TITLE': query },
			select: ['*'],
		});
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}
