import { INodeProperties } from 'n8n-workflow';

// ─── Task Operations ──────────────────────────────────────────────────────────
export const taskOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['task'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a task' },
			{ name: 'Get', value: 'get', action: 'Get a task' },
			{ name: 'Update', value: 'update', action: 'Update a task' },
			{ name: 'Delete', value: 'delete', action: 'Delete a task' },
			{ name: 'List', value: 'list', action: 'List tasks' },
			{ name: 'Complete', value: 'complete', action: 'Complete a task' },
		],
		default: 'create',
	},
];

export const taskFields: INodeProperties[] = [
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['task'], operation: ['get', 'update', 'delete', 'complete'] } },
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['task'], operation: ['create'] } },
	},

	// ── Fixed Fields (create + update) ────────────────────────────────────────
	{
		displayName: 'Task Fields',
		name: 'taskFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['task'], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Title', name: 'TITLE', type: 'string', default: '', displayOptions: { show: { '/operation': ['update'] } } },
			{ displayName: 'Description', name: 'DESCRIPTION', type: 'string', typeOptions: { rows: 4 }, default: '' },
			{
				displayName: 'Responsible (Assignee)',
				name: 'RESPONSIBLE_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
				description: 'User responsible for executing the task',
			},
			{
				displayName: 'Created By',
				name: 'CREATED_BY',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{
				displayName: 'Priority',
				name: 'PRIORITY',
				type: 'options',
				options: [
					{ name: 'Low', value: '0' },
					{ name: 'Normal', value: '1' },
					{ name: 'High', value: '2' },
				],
				default: '1',
			},
			{
				displayName: 'Status',
				name: 'STATUS',
				type: 'options',
				options: [
					{ name: 'New', value: '1' },
					{ name: 'Pending', value: '2' },
					{ name: 'In Progress', value: '3' },
					{ name: 'Supposedly Completed', value: '4' },
					{ name: 'Completed', value: '5' },
					{ name: 'Declined', value: '6' },
					{ name: 'Waiting Control', value: '7' },
				],
				default: '1',
				displayOptions: { show: { '/operation': ['update'] } },
			},
			{ displayName: 'Deadline', name: 'DEADLINE', type: 'dateTime', default: '' },
			{ displayName: 'Start Date', name: 'START_DATE_PLAN', type: 'dateTime', default: '' },
			{ displayName: 'End Date', name: 'END_DATE_PLAN', type: 'dateTime', default: '' },
			{ displayName: 'Group/Project ID', name: 'GROUP_ID', type: 'string', default: '', description: 'ID of the workgroup/project' },
			{ displayName: 'Parent Task ID', name: 'PARENT_ID', type: 'string', default: '' },
			{
				displayName: 'Allow Time Tracking',
				name: 'ALLOW_TIME_TRACKING',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Tags',
				name: 'TAGS',
				type: 'string',
				default: '',
				description: 'Comma-separated tags',
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
		displayOptions: { show: { resource: ['task'], operation: ['list'] } },
		options: [
			{
				displayName: 'Responsible User',
				name: 'RESPONSIBLE_ID',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getUsers' },
				default: '',
			},
			{
				displayName: 'Status',
				name: 'STATUS',
				type: 'options',
				options: [
					{ name: 'New', value: '1' },
					{ name: 'Pending', value: '2' },
					{ name: 'In Progress', value: '3' },
					{ name: 'Completed', value: '5' },
					{ name: 'Declined', value: '6' },
				],
				default: '',
			},
			{ displayName: 'Group/Project ID', name: 'GROUP_ID', type: 'string', default: '' },
			{ displayName: 'Deadline Before', name: 'DEADLINE_before', type: 'dateTime', default: '' },
			{ displayName: 'Deadline After', name: 'DEADLINE_after', type: 'dateTime', default: '' },
		],
	},
	{
		displayName: 'Advanced Filter (Raw JSON)',
		name: 'advancedFilter',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['task'], operation: ['list'] } },
	},
	{
		displayName: 'Max Results',
		name: 'limit',
		type: 'number',
		default: 50,
		displayOptions: { show: { resource: ['task'], operation: ['list'] } },
	},
];

