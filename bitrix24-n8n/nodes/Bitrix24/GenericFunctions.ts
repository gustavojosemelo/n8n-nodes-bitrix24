import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestMethods,
	IRequestOptions,
	NodeApiError,
} from 'n8n-workflow';

// ─── Auth helper ─────────────────────────────────────────────────────────────
// Returns the base REST URL regardless of auth mode (webhook or oauth2)
export async function getBaseUrl(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
): Promise<string> {
	const credentials = await this.getCredentials('bitrix24Api');
	const mode = credentials.authMode as string;

	if (mode === 'webhook') {
		// e.g. https://domain.bitrix24.com/rest/1/token/
		const url = (credentials.webhookUrl as string).replace(/\/$/, '');
		return url;
	} else {
		// OAuth2: base is https://domain/rest/
		const domain = (credentials.domain as string).replace(/\/$/, '');
		return `https://${domain}/rest`;
	}
}

// ─── Core request ─────────────────────────────────────────────────────────────
export async function bitrix24ApiRequest(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,          // e.g. 'crm.deal.list'
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<IDataObject> {
	const baseUrl = await getBaseUrl.call(this);
	const credentials = await this.getCredentials('bitrix24Api');

	// For OAuth2 we append the access_token as query param
	if (credentials.authMode === 'oauth2') {
		qs.auth = credentials.accessToken;
	}

	const options: IRequestOptions = {
		method,
		uri: `${baseUrl}/${endpoint}.json`,
		qs,
		body,
		json: true,
	};

	try {
		const response = await this.helpers.request(options);

		if (response.error) {
			throw new NodeApiError(this.getNode(), response, {
				message: response.error_description || response.error,
			});
		}

		return response;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as IDataObject);
	}
}

// ─── Paginated list helper ────────────────────────────────────────────────────
// Bitrix24 returns max 50 items per page; this fetches all pages automatically
export async function bitrix24ApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<IDataObject[]> {
	const allResults: IDataObject[] = [];
	let start = 0;

	do {
		const requestBody = { ...body, start };
		const response = await bitrix24ApiRequest.call(this, method, endpoint, requestBody, qs);
		const result = response.result as IDataObject[];

		if (Array.isArray(result)) {
			allResults.push(...result);
		}

		// Bitrix24 returns 'next' when more pages exist
		if (response.next !== undefined) {
			start = response.next as number;
		} else {
			break;
		}
	} while (true);

	return allResults;
}

// ─── loadOptions helpers ──────────────────────────────────────────────────────

// Returns list of users for "Responsible" dropdowns
export async function getUsers(
	this: ILoadOptionsFunctions,
): Promise<Array<{ name: string; value: string }>> {
	const response = await bitrix24ApiRequest.call(this, 'POST', 'user.get', {
		FILTER: { ACTIVE: true },
	});
	const users = (response.result as IDataObject[]) || [];
	return users.map((u) => ({
		name: `${u.NAME} ${u.LAST_NAME} (${u.EMAIL})`.trim(),
		value: String(u.ID),
	}));
}

// Returns CRM pipelines (categories) for Deal
export async function getDealCategories(
	this: ILoadOptionsFunctions,
): Promise<Array<{ name: string; value: string }>> {
	const response = await bitrix24ApiRequest.call(this, 'POST', 'crm.category.list', {
		entityTypeId: 2, // 2 = Deal
	});
	const items = (response.result?.categories as IDataObject[]) || [];
	return [
		{ name: 'General (Default Pipeline)', value: '0' },
		...items.map((c) => ({
			name: String(c.NAME),
			value: String(c.ID),
		})),
	];
}

// Returns stages for a given pipeline/category
export async function getDealStages(
	this: ILoadOptionsFunctions,
): Promise<Array<{ name: string; value: string }>> {
	const categoryId = this.getCurrentNodeParameter('categoryId') as string ?? '0';
	const endpoint =
		categoryId === '0' ? 'crm.status.list' : 'crm.dealcategory.stages';

	const body: IDataObject =
		categoryId === '0'
			? { filter: { ENTITY_ID: 'DEAL_STAGE' } }
			: { id: categoryId };

	const response = await bitrix24ApiRequest.call(this, 'POST', endpoint, body);
	const items = (response.result as IDataObject[]) || [];

	return items.map((s) => ({
		name: String(s.NAME),
		value: String(s.STATUS_ID ?? s.ID),
	}));
}

// Returns Lead statuses
export async function getLeadStatuses(
	this: ILoadOptionsFunctions,
): Promise<Array<{ name: string; value: string }>> {
	const response = await bitrix24ApiRequest.call(this, 'POST', 'crm.status.list', {
		filter: { ENTITY_ID: 'STATUS' },
	});
	const items = (response.result as IDataObject[]) || [];
	return items.map((s) => ({
		name: String(s.NAME),
		value: String(s.STATUS_ID),
	}));
}

// Returns custom fields (UF_*) for a given CRM entity
// entity: 'deal' | 'lead' | 'contact' | 'company'
export async function getCrmCustomFields(
	this: ILoadOptionsFunctions,
	entity: string,
): Promise<Array<{ name: string; value: string; description?: string }>> {
	const response = await bitrix24ApiRequest.call(
		this,
		'POST',
		`crm.${entity}.fields`,
		{},
	);
	const fields = (response.result as IDataObject) || {};
	const customFields: Array<{ name: string; value: string; description?: string }> = [];

	for (const [key, meta] of Object.entries(fields)) {
		if (key.startsWith('UF_')) {
			const m = meta as IDataObject;
			customFields.push({
				name: String(m.listLabel ?? m.title ?? key),
				value: key,
				description: `Type: ${m.type ?? 'unknown'}`,
			});
		}
	}

	return customFields.sort((a, b) => a.name.localeCompare(b.name));
}

// Returns available open channel lines (imopenlines)
export async function getOpenLines(
	this: ILoadOptionsFunctions,
): Promise<Array<{ name: string; value: string }>> {
	const response = await bitrix24ApiRequest.call(
		this,
		'POST',
		'imopenlines.config.list',
		{},
	);
	const items = (response.result as IDataObject[]) || [];
	return items.map((l) => ({
		name: String(l.LINE_NAME ?? l.NAME ?? `Line ${l.ID}`),
		value: String(l.ID),
	}));
}

// Returns registered chatbots
export async function getChatBots(
	this: ILoadOptionsFunctions,
): Promise<Array<{ name: string; value: string }>> {
	const response = await bitrix24ApiRequest.call(this, 'POST', 'imbot.bot.list', {});
	const items = (response.result as IDataObject[]) || [];
	return items.map((b) => ({
		name: String(b.NAME),
		value: String(b.ID),
	}));
}

// Returns Drive storage list
export async function getDriveStorages(
	this: ILoadOptionsFunctions,
): Promise<Array<{ name: string; value: string }>> {
	const response = await bitrix24ApiRequest.call(
		this,
		'POST',
		'disk.storage.getlist',
		{},
	);
	const items = (response.result as IDataObject[]) || [];
	return items.map((s) => ({
		name: String(s.NAME),
		value: String(s.ID),
	}));
}
