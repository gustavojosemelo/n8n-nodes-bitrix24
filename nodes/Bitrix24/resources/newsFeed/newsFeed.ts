import { INodeProperties } from 'n8n-workflow';

// ─── Blog Post (Live Feed) Operations ─────────────────────────────────────────
export const blogPostOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['blogPost'] } },
		options: [
			{ name: 'Create Post', value: 'create', action: 'Create a news feed post' },
			{ name: 'Get Post', value: 'get', action: 'Get a post' },
			{ name: 'Update Post', value: 'update', action: 'Update a post' },
			{ name: 'Delete Post', value: 'delete', action: 'Delete a post' },
			{ name: 'List Posts', value: 'list', action: 'List news feed posts' },
			{ name: 'Add Comment', value: 'addComment', action: 'Add a comment to a post' },
			{ name: 'List Comments', value: 'listComments', action: 'List comments on a post' },
		],
		default: 'create',
	},
];

export const blogPostFields: INodeProperties[] = [
	// ── POST ID ───────────────────────────────────────────────────────────────
	{
		displayName: 'Post ID',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['blogPost'],
				operation: ['get', 'update', 'delete', 'addComment', 'listComments'],
			},
		},
	},

	// ── CREATE / UPDATE TITLE ─────────────────────────────────────────────────
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['blogPost'], operation: ['create'] } },
	},

	// ── CREATE + UPDATE FIELDS ────────────────────────────────────────────────
	{
		displayName: 'Post Fields',
		name: 'postFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['blogPost'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Title',
				name: 'TITLE',
				type: 'string',
				default: '',
				displayOptions: { show: { '/operation': ['update'] } },
			},
			{
				displayName: 'Message / Body',
				name: 'MESSAGE',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				description: 'Main body of the post. Supports BB-code formatting.',
			},
			{
				displayName: 'Audience',
				name: 'DEST',
				type: 'string',
				default: '',
				description:
					'Who can see this post. Format: "UA" (all users), "SG1" (workgroup 1), "U5" (user 5). Comma-separated.',
				placeholder: 'UA',
			},
			{
				displayName: 'Allow Comments',
				name: 'ALLOW_COMMENTS',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Pin Post',
				name: 'IMPORTANT',
				type: 'boolean',
				default: false,
				description: 'Mark post as important/pinned',
			},
			{
				displayName: 'Tags',
				name: 'TAG',
				type: 'string',
				default: '',
				description: 'Comma-separated tags',
			},
		],
	},

	// ── LIST ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Filters',
		name: 'listFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['blogPost'], operation: ['list'] } },
		options: [
			{
				displayName: 'Author User ID',
				name: 'AUTHOR_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{
				displayName: 'Created After',
				name: 'DATE_PUBLISH_from',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Created Before',
				name: 'DATE_PUBLISH_to',
				type: 'dateTime',
				default: '',
			},
		],
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 20,
		displayOptions: { show: { resource: ['blogPost'], operation: ['list'] } },
	},

	// ── ADD COMMENT ───────────────────────────────────────────────────────────
	{
		displayName: 'Comment Text',
		name: 'commentText',
		type: 'string',
		required: true,
		typeOptions: { rows: 3 },
		default: '',
		displayOptions: { show: { resource: ['blogPost'], operation: ['addComment'] } },
	},
];

// ─── CRM Activity Operations ──────────────────────────────────────────────────
export const crmActivityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['crmActivity'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a CRM activity' },
			{ name: 'Get', value: 'get', action: 'Get a CRM activity' },
			{ name: 'Update', value: 'update', action: 'Update a CRM activity' },
			{ name: 'Delete', value: 'delete', action: 'Delete a CRM activity' },
			{ name: 'List', value: 'list', action: 'List CRM activities' },
			{ name: 'Complete', value: 'complete', action: 'Mark activity as completed' },
		],
		default: 'create',
	},
];

