import { INodeProperties, IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest } from '../../GenericFunctions';

// Owner type codes: D=Deal, L=Lead, C=Contact, CO=Company, Q=Quote, etc.
const ownerTypeOptions = [
	{ name: 'Deal (Negócio) — D',      value: 'D' },
	{ name: 'Lead — L',               value: 'L' },
	{ name: 'Quote (Orçamento) — Q',   value: 'Q' },
	{ name: 'Invoice (old) — I',       value: 'I' },
	{ name: 'Smart Process (SPA)',      value: 'T' },
];

const discountTypeOptions = [
	{ name: 'Absoluto (valor fixo)', value: 1 },
	{ name: 'Percentual (%)',        value: 2 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATIONS & FIELDS
// ═══════════════════════════════════════════════════════════════════════════════

export const productRowOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['productRow'] } },
		options: [
			{ name: 'Add',        value: 'add',    action: 'Add a product row to a CRM object' },
			{ name: 'Get',        value: 'get',    action: 'Get a product row by ID' },
			{ name: 'Update',     value: 'update', action: 'Update a product row' },
			{ name: 'Delete',     value: 'delete', action: 'Delete a product row' },
			{ name: 'List',       value: 'list',   action: 'List product rows of a CRM object' },
			{ name: 'Set (bulk)', value: 'set',    action: 'Replace all product rows of a CRM object' },
		],
		default: 'add',
	},
];

export const productRowFields: INodeProperties[] = [

	// ── Row ID (get / update / delete) ────────────────────────────────────────
	{
		displayName: 'Product Row ID',
		name: 'productRowId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID da linha de produto',
		displayOptions: { show: { resource: ['productRow'], operation: ['get', 'update', 'delete'] } },
	},

	// ── Owner (add / list / set) ──────────────────────────────────────────────
	{
		displayName: 'Owner Type',
		name: 'ownerType',
		type: 'options',
		required: true,
		options: ownerTypeOptions,
		default: 'D',
		description: 'Tipo do objeto CRM ao qual a linha de produto pertence',
		displayOptions: { show: { resource: ['productRow'], operation: ['add', 'list', 'set'] } },
	},
	{
		displayName: 'Owner ID',
		name: 'ownerId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID do objeto CRM (ex: ID do negócio)',
		displayOptions: { show: { resource: ['productRow'], operation: ['add', 'list', 'set'] } },
	},

	// ── Core product fields (add / update) ────────────────────────────────────
	{
		displayName: 'Product ID',
		name: 'productId',
		type: 'string',
		default: '',
		description: 'ID do produto no catálogo. Deixe vazio para produto avulso.',
		displayOptions: { show: { resource: ['productRow'], operation: ['add', 'update'] } },
	},
	{
		displayName: 'Product Name',
		name: 'productName',
		type: 'string',
		default: '',
		description: 'Nome do produto. Se vazio e productId informado, usa o nome do catálogo.',
		displayOptions: { show: { resource: ['productRow'], operation: ['add', 'update'] } },
	},
	{
		displayName: 'Price (unit)',
		name: 'price',
		type: 'number',
		default: 0,
		description: 'Preço unitário (já com desconto e impostos)',
		displayOptions: { show: { resource: ['productRow'], operation: ['add', 'update'] } },
	},
	{
		displayName: 'Quantity',
		name: 'quantity',
		type: 'number',
		default: 1,
		displayOptions: { show: { resource: ['productRow'], operation: ['add', 'update'] } },
	},

	// ── Optional product fields (add / update) ────────────────────────────────
	{
		displayName: 'Optional Fields',
		name: 'optionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['productRow'], operation: ['add', 'update'] } },
		options: [
			{
				displayName: 'Discount Type',
				name: 'discountTypeId',
				type: 'options',
				options: discountTypeOptions,
				default: 2,
				description: 'Tipo de desconto',
			},
			{
				displayName: 'Discount Rate (%)',
				name: 'discountRate',
				type: 'number',
				default: 0,
				description: 'Percentual de desconto (quando tipo = Percentual)',
			},
			{
				displayName: 'Discount Amount',
				name: 'discountSum',
				type: 'number',
				default: 0,
				description: 'Valor fixo de desconto (quando tipo = Absoluto)',
			},
			{
				displayName: 'Tax Rate (%)',
				name: 'taxRate',
				type: 'number',
				default: 0,
			},
			{
				displayName: 'Tax Included',
				name: 'taxIncluded',
				type: 'options',
				options: [
					{ name: 'Sim (Y)', value: 'Y' },
					{ name: 'Não (N)', value: 'N' },
				],
				default: 'N',
				description: 'Imposto incluso no preço?',
			},
			{
				displayName: 'Measure Code',
				name: 'measureCode',
				type: 'number',
				default: 796,
				description: 'Código da unidade de medida (796 = unidade)',
			},
			{
				displayName: 'Sort Order',
				name: 'sort',
				type: 'number',
				default: 10,
				description: 'Posição na lista de produtos',
			},
			{
				displayName: 'Currency',
				name: 'currency',
				type: 'string',
				default: 'BRL',
			},
		],
	},

	// ── Set (bulk) — array of rows ────────────────────────────────────────────
	{
		displayName: 'Product Rows (JSON)',
		name: 'productRowsJson',
		type: 'json',
		required: true,
		default: `[
  {
    "productId": 1,
    "price": 100,
    "quantity": 2,
    "discountTypeId": 2,
    "discountRate": 10,
    "taxRate": 0,
    "taxIncluded": "N"
  }
]`,
		description: 'Array JSON com todas as linhas de produto. Substitui TODAS as linhas existentes.',
		displayOptions: { show: { resource: ['productRow'], operation: ['set'] } },
	},
];

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTE
// ═══════════════════════════════════════════════════════════════════════════════