// ─── Task Comment Operations ──────────────────────────────────────────────────
export const taskCommentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['taskComment'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Add a comment to a task' },
			{ name: 'Get', value: 'get', action: 'Get a comment' },
			{ name: 'List', value: 'list', action: 'List comments for a task' },
			{ name: 'Update', value: 'update', action: 'Update a comment' },
			{ name: 'Delete', value: 'delete', action: 'Delete a comment' },
		],
		default: 'create',
	},
];

export const taskCommentFields: INodeProperties[] = [
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['taskComment'], operation: ['create', 'list'] } },
	},
	{
		displayName: 'Comment ID',
		name: 'commentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['taskComment'], operation: ['get', 'update', 'delete'] } },
	},
	{
		displayName: 'Task ID',
		name: 'taskIdForComment',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the parent task',
		displayOptions: { show: { resource: ['taskComment'], operation: ['get', 'update', 'delete'] } },
	},
	{
		displayName: 'Comment Text',
		name: 'commentText',
		type: 'string',
		required: true,
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: { show: { resource: ['taskComment'], operation: ['create', 'update'] } },
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest, bitrix24ApiRequestAllItems } from '../../GenericFunctions';

export async function executeTask(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const title = this.getNodeParameter('title', i) as string;
		const taskFieldsRaw = this.getNodeParameter('taskFields', i, {}) as IDataObject;
		const fields: IDataObject = { TITLE: title, ...taskFieldsRaw };
		if (fields.TAGS && typeof fields.TAGS === 'string') {
			fields.TAGS = (fields.TAGS as string).split(',').map((t) => t.trim());
		}
		const res = await bitrix24ApiRequest.call(this, 'POST', 'tasks.task.add', { fields });
		responseData = { id: (res.result as IDataObject)?.task?.id ?? res.result, success: true };
	}
	else if (operation === 'get') {
		const id = this.getNodeParameter('taskId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'tasks.task.get', { taskId: id });
		responseData = (res.result as IDataObject)?.task as IDataObject;
	}
	else if (operation === 'update') {
		const id = this.getNodeParameter('taskId', i) as string;
		const taskFieldsRaw = this.getNodeParameter('taskFields', i, {}) as IDataObject;
		const fields: IDataObject = { ...taskFieldsRaw };
		const res = await bitrix24ApiRequest.call(this, 'POST', 'tasks.task.update', { taskId: id, fields });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'delete') {
		const id = this.getNodeParameter('taskId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'tasks.task.delete', { taskId: id });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'complete') {
		const id = this.getNodeParameter('taskId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'tasks.task.complete', { taskId: id });
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
			const items = await bitrix24ApiRequestAllItems.call(this, 'POST', 'tasks.task.list', { filter, select: ['*'] });
			responseData = { items, total: items.length };
		} else {
			const res = await bitrix24ApiRequest.call(this, 'POST', 'tasks.task.list', { filter, select: ['*'], start: 0 });
			const result = res.result as IDataObject;
			responseData = { items: result.tasks ?? res.result, total: res.total };
		}
	}

	return responseData;
}

export async function executeTaskComment(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const taskId = this.getNodeParameter('taskId', i) as string;
		const text = this.getNodeParameter('commentText', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'task.commentitem.add', {
			TASK_ID: taskId,
			fields: { POST_MESSAGE: text },
		});
		responseData = { id: res.result, success: true };
	}
	else if (operation === 'get') {
		const taskId = this.getNodeParameter('taskIdForComment', i) as string;
		const commentId = this.getNodeParameter('commentId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'task.commentitem.get', {
			TASK_ID: taskId,
			ITEM_ID: commentId,
		});
		responseData = res.result as IDataObject;
	}
	else if (operation === 'list') {
		const taskId = this.getNodeParameter('taskId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'task.commentitem.getlist', { TASK_ID: taskId });
		responseData = { items: res.result, total: res.total };
	}
	else if (operation === 'update') {
		const taskId = this.getNodeParameter('taskIdForComment', i) as string;
		const commentId = this.getNodeParameter('commentId', i) as string;
		const text = this.getNodeParameter('commentText', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'task.commentitem.update', {
			TASK_ID: taskId,
			ITEM_ID: commentId,
			fields: { POST_MESSAGE: text },
		});
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'delete') {
		const taskId = this.getNodeParameter('taskIdForComment', i) as string;
		const commentId = this.getNodeParameter('commentId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'task.commentitem.delete', {
			TASK_ID: taskId,
			ITEM_ID: commentId,
		});
		responseData = { success: res.result as boolean };
	}

	return responseData;
}