export const crmActivityFields: INodeProperties[] = [
	// ── ACTIVITY ID ───────────────────────────────────────────────────────────
	{
		displayName: 'Activity ID',
		name: 'activityId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['crmActivity'],
				operation: ['get', 'update', 'delete', 'complete'],
			},
		},
	},

	// ── CREATE SUBJECT ────────────────────────────────────────────────────────
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		required: true,
		default: '',
		description: 'Subject / title of the activity',
		displayOptions: { show: { resource: ['crmActivity'], operation: ['create'] } },
	},

	// ── CREATE + UPDATE FIELDS ────────────────────────────────────────────────
	{
		displayName: 'Activity Fields',
		name: 'activityFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['crmActivity'], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Subject',
				name: 'SUBJECT',
				type: 'string',
				default: '',
				displayOptions: { show: { '/operation': ['update'] } },
			},
			{
				displayName: 'Type',
				name: 'TYPE_ID',
				type: 'options',
				options: [
					{ name: 'Call (Ligação)', value: 2 },
					{ name: 'Email', value: 4 },
					{ name: 'Meeting (Reunião)', value: 1 },
					{ name: 'Task (Tarefa)', value: 6 },
				],
				default: 1,
				description: 'Type of CRM activity',
			},
			{
				displayName: 'Description',
				name: 'DESCRIPTION',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
			},
			{
				displayName: 'Description Format',
				name: 'DESCRIPTION_TYPE',
				type: 'options',
				options: [
					{ name: 'Plain Text', value: 1 },
					{ name: 'BB-Code', value: 2 },
					{ name: 'HTML', value: 3 },
				],
				default: 1,
			},
			{
				displayName: 'Start Time',
				name: 'START_TIME',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'End Time',
				name: 'END_TIME',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Deadline',
				name: 'DEADLINE',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Completed',
				name: 'COMPLETED',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Priority',
				name: 'PRIORITY',
				type: 'options',
				options: [
					{ name: 'Low', value: 1 },
					{ name: 'Normal', value: 2 },
					{ name: 'High', value: 3 },
				],
				default: 2,
			},
			{
				displayName: 'Responsible User',
				name: 'RESPONSIBLE_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			// Entity binding
			{
				displayName: 'Bind to Entity Type',
				name: 'bindEntityType',
				type: 'options',
				options: [
					{ name: 'Deal (Negócio)', value: 2 },
					{ name: 'Lead', value: 1 },
					{ name: 'Contact (Contato)', value: 3 },
					{ name: 'Company (Empresa)', value: 4 },
				],
				default: 2,
				description: 'CRM entity to link this activity to',
			},
			{
				displayName: 'Bind to Entity ID',
				name: 'bindEntityId',
				type: 'string',
				default: '',
				description: 'ID of the CRM entity to bind this activity to',
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
		displayOptions: { show: { resource: ['crmActivity'], operation: ['list'] } },
		options: [
			{
				displayName: 'Entity Type',
				name: 'OWNER_TYPE_ID',
				type: 'options',
				options: [
					{ name: 'Deal', value: 2 },
					{ name: 'Lead', value: 1 },
					{ name: 'Contact', value: 3 },
					{ name: 'Company', value: 4 },
				],
				default: 2,
			},
			{
				displayName: 'Entity ID',
				name: 'OWNER_ID',
				type: 'string',
				default: '',
				description: 'ID of the CRM entity to list activities for',
			},
			{
				displayName: 'Activity Type',
				name: 'TYPE_ID',
				type: 'options',
				options: [
					{ name: 'Call', value: 2 },
					{ name: 'Email', value: 4 },
					{ name: 'Meeting', value: 1 },
					{ name: 'Task', value: 6 },
				],
				default: '',
			},
			{
				displayName: 'Completed',
				name: 'COMPLETED',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Responsible User',
				name: 'RESPONSIBLE_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
		],
	},
	{
		displayName: 'Advanced Filter (Raw JSON)',
		name: 'advancedFilter',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['crmActivity'], operation: ['list'] } },
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 50,
		displayOptions: { show: { resource: ['crmActivity'], operation: ['list'] } },
	},
];

// ─── Execute Blog Post ────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';

