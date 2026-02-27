import { INodeProperties, IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest } from '../../GenericFunctions';

// ─── Shared entity type options ───────────────────────────────────────────────
const entityTypeOptions = [
	{ name: 'Deal',    value: 'deal' },
	{ name: 'Lead',    value: 'lead' },
	{ name: 'Contact', value: 'contact' },
	{ name: 'Company', value: 'company' },
];

// Numeric OWNER_TYPE_ID for crm.activity.*
const ownerTypeIdOptions = [
	{ name: 'Lead (1)',    value: 1 },
	{ name: 'Deal (2)',    value: 2 },
	{ name: 'Contact (3)', value: 3 },
	{ name: 'Company (4)', value: 4 },
	{ name: 'Quote (7)',   value: 7 },
	{ name: 'Invoice (5)', value: 5 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE COMMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const timelineCommentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['timelineComment'] } },
		options: [
			{ name: 'Add',    value: 'add',    action: 'Add a comment to an entity timeline' },
			{ name: 'Get',    value: 'get',    action: 'Get a timeline comment by ID' },
			{ name: 'Update', value: 'update', action: 'Update a timeline comment' },
			{ name: 'Delete', value: 'delete', action: 'Delete a timeline comment' },
			{ name: 'List',   value: 'list',   action: 'List timeline comments for an entity' },
		],
		default: 'add',
	},
];

export const timelineCommentFields: INodeProperties[] = [
	// ── add / list — entity context ───────────────────────────────────────────
	{
		displayName: 'Entity Type',
		name: 'commentEntityType',
		type: 'options',
		required: true,
		options: entityTypeOptions,
		default: 'deal',
		displayOptions: { show: { resource: ['timelineComment'], operation: ['add', 'list'] } },
	},
	{
		displayName: 'Entity ID',
		name: 'commentEntityId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['timelineComment'], operation: ['add', 'list'] } },
	},
	// ── add — comment text ────────────────────────────────────────────────────
	{
		displayName: 'Comment',
		name: 'commentText',
		type: 'string',
		required: true,
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: { show: { resource: ['timelineComment'], operation: ['add'] } },
	},
	// ── get / delete / update — ID ────────────────────────────────────────────
	{
		displayName: 'Comment ID',
		name: 'commentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['timelineComment'], operation: ['get', 'delete', 'update'] } },
	},
	// ── update — new text ─────────────────────────────────────────────────────
	{
		displayName: 'New Comment Text',
		name: 'commentNewText',
		type: 'string',
		required: true,
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: { show: { resource: ['timelineComment'], operation: ['update'] } },
	},
	// ── list — limit ──────────────────────────────────────────────────────────
	{
		displayName: 'Max Results',
		name: 'commentLimit',
		type: 'number',
		default: 50,
		displayOptions: { show: { resource: ['timelineComment'], operation: ['list'] } },
	},
];

export async function executeTimelineComment(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'add') {
		const entityType = this.getNodeParameter('commentEntityType', i) as string;
		const entityId   = this.getNodeParameter('commentEntityId', i) as string;
		const comment    = this.getNodeParameter('commentText', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.comment.add', {
			fields: { ENTITY_ID: entityId, ENTITY_TYPE: entityType, COMMENT: comment },
		});
		responseData = { id: res.result, success: true };
	}
	else if (operation === 'get') {
		const id  = this.getNodeParameter('commentId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.comment.get', { id });
		responseData = res.result as IDataObject;
	}
	else if (operation === 'update') {
		const id      = this.getNodeParameter('commentId', i) as string;
		const comment = this.getNodeParameter('commentNewText', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.comment.update', {
			id,
			fields: { COMMENT: comment },
		});
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'delete') {
		const id  = this.getNodeParameter('commentId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.comment.delete', { id });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'list') {
		const entityType = this.getNodeParameter('commentEntityType', i) as string;
		const entityId   = this.getNodeParameter('commentEntityId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.comment.list', {
			filter: { ENTITY_ID: entityId, ENTITY_TYPE: entityType },
			select: ['*'],
			start: 0,
		});
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE NOTE (crm.timeline.note.*)
// ═══════════════════════════════════════════════════════════════════════════════

export const timelineNoteOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['timelineNote'] } },
		options: [
			{ name: 'Add',    value: 'add',    action: 'Add a note to an entity timeline' },
			{ name: 'Get',    value: 'get',    action: 'Get a note by ID' },
			{ name: 'Update', value: 'update', action: 'Update a note' },
			{ name: 'Delete', value: 'delete', action: 'Delete a note' },
			{ name: 'List',   value: 'list',   action: 'List notes for an entity' },
		],
		default: 'add',
	},
];