export async function executeProductRow(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'add') {
		const ownerType    = this.getNodeParameter('ownerType', i) as string;
		const ownerId      = this.getNodeParameter('ownerId', i) as string;
		const productId    = this.getNodeParameter('productId', i, '') as string;
		const productName  = this.getNodeParameter('productName', i, '') as string;
		const price        = this.getNodeParameter('price', i) as number;
		const quantity     = this.getNodeParameter('quantity', i) as number;
		const optional     = this.getNodeParameter('optionalFields', i, {}) as IDataObject;

		const fields: IDataObject = {
			ownerType,
			ownerId,
			price,
			quantity,
			...optional,
		};
		if (productId)   fields.productId   = productId;
		if (productName) fields.productName = productName;

		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.item.productrow.add', { fields });
		responseData = { id: (res.result as IDataObject)?.productRow ?? res.result, success: true };
	}

	else if (operation === 'get') {
		const id  = this.getNodeParameter('productRowId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.item.productrow.get', { id });
		responseData = (res.result as IDataObject)?.productRow as IDataObject ?? res.result as IDataObject;
	}

	else if (operation === 'update') {
		const id           = this.getNodeParameter('productRowId', i) as string;
		const productId    = this.getNodeParameter('productId', i, '') as string;
		const productName  = this.getNodeParameter('productName', i, '') as string;
		const price        = this.getNodeParameter('price', i) as number;
		const quantity     = this.getNodeParameter('quantity', i) as number;
		const optional     = this.getNodeParameter('optionalFields', i, {}) as IDataObject;

		const fields: IDataObject = { price, quantity, ...optional };
		if (productId)   fields.productId   = productId;
		if (productName) fields.productName = productName;

		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.item.productrow.update', { id, fields });
		responseData = { success: res.result as boolean };
	}

	else if (operation === 'delete') {
		const id  = this.getNodeParameter('productRowId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.item.productrow.delete', { id });
		responseData = { success: res.result as boolean };
	}

	else if (operation === 'list') {
		const ownerType = this.getNodeParameter('ownerType', i) as string;
		const ownerId   = this.getNodeParameter('ownerId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.item.productrow.get', {
			filter: { ownerType, ownerId },
		});
		// API returns {productRows: [...]} for list context
		const rows = (res.result as IDataObject)?.productRows ?? res.result;
		responseData = { items: rows };
	}

	else if (operation === 'set') {
		const ownerType      = this.getNodeParameter('ownerType', i) as string;
		const ownerId        = this.getNodeParameter('ownerId', i) as string;
		const rowsRaw        = this.getNodeParameter('productRowsJson', i) as string;

		let rows: IDataObject[] = [];
		try { rows = JSON.parse(rowsRaw) as IDataObject[]; } catch (_) {
			rows = [];
		}

		// crm.item.productrow.set replaces ALL rows atomically
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.item.productrow.set', {
			ownerType,
			ownerId,
			productRows: rows,
		});
		responseData = { success: res.result as boolean };
	}

	return responseData;
}
