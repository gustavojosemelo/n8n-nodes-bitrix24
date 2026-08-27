import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineStack,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import { useState } from 'react';
import { maskCep, onlyDigits } from '../../lib/format';
import type { Matcher, MatcherConflict, MatcherType } from '../../lib/types';

const TYPE_OPTIONS = [
  { label: 'Faixa de CEP', value: 'cep_range' },
  { label: 'CEPs específicos', value: 'cep_exact' },
  { label: 'Cidade/Estado', value: 'city' },
];

const UF = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

/**
 * Passo 1 - cadastro da regiao e das formas de identifica-la.
 * Uma regiao pode combinar varios matchers (3 faixas de CEP + 1 cidade, por ex).
 */
export function StepRegion({
  name,
  setName,
  isActive,
  setIsActive,
  matchers,
  setMatchers,
  conflicts,
  saving,
  onNext,
  onCancel,
}: {
  name: string;
  setName: (v: string) => void;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
  matchers: Matcher[];
  setMatchers: (v: Matcher[]) => void;
  conflicts: MatcherConflict[];
  saving: boolean;
  onNext: () => void;
  onCancel: () => void;
}) {
  const [bulkCeps, setBulkCeps] = useState('');

  function update(index: number, patch: Partial<Matcher>) {
    setMatchers(matchers.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function remove(index: number) {
    setMatchers(matchers.filter((_, i) => i !== index));
  }

  function add(type: MatcherType) {
    setMatchers([...matchers, { type, cepStart: '', cepEnd: '', city: '', state: '' }]);
  }

  /** "CEPs específicos": um por linha vira um matcher cep_exact. */
  function addBulk() {
    const added = bulkCeps
      .split(/[\n,;]/)
      .map((line) => onlyDigits(line))
      .filter((digits) => digits.length === 8)
      .map<Matcher>((digits) => ({ type: 'cep_exact', cepStart: digits }));

    if (added.length > 0) {
      setMatchers([...matchers, ...added]);
      setBulkCeps('');
    }
  }

  const canContinue = name.trim().length > 0 && matchers.length > 0 && conflicts.length === 0;

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">
            Passo 1 — Cadastrar região
          </Text>

          <TextField
            label="Nome da região"
            value={name}
            onChange={setName}
            autoComplete="off"
            requiredIndicator
            helpText="Aparece para o cliente no seletor de região da loja."
            placeholder="Ex.: Campina Grande - Centro"
          />

          <Checkbox
            label="Região ativa"
            checked={isActive}
            onChange={setIsActive}
            helpText="Regiões inativas não aparecem no pop-up do storefront."
          />
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingSm">
              Como identificar essa região
            </Text>
            <InlineStack gap="200">
              <Button onClick={() => add('cep_range')}>+ Faixa de CEP</Button>
              <Button onClick={() => add('cep_exact')}>+ CEP específico</Button>
              <Button onClick={() => add('city')}>+ Cidade</Button>
            </InlineStack>
          </InlineStack>

          {matchers.length === 0 && (
            <Text as="p" tone="subdued">
              Adicione ao menos uma forma de identificar a região.
            </Text>
          )}

          {matchers.map((matcher, index) => (
            <Card key={index} background="bg-surface-secondary">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Select
                    label="Tipo"
                    labelHidden
                    options={TYPE_OPTIONS}
                    value={matcher.type}
                    onChange={(value) => update(index, { type: value as MatcherType })}
                  />
                  <Button variant="plain" tone="critical" onClick={() => remove(index)}>
                    Remover
                  </Button>
                </InlineStack>

                {matcher.type === 'cep_range' && (
                  <InlineStack gap="300">
                    <TextField
                      label="De"
                      value={maskCep(matcher.cepStart ?? '')}
                      onChange={(v) => update(index, { cepStart: onlyDigits(v) })}
                      autoComplete="off"
                      placeholder="58400-000"
                    />
                    <TextField
                      label="Até"
                      value={maskCep(matcher.cepEnd ?? '')}
                      onChange={(v) => update(index, { cepEnd: onlyDigits(v) })}
                      autoComplete="off"
                      placeholder="58419-999"
                    />
                  </InlineStack>
                )}

                {matcher.type === 'cep_exact' && (
                  <TextField
                    label="CEP"
                    value={maskCep(matcher.cepStart ?? '')}
                    onChange={(v) => update(index, { cepStart: onlyDigits(v) })}
                    autoComplete="off"
                    placeholder="58400-123"
                  />
                )}

                {matcher.type === 'city' && (
                  <InlineStack gap="300">
                    <TextField
                      label="Cidade"
                      value={matcher.city ?? ''}
                      onChange={(v) => update(index, { city: v })}
                      autoComplete="off"
                      placeholder="Lagoa Seca"
                    />
                    <Select
                      label="Estado"
                      options={[{ label: '—', value: '' }, ...UF.map((uf) => ({ label: uf, value: uf }))]}
                      value={matcher.state ?? ''}
                      onChange={(v) => update(index, { state: v })}
                    />
                  </InlineStack>
                )}
              </BlockStack>
            </Card>
          ))}

          <BlockStack gap="200">
            <TextField
              label="Colar vários CEPs (um por linha)"
              value={bulkCeps}
              onChange={setBulkCeps}
              multiline={3}
              autoComplete="off"
              helpText="Cada CEP válido vira um identificador da região."
            />
            <InlineStack>
              <Button onClick={addBulk} disabled={bulkCeps.trim().length === 0}>
                Adicionar CEPs da lista
              </Button>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>

      {conflicts.length > 0 && (
        <Banner tone="critical" title="Conflito com outra região">
          <BlockStack gap="150">
            {conflicts.slice(0, 8).map((conflict, i) => (
              <Text as="p" key={i}>
                {conflict.message}
              </Text>
            ))}
            <Text as="p" tone="subdued">
              Um mesmo CEP não pode pertencer a duas regiões: o preço ficaria ambíguo.
            </Text>
          </BlockStack>
        </Banner>
      )}

      {conflicts.length === 0 && matchers.length > 0 && (
        <InlineStack>
          <Badge tone="success">Sem conflito de CEP com as regiões já cadastradas</Badge>
        </InlineStack>
      )}

      <InlineStack align="end" gap="200">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" disabled={!canContinue} loading={saving} onClick={onNext}>
          Próximo → Editar preços
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