export const timelineNoteFields: INodeProperties[] = [
	{
		displayName: 'Entity Type',
		name: 'noteEntityType',
		type: 'options',
		required: true,
		options: entityTypeOptions,
		default: 'deal',
		displayOptions: { show: { resource: ['timelineNote'], operation: ['add', 'list'] } },
	},
	{
		displayName: 'Entity ID',
		name: 'noteEntityId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['timelineNote'], operation: ['add', 'list'] } },
	},
	{
		displayName: 'Note Text',
		name: 'noteText',
		type: 'string',
		required: true,
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: { show: { resource: ['timelineNote'], operation: ['add'] } },
	},
	{
		displayName: 'Note ID',
		name: 'noteId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['timelineNote'], operation: ['get', 'delete', 'update'] } },
	},
	{
		displayName: 'New Note Text',
		name: 'noteNewText',
		type: 'string',
		required: true,
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: { show: { resource: ['timelineNote'], operation: ['update'] } },
	},
	{
		displayName: 'Max Results',
		name: 'noteLimit',
		type: 'number',
		default: 50,
		displayOptions: { show: { resource: ['timelineNote'], operation: ['list'] } },
	},
];

export async function executeTimelineNote(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'add') {
		const entityType = this.getNodeParameter('noteEntityType', i) as string;
		const entityId   = this.getNodeParameter('noteEntityId', i) as string;
		const text       = this.getNodeParameter('noteText', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.note.add', {
			entityTypeId: entityType,
			entityId,
			fields: { TEXT: text },
		});
		responseData = { id: res.result, success: true };
	}
	else if (operation === 'get') {
		const id  = this.getNodeParameter('noteId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.note.get', { id });
		responseData = res.result as IDataObject;
	}
	else if (operation === 'update') {
		const id   = this.getNodeParameter('noteId', i) as string;
		const text = this.getNodeParameter('noteNewText', i) as string;
		const res  = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.note.update', {
			id,
			fields: { TEXT: text },
		});
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'delete') {
		const id  = this.getNodeParameter('noteId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.note.delete', { id });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'list') {
		const entityType = this.getNodeParameter('noteEntityType', i) as string;
		const entityId   = this.getNodeParameter('noteEntityId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.note.list', {
			entityTypeId: entityType,
			entityId,
		});
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE BINDING (crm.timeline.bindings.*)
// ═══════════════════════════════════════════════════════════════════════════════

export const timelineBindingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['timelineBinding'] } },
		options: [
			{ name: 'Bind',   value: 'bind',   action: 'Bind a timeline entry to another entity' },
			{ name: 'Unbind', value: 'unbind', action: 'Remove a timeline binding' },
			{ name: 'List',   value: 'list',   action: 'List bindings for a timeline entry' },
		],
		default: 'bind',
	},
];

export const timelineBindingFields: INodeProperties[] = [
	{
		displayName: 'Timeline Entity Type ID',
		name: 'bindingTimelineTypeId',
		type: 'string',
		required: true,
		default: '',
		description: 'Numeric type ID of the timeline entry owner (e.g. 2 = Deal)',
		displayOptions: { show: { resource: ['timelineBinding'], operation: ['bind', 'unbind', 'list'] } },
	},
	{
		displayName: 'Timeline Entity ID',
		name: 'bindingTimelineId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['timelineBinding'], operation: ['bind', 'unbind', 'list'] } },
	},
	{
		displayName: 'Target Entity Type ID',
		name: 'bindingTargetTypeId',
		type: 'string',
		required: true,
		default: '',
		description: 'Numeric type ID of the target entity to bind to',
		displayOptions: { show: { resource: ['timelineBinding'], operation: ['bind', 'unbind'] } },
	},
	{
		displayName: 'Target Entity ID',
		name: 'bindingTargetId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['timelineBinding'], operation: ['bind', 'unbind'] } },
	},
];