export async function executeBlogPost(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const title = this.getNodeParameter('title', i) as string;
		const fields = this.getNodeParameter('postFields', i, {}) as IDataObject;

		const body: IDataObject = { POST_TITLE: title, ...fields };

		// Handle DEST audience — Bitrix24 expects an array
		if (body.DEST && typeof body.DEST === 'string') {
			body.DEST = (body.DEST as string).split(',').map((d) => d.trim());
		}
		if (body.TAG && typeof body.TAG === 'string') {
			body.TAG = (body.TAG as string).split(',').map((t) => t.trim());
		}

		const res = await bitrix24ApiRequest.call(this, 'POST', 'log.blogpost.add', body);
		responseData = { id: res.result, success: true };
	}

	else if (operation === 'get') {
		const id = this.getNodeParameter('postId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'log.blogpost.get', { POST_ID: id });
		responseData = res.result as IDataObject;
	}

	else if (operation === 'update') {
		const id = this.getNodeParameter('postId', i) as string;
		const fields = this.getNodeParameter('postFields', i, {}) as IDataObject;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'log.blogpost.update', {
			POST_ID: id,
			...fields,
		});
		responseData = { success: res.result as boolean };
	}

	else if (operation === 'delete') {
		const id = this.getNodeParameter('postId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'log.blogpost.delete', { POST_ID: id });
		responseData = { success: res.result as boolean };
	}

	else if (operation === 'list') {
		const filters = this.getNodeParameter('listFilters', i, {}) as IDataObject;
		const limit = this.getNodeParameter('limit', i, 20) as number;

		const body: IDataObject = { ...filters, start: 0 };

		if (limit === 0) {
			const items = await bitrix24ApiRequestAllItems.call(this, 'POST', 'log.blogpost.get', body);
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'log.blogpost.get', body);
			responseData = { items: res.result, total: res.total };
		}
	}

	else if (operation === 'addComment') {
		const postId = this.getNodeParameter('postId', i) as string;
		const text = this.getNodeParameter('commentText', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'log.blogcomment.add', {
			POST_ID: postId,
			TEXT: text,
		});
		responseData = { id: res.result, success: true };
	}

	else if (operation === 'listComments') {
		const postId = this.getNodeParameter('postId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'log.blogcomment.get', {
			POST_ID: postId,
		});
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}

// ─── Execute CRM Activity ─────────────────────────────────────────────────────
export async function executeCrmActivity(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const subject = this.getNodeParameter('subject', i) as string;
		const fields = this.getNodeParameter('activityFields', i, {}) as IDataObject;

		const body: IDataObject = { SUBJECT: subject, ...fields };

		// Build BINDINGS from bindEntityType + bindEntityId
		if (body.bindEntityType && body.bindEntityId) {
			body.BINDINGS = [
				{ OWNER_TYPE_ID: body.bindEntityType, OWNER_ID: body.bindEntityId },
			];
		}
		delete body.bindEntityType;
		delete body.bindEntityId;

		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.add', { fields: body });
		responseData = { id: res.result, success: true };
	}

	else if (operation === 'get') {
		const id = this.getNodeParameter('activityId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.get', { id });
		responseData = res.result as IDataObject;
	}

	else if (operation === 'update') {
		const id = this.getNodeParameter('activityId', i) as string;
		const fields = this.getNodeParameter('activityFields', i, {}) as IDataObject;

		if (fields.bindEntityType && fields.bindEntityId) {
			fields.BINDINGS = [
				{ OWNER_TYPE_ID: fields.bindEntityType, OWNER_ID: fields.bindEntityId },
			];
		}
		delete fields.bindEntityType;
		delete fields.bindEntityId;

		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.update', { id, fields });
		responseData = { success: res.result as boolean };
	}

	else if (operation === 'delete') {
		const id = this.getNodeParameter('activityId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.delete', { id });
		responseData = { success: res.result as boolean };
	}

	else if (operation === 'complete') {
		const id = this.getNodeParameter('activityId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.update', {
			id,
			fields: { COMPLETED: 'Y' },
		});
		responseData = { success: res.result as boolean };
	}

	else if (operation === 'list') {
		const quickFilters = this.getNodeParameter('quickFilters', i, {}) as IDataObject;
		const advancedRaw = this.getNodeParameter('advancedFilter', i, '{}') as string;
		const limit = this.getNodeParameter('limit', i, 50) as number;

		let advancedFilter: IDataObject = {};
		try { advancedFilter = JSON.parse(advancedRaw); } catch (_) {}

		const filter: IDataObject = { ...quickFilters, ...advancedFilter };
		if (filter.COMPLETED !== undefined) filter.COMPLETED = filter.COMPLETED ? 'Y' : 'N';

		if (limit === 0) {
			const items = await bitrix24ApiRequestAllItems.call(
				this, 'POST', 'crm.activity.list', { filter, select: ['*'] },
			);
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.list', {
				filter,
				select: ['*'],
				start: 0,
			});
			responseData = { items: res.result, total: res.total };
		}
	}

	return responseData;
}
