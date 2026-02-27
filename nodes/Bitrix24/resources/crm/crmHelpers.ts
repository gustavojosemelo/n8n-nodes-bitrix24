import { INodeProperties, IDataObject } from 'n8n-workflow';

// ─── Phone/Email multi-value fixedCollection ──────────────────────────────────

const phoneTypeOptions = [
	{ name: 'Trabalho', value: 'WORK' },
	{ name: 'Celular', value: 'MOBILE' },
	{ name: 'Residencial', value: 'HOME' },
	{ name: 'Fax', value: 'FAX' },
	{ name: 'Pager', value: 'PAGER' },
	{ name: 'Outro', value: 'OTHER' },
];

const emailTypeOptions = [
	{ name: 'Trabalho', value: 'WORK' },
	{ name: 'Pessoal', value: 'HOME' },
	{ name: 'Outro', value: 'OTHER' },
];

export function makePhoneField(resource: string): INodeProperties {
	return {
		displayName: 'Telefones',
		name: 'phones',
		type: 'fixedCollection',
		placeholder: 'Adicionar Telefone',
		default: {},
		typeOptions: { multipleValues: true },
		displayOptions: { show: { resource: [resource], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Telefone',
				name: 'phone',
				values: [
					{
						displayName: 'Número',
						name: 'VALUE',
						type: 'string',
						default: '',
						placeholder: '(11) 99999-9999',
					},
					{
						displayName: 'Tipo',
						name: 'VALUE_TYPE',
						type: 'options',
						options: phoneTypeOptions,
						default: 'WORK',
					},
				],
			},
		],
	};
}

export function makeEmailField(resource: string): INodeProperties {
	return {
		displayName: 'E-mails',
		name: 'emails',
		type: 'fixedCollection',
		placeholder: 'Adicionar E-mail',
		default: {},
		typeOptions: { multipleValues: true },
		displayOptions: { show: { resource: [resource], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'E-mail',
				name: 'email',
				values: [
					{
						displayName: 'Endereço',
						name: 'VALUE',
						type: 'string',
						default: '',
						placeholder: 'email@exemplo.com',
					},
					{
						displayName: 'Tipo',
						name: 'VALUE_TYPE',
						type: 'options',
						options: emailTypeOptions,
						default: 'WORK',
					},
				],
			},
		],
	};
}

// ─── UF_ Custom Fields — typed inputs ─────────────────────────────────────────

export function makeCustomFieldsSection(resource: string, loadMethod: string): INodeProperties {
	return {
		displayName: 'Campos Personalizados (UF_)',
		name: 'customFields',
		type: 'fixedCollection',
		placeholder: 'Adicionar Campo Personalizado',
		default: {},
		typeOptions: { multipleValues: true },
		displayOptions: { show: { resource: [resource], operation: ['create', 'update'] } },
		options: [
			{
				displayName: 'Campo',
				name: 'field',
				values: [
					{
						displayName: 'Campo',
						name: 'fieldName',
						type: 'options',
						typeOptions: { loadOptionsMethod: loadMethod },
						default: '',
						description: 'Selecione o campo UF_*',
					},
					// String / text / url / email / phone type
					{
						displayName: 'Valor (texto)',
						name: 'valueString',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								// shown when field encodes |string
								fieldName: ['__string__'], // fallback — always shown when others hidden
							},
						},
					},
					// Number type
					{
						displayName: 'Valor (número)',
						name: 'valueNumber',
						type: 'number',
						default: 0,
						displayOptions: {
							show: {
								fieldName: ['__number__'],
							},
						},
					},
					// Boolean type
					{
						displayName: 'Valor (sim/não)',
						name: 'valueBoolean',
						type: 'boolean',
						default: false,
						displayOptions: {
							show: {
								fieldName: ['__boolean__'],
							},
						},
					},
					// Date type
					{
						displayName: 'Valor (data)',
						name: 'valueDate',
						type: 'dateTime',
						default: '',
						displayOptions: {
							show: {
								fieldName: ['__date__'],
							},
						},
					},
					// Generic fallback always visible
					{
						displayName: 'Valor',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Valor do campo. Para boolean use "1" (sim) ou "0" (não). Para data use YYYY-MM-DD.',
					},
				],
			},
		],
	};
}

// ─── Execute helpers ──────────────────────────────────────────────────────────

/**
 * Process phone fixedCollection into Bitrix24 multi-field format
 */
export function processPhones(phonesRaw: IDataObject): Array<{ VALUE: string; VALUE_TYPE: string }> | undefined {
	const arr = (phonesRaw.phone as IDataObject[]) || [];
	if (arr.length === 0) return undefined;
	return arr.map((p) => ({
		VALUE: String(p.VALUE ?? ''),
		VALUE_TYPE: String(p.VALUE_TYPE ?? 'WORK'),
	}));
}

/**
 * Process email fixedCollection into Bitrix24 multi-field format
 */
export function processEmails(emailsRaw: IDataObject): Array<{ VALUE: string; VALUE_TYPE: string }> | undefined {
	const arr = (emailsRaw.email as IDataObject[]) || [];
	if (arr.length === 0) return undefined;
	return arr.map((e) => ({
		VALUE: String(e.VALUE ?? ''),
		VALUE_TYPE: String(e.VALUE_TYPE ?? 'WORK'),
	}));
}

/**
 * Process UF_ custom fields fixedCollection.
 * Value encoded as "FIELD_NAME|type" — decode and pick the right value input.
 */
export function processCustomFields(customFieldsRaw: IDataObject): IDataObject {
	const arr = (customFieldsRaw.field as IDataObject[]) || [];
	const result: IDataObject = {};

	for (const item of arr) {
		const encoded = String(item.fieldName ?? '');
		if (!encoded) continue;

		// Decode "UF_CRM_FIELD|boolean" → fieldKey = "UF_CRM_FIELD", type = "boolean"
		const pipeIdx = encoded.lastIndexOf('|');
		const fieldKey = pipeIdx >= 0 ? encoded.substring(0, pipeIdx) : encoded;
		const fieldType = pipeIdx >= 0 ? encoded.substring(pipeIdx + 1) : 'string';

		// Pick value based on type — fall back to generic 'value' string
		let val: unknown;
		if (fieldType === 'boolean') {
			val = item.valueBoolean !== undefined ? (item.valueBoolean ? '1' : '0') : item.value;
		} else if (fieldType === 'number') {
			val = item.valueNumber !== undefined ? item.valueNumber : item.value;
		} else if (fieldType === 'date' || fieldType === 'datetime') {
			val = item.valueDate !== undefined && item.valueDate !== '' ? item.valueDate : item.value;
		} else {
			// string / options / fallback
			val = item.valueString !== undefined && item.valueString !== '' ? item.valueString : item.value;
		}

		if (fieldKey) result[fieldKey] = val as IDataObject;
	}

	return result;
}