export async function executeTimelineBinding(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	const timelineTypeId = this.getNodeParameter('bindingTimelineTypeId', i) as string;
	const timelineId     = this.getNodeParameter('bindingTimelineId', i) as string;

	if (operation === 'bind') {
		const targetTypeId = this.getNodeParameter('bindingTargetTypeId', i) as string;
		const targetId     = this.getNodeParameter('bindingTargetId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.bindings.bind', {
			fields: {
				ENTITY_TYPE_ID: timelineTypeId,
				ENTITY_ID: timelineId,
				OWNER_TYPE_ID: targetTypeId,
				OWNER_ID: targetId,
			},
		});
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'unbind') {
		const targetTypeId = this.getNodeParameter('bindingTargetTypeId', i) as string;
		const targetId     = this.getNodeParameter('bindingTargetId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.bindings.unbind', {
			fields: {
				ENTITY_TYPE_ID: timelineTypeId,
				ENTITY_ID: timelineId,
				OWNER_TYPE_ID: targetTypeId,
				OWNER_ID: targetId,
			},
		});
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'list') {
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.timeline.bindings.list', {
			filter: { ENTITY_TYPE_ID: timelineTypeId, ENTITY_ID: timelineId },
		});
		responseData = { items: res.result, total: res.total };
	}

	return responseData;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE ACTIVITY (crm.activity.*)  — NEW in v0.0.8
// ═══════════════════════════════════════════════════════════════════════════════

export const timelineActivityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['timelineActivity'] } },
		options: [
			{ name: 'Add',    value: 'add',    action: 'Add an activity to a CRM entity' },
			{ name: 'Get',    value: 'get',    action: 'Get an activity by ID' },
			{ name: 'Update', value: 'update', action: 'Update an activity' },
			{ name: 'Delete', value: 'delete', action: 'Delete an activity' },
			{ name: 'List',   value: 'list',   action: 'List activities for a CRM entity' },
		],
		default: 'add',
	},
];

