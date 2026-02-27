import { INodeProperties } from 'n8n-workflow';

// ─── File Operations ──────────────────────────────────────────────────────────
export const driveFileOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['driveFile'] } },
		options: [
			{ name: 'Upload', value: 'upload', action: 'Upload a file to Drive' },
			{ name: 'Get', value: 'get', action: 'Get file info' },
			{ name: 'Delete', value: 'delete', action: 'Delete a file' },
			{ name: 'List', value: 'list', action: 'List files in a folder' },
			{ name: 'Get Download URL', value: 'getUrl', action: 'Get file download URL' },
		],
		default: 'list',
	},
];

export const driveFileFields: INodeProperties[] = [
	// ── UPLOAD ────────────────────────────────────────────────────────────────
	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the target folder. Use 0 for storage root.',
		displayOptions: { show: { resource: ['driveFile'], operation: ['upload', 'list'] } },
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['driveFile'], operation: ['upload'] } },
	},
	{
		displayName: 'File Content (Base64)',
		name: 'fileContent',
		type: 'string',
		required: true,
		default: '',
		description: 'Base64-encoded content of the file to upload',
		displayOptions: { show: { resource: ['driveFile'], operation: ['upload'] } },
	},
	{
		displayName: 'Storage',
		name: 'storageId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getDriveStorages' },
		default: '',
		displayOptions: { show: { resource: ['driveFile'], operation: ['upload'] } },
	},

	// ── GET / DELETE / URL ────────────────────────────────────────────────────
	{
		displayName: 'File ID',
		name: 'fileId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['driveFile'], operation: ['get', 'delete', 'getUrl'] } },
	},
];

// ─── Folder Operations ────────────────────────────────────────────────────────
export const driveFolderOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['driveFolder'] } },
		options: [
			{ name: 'Create', value: 'create', action: 'Create a folder' },
			{ name: 'Get', value: 'get', action: 'Get folder info' },
			{ name: 'List', value: 'list', action: 'List subfolders' },
			{ name: 'Delete', value: 'delete', action: 'Delete a folder' },
			{ name: 'Rename', value: 'rename', action: 'Rename a folder' },
		],
		default: 'list',
	},
];

export const driveFolderFields: INodeProperties[] = [
	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['driveFolder'], operation: ['get', 'list', 'delete', 'rename'] } },
	},
	{
		displayName: 'Parent Folder ID',
		name: 'parentFolderId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the parent folder. Use storage root ID if creating at root level.',
		displayOptions: { show: { resource: ['driveFolder'], operation: ['create'] } },
	},
	{
		displayName: 'Folder Name',
		name: 'folderName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['driveFolder'], operation: ['create', 'rename'] } },
	},
];

// ─── Execute ──────────────────────────────────────────────────────────────────
import { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { bitrix24ApiRequest } from '../../GenericFunctions';

export async function executeDriveFile(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'upload') {
		const folderId = this.getNodeParameter('folderId', i) as string;
		const fileName = this.getNodeParameter('fileName', i) as string;
		const fileContent = this.getNodeParameter('fileContent', i) as string;

		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.folder.uploadfile', {
			id: folderId,
			fileContent: [fileName, fileContent],
			data: { NAME: fileName },
		});
		responseData = (res.result as IDataObject) || { success: true };
	}
	else if (operation === 'get') {
		const fileId = this.getNodeParameter('fileId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.file.get', { id: fileId });
		responseData = res.result as IDataObject;
	}
	else if (operation === 'delete') {
		const fileId = this.getNodeParameter('fileId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.file.delete', { id: fileId });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'list') {
		const folderId = this.getNodeParameter('folderId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.folder.getchildren', { id: folderId });
		responseData = { items: res.result, total: res.total };
	}
	else if (operation === 'getUrl') {
		const fileId = this.getNodeParameter('fileId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.file.get', { id: fileId });
		const file = res.result as IDataObject;
		responseData = { downloadUrl: file.DOWNLOAD_URL, name: file.NAME, size: file.SIZE };
	}

	return responseData;
}

export async function executeDriveFolder(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	let responseData: IDataObject = {};

	if (operation === 'create') {
		const parentId = this.getNodeParameter('parentFolderId', i) as string;
		const name = this.getNodeParameter('folderName', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.folder.addsubfolder', {
			id: parentId,
			data: { NAME: name },
		});
		responseData = res.result as IDataObject;
	}
	else if (operation === 'get') {
		const id = this.getNodeParameter('folderId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.folder.get', { id });
		responseData = res.result as IDataObject;
	}
	else if (operation === 'list') {
		const id = this.getNodeParameter('folderId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.folder.getchildren', { id, filter: { TYPE: 'folder' } });
		responseData = { items: res.result, total: res.total };
	}
	else if (operation === 'delete') {
		const id = this.getNodeParameter('folderId', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.folder.delete', { id });
		responseData = { success: res.result as boolean };
	}
	else if (operation === 'rename') {
		const id = this.getNodeParameter('folderId', i) as string;
		const name = this.getNodeParameter('folderName', i) as string;
		const res = await bitrix24ApiRequest.call(this, 'POST', 'disk.folder.rename', { id, newName: name });
		responseData = { success: res.result as boolean };
	}

	return responseData;
}
