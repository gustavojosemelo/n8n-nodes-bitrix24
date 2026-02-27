import { INodeProperties } from 'n8n-workflow';

export const userOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['user'] } },
		options: [
			{ name: 'Get', value: 'get', action: 'Get a user by ID' },
			{ name: 'Get Current', value: 'getCurrent', action: 'Get the authenticated user' },
			{ name: 'List', value: 'list', action: 'List users' },
			{ name: 'Search', value: 'search', action: 'Search users by name or email' },
		],
		default: 'list',
	},
];

export const userFields: INodeProperties[] = [
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['user'], operation: ['get'] } },
	},
	{
		displayName: 'Quick Filters',
		name: 'quickFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['user'], operation: ['list'] } },
		options: [
			{
				displayName: 'Active Only',
				name: 'ACTIVE',
				type: 'boolean',
				default: true,
				description: 'Return only active users',
			},
			{
				displayName: 'Department ID',
				name: 'UF_DEPARTMENT',
				type: 'string',
				default: '',
				description: 'Filter by department ID',
			},
		],
	},
	{
		displayName: 'Advanced Filter (Raw JSON)',
		name: 'advancedFilter',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['user'], operation: ['list'] } },
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 50,
		displayOptions: { show: { resource: ['user'], operation: ['list'] } },
	},
	{
		displayName: 'Search Query',
		name: 'searchQuery',
		type: 'string',
		required: true,
		default: '',
		description: 'Search by name, last name or email',
		displayOptions: { show: { resource: ['user'], operation: ['search'] } },
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';

export async function executeUser(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'get') {
		const id = this.getNodeParameter('userId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'user.get', { ID: id });
		const users = res.result as IDataObject[];
		responseData = users?.[0] ?? {};
	}
	else if (operation === 'getCurrent') {
		const res = await bitrix24ApiRequest.call(this, 'POST', 'profile', {});
		responseData = res.result as IDataObject;
	}
	else if (operation === 'list') {
		const quickFilters = this.getNodeParameter('quickFilters', i, {}) as IDataObject;
		const advancedRaw = this.getNodeParameter('advancedFilter', i, '{}') as string;
		const limit = this.getNodeParameter('limit', i, 50) as number;
		let advancedFilter: IDataObject = {};
		try { advancedFilter = JSON.parse(advancedRaw); } catch (_) {}
		const filter = { ...quickFilters, ...advancedFilter };

		if (limit === 0) {
			const items = await bitrix24ApiRequestAllItems.call(this, 'POST', 'user.get', { FILTER: filter });
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'user.get', { FILTER: filter, start: 0 });
			responseData = { items: res.result, total: res.total };
		}
	}
	else if (operation === 'search') {
		const query = this.getNodeParameter('searchQuery', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'user.search', { NAME: query });
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}