export const timelineActivityFields: INodeProperties[] = [

	// ── add ───────────────────────────────────────────────────────────────────
	{
		displayName: 'Subject',
		name: 'actSubject',
		type: 'string',
		required: true,
		default: '',
		description: 'Title / subject of the activity',
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['add'] } },
	},
	{
		displayName: 'Owner Type',
		name: 'actOwnerTypeId',
		type: 'options',
		required: true,
		options: ownerTypeIdOptions,
		default: 2,
		description: 'CRM entity type that owns this activity',
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['add'] } },
	},
	{
		displayName: 'Owner ID',
		name: 'actOwnerId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the CRM entity that owns this activity',
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['add'] } },
	},
	{
		displayName: 'Activity Type',
		name: 'actTypeId',
		type: 'options',
		required: true,
		options: [
			{ name: 'Meeting (1)',  value: 1 },
			{ name: 'Call (2)',     value: 2 },
			{ name: 'Task (6)',     value: 6 },
			{ name: 'E-mail (4)',   value: 4 },
		],
		default: 1,
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['add'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'actExtra',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['add'] } },
		options: [
			{ displayName: 'Description', name: 'DESCRIPTION', type: 'string', typeOptions: { rows: 3 }, default: '' },
			{ displayName: 'Start Time',  name: 'START_TIME',  type: 'dateTime', default: '' },
			{ displayName: 'End Time',    name: 'END_TIME',    type: 'dateTime', default: '' },
			{ displayName: 'Deadline',    name: 'DEADLINE',    type: 'dateTime', default: '' },
			{
				displayName: 'Completed',
				name: 'COMPLETED',
				type: 'boolean',
				default: false,
				description: 'Mark this activity as completed',
			},
			{
				displayName: 'Priority',
				name: 'PRIORITY',
				type: 'options',
				options: [
					{ name: 'Low (1)',    value: 1 },
					{ name: 'Normal (2)', value: 2 },
					{ name: 'High (3)',   value: 3 },
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
			{
				displayName: 'Direction',
				name: 'DIRECTION',
				type: 'options',
				options: [
					{ name: 'Incoming (1)', value: 1 },
					{ name: 'Outgoing (2)', value: 2 },
				],
				default: 2,
			},
		],
	},

	// ── get / delete / update ─────────────────────────────────────────────────
	{
		displayName: 'Activity ID',
		name: 'actId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['get', 'delete', 'update'] } },
	},

	// ── update ────────────────────────────────────────────────────────────────
	{
		displayName: 'Update Fields',
		name: 'actUpdateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['update'] } },
		options: [
			{ displayName: 'Subject',     name: 'SUBJECT',      type: 'string',   default: '' },
			{ displayName: 'Description', name: 'DESCRIPTION',  type: 'string',   typeOptions: { rows: 3 }, default: '' },
			{ displayName: 'Start Time',  name: 'START_TIME',   type: 'dateTime', default: '' },
			{ displayName: 'End Time',    name: 'END_TIME',      type: 'dateTime', default: '' },
			{ displayName: 'Deadline',    name: 'DEADLINE',     type: 'dateTime', default: '' },
			{ displayName: 'Completed',   name: 'COMPLETED',    type: 'boolean',  default: false },
			{
				displayName: 'Priority',
				name: 'PRIORITY',
				type: 'options',
				options: [{ name: 'Low', value: 1 }, { name: 'Normal', value: 2 }, { name: 'High', value: 3 }],
				default: 2,
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

	// ── list ──────────────────────────────────────────────────────────────────
	{
		displayName: 'Owner Type',
		name: 'actListOwnerTypeId',
		type: 'options',
		required: true,
		options: ownerTypeIdOptions,
		default: 2,
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['list'] } },
	},
	{
		displayName: 'Owner ID',
		name: 'actListOwnerId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['list'] } },
	},
	{
		displayName: 'Max Results',
		name: 'actListLimit',
		type: 'number',
		default: 50,
		displayOptions: { show: { resource: ['timelineActivity'], operation: ['list'] } },
	},
];

export async function executeTimelineActivity(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'add') {
		const subject     = this.getNodeParameter('actSubject', i) as string;
		const ownerTypeId = this.getNodeParameter('actOwnerTypeId', i) as number;
		const ownerId     = this.getNodeParameter('actOwnerId', i) as string;
		const typeId      = this.getNodeParameter('actTypeId', i) as number;
		const extra       = this.getNodeParameter('actExtra', i, {}) as IDataObject;

		const fields: IDataObject = {
			OWNER_TYPE_ID: ownerTypeId,
			OWNER_ID: ownerId,
			TYPE_ID: typeId,
			SUBJECT: subject,
			...extra,
		};
		// Convert boolean COMPLETED → Y/N
		if (fields.COMPLETED !== undefined) {
			fields.COMPLETED = fields.COMPLETED ? 'Y' : 'N';
		}

		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.add', { fields });
		responseData = { id: res.result, success: true };
	}
	else if (operation === 'get') {
		const id  = this.getNodeParameter('actId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.get', { id });
		responseData = res.result as IDataObject;
	}
	else if (operation === 'update') {
		const id           = this.getNodeParameter('actId', i) as string;
		const updateFields = this.getNodeParameter('actUpdateFields', i, {}) as IDataObject;

		const fields: IDataObject = { ...updateFields };
		if (fields.COMPLETED !== undefined) {
			fields.COMPLETED = fields.COMPLETED ? 'Y' : 'N';
		}

		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.update', { id, fields });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'delete') {
		const id  = this.getNodeParameter('actId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.delete', { id });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'list') {
		const ownerTypeId = this.getNodeParameter('actListOwnerTypeId', i) as number;
		const ownerId     = this.getNodeParameter('actListOwnerId', i) as string;
		const limit       = this.getNodeParameter('actListLimit', i, 50) as number;

		const res = await bitrix24ApiRequest.call(this, 'POST', 'crm.activity.list', {
			filter: { OWNER_TYPE_ID: ownerTypeId, OWNER_ID: ownerId },
			select: ['*'],
			start: 0,
		});
		let items = (res.result as IDataObject[]) || [];
		if (limit > 0) items = items.slice(0, limit);
		responseData = { items, total: res.total };
	}

	return responseData;
}
