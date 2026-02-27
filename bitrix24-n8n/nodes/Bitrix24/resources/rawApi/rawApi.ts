import { INodeProperties } from 'n8n-workflow';

// ─── Operations ───────────────────────────────────────────────────────────────
export const rawApiOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['rawApi'] } },
		options: [
			{
				name: 'Execute Method',
				value: 'execute',
				description: 'Execute any Bitrix24 REST method directly',
				action: 'Execute a Bitrix24 REST method',
			},
			{
				name: 'Execute Batch',
				value: 'batch',
				description: 'Execute multiple methods in a single request (batch)',
				action: 'Execute a batch of methods',
			},
		],
		default: 'execute',
	},
];

// ─── Fields ───────────────────────────────────────────────────────────────────
export const rawApiFields: INodeProperties[] = [

	// ── EXECUTE SINGLE METHOD ─────────────────────────────────────────────────
	{
		displayName: 'Method',
		name: 'method',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'crm.deal.list',
		description:
			'Bitrix24 REST API method name. Browse all methods at https://apidocs.bitrix24.com',
		hint: 'Examples: crm.deal.list · crm.contact.add · tasks.task.get · user.get · disk.folder.getchildren',
		displayOptions: { show: { resource: ['rawApi'], operation: ['execute'] } },
	},
	{
		displayName: 'HTTP Method',
		name: 'httpMethod',
		type: 'options',
		options: [
			{ name: 'POST (recommended)', value: 'POST' },
			{ name: 'GET', value: 'GET' },
		],
		default: 'POST',
		displayOptions: { show: { resource: ['rawApi'], operation: ['execute'] } },
	},
	{
		displayName: 'Parameters (JSON)',
		name: 'params',
		type: 'json',
		default: '{}',
		description: 'Body parameters to send with the method call',
		hint: 'Example for crm.deal.list: {"filter": {"STAGE_ID": "WON"}, "select": ["ID", "TITLE", "OPPORTUNITY"]}',
		displayOptions: { show: { resource: ['rawApi'], operation: ['execute'] } },
	},
	{
		displayName: 'Fetch All Pages',
		name: 'fetchAll',
		type: 'boolean',
		default: false,
		description:
			'Automatically paginate through all results (Bitrix24 returns max 50 per page). Use with list methods.',
		displayOptions: { show: { resource: ['rawApi'], operation: ['execute'] } },
	},

	// ── BATCH ─────────────────────────────────────────────────────────────────
	{
		displayName: 'Batch Commands (JSON)',
		name: 'batchCommands',
		type: 'json',
		required: true,
		default: JSON.stringify(
			{
				cmd: {
					get_deal: 'crm.deal.get?id=1',
					list_contacts: 'crm.contact.list?filter[ASSIGNED_BY_ID]=5',
				},
			},
			null,
			2,
		),
		description:
			'Batch commands object. Each key is a command alias; each value is the method + params as a query string. You can reference results of previous commands using $result[alias].',
		hint: 'See https://apidocs.bitrix24.com/api-reference/common/system/batch.html',
		displayOptions: { show: { resource: ['rawApi'], operation: ['batch'] } },
	},
	{
		displayName: 'Halt on Error',
		name: 'haltOnError',
		type: 'boolean',
		default: true,
		description: 'Stop batch execution if any command fails',
		displayOptions: { show: { resource: ['rawApi'], operation: ['batch'] } },
	},

	// ── SHARED: Output options ─────────────────────────────────────────────────
	{
		displayName: 'Output Options',
		name: 'outputOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['rawApi'], operation: ['execute', 'batch'] } },
		options: [
			{
				displayName: 'Return Raw Response',
				name: 'rawResponse',
				type: 'boolean',
				default: false,
				description:
					'Return the full raw Bitrix24 response including result, error, total, next, time fields',
			},
		],
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject, IHttpRequestMethods } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';

export async function executeRawApi(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	const outputOptions = this.getNodeParameter('outputOptions', i, {}) as IDataObject;
	const rawResponse = outputOptions.rawResponse as boolean ?? false;

	if (operation === 'execute') {
		const method = (this.getNodeParameter('method', i) as string).trim();
		const httpMethod = this.getNodeParameter('httpMethod', i, 'POST') as IHttpRequestMethods;
		const fetchAll = this.getNodeParameter('fetchAll', i, false) as boolean;
		const paramsRaw = this.getNodeParameter('params', i, '{}') as string;

		let params: IDataObject = {};
		try {
			params = typeof paramsRaw === 'string' ? JSON.parse(paramsRaw) : paramsRaw;
		} catch (_) {
			throw new Error(`Invalid JSON in Parameters field: ${paramsRaw}`);
		}

		if (fetchAll) {
			// Auto-paginate
			const items = await bitrix24ApiRequestAllItems.call(this, httpMethod, method, params);
			responseData = rawResponse
				? { result: items, total: items.length }
				: { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, httpMethod, method, params);
			responseData = rawResponse ? res : ((res.result as IDataObject) ?? res);
		}
	}

	else if (operation === 'batch') {
		const batchRaw = this.getNodeParameter('batchCommands', i) as string;
		const haltOnError = this.getNodeParameter('haltOnError', i, true) as boolean;

		let batchBody: IDataObject = {};
		try {
			batchBody = typeof batchRaw === 'string' ? JSON.parse(batchRaw) : batchRaw;
		} catch (_) {
			throw new Error(`Invalid JSON in Batch Commands field: ${batchRaw}`);
		}

		const res = await bitrix24ApiRequest.call(this, 'POST', 'batch', {
			halt: haltOnError ? 1 : 0,
			...batchBody,
		});

		responseData = rawResponse ? res : ((res.result as IDataObject) ?? res);
	}

	return responseData;
}
