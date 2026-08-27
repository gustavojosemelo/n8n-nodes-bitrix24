# Validação do Loop Commerce (Etapa 8)

O Loop opera sobre selling plan groups nativos da Shopify, então a integração
**deve** funcionar sem código específico. Mas isso é uma hipótese, não um fato:
os testes abaixo são obrigatórios antes do go-live, e o resultado de cada um
precisa ser anotado aqui.

O app já cobre o cenário em que o Loop associa o plano **por variante**: quando
`Configurações → Associar os selling plans do produto às variantes regionais`
está ligado (padrão), toda variante regional recém-criada é adicionada aos
selling plan groups do produto via `sellingPlanGroupAddProductVariants`.

Se o Loop associar o plano ao **produto inteiro**, essa etapa é inofensiva
(a chamada é idempotente) e pode ser desligada.

---

## Preparação

- Loja de desenvolvimento (ou a de produção fora do horário de pico)
- Loop instalado e com ao menos um selling plan configurado
- Duas regiões cadastradas e sincronizadas, com preços diferentes:
  - **Região A** — ex.: Campina Grande - Centro, Galão 20L a R$ 12,90
  - **Região B** — ex.: Lagoa Seca, Galão 20L a R$ 15,50
- Um produto que exista na Região A mas **não** na Região B (preço em branco)

---

## Teste 1 — Primeira cobrança usa o preço da região

1. No storefront, escolha a **Região A** no pop-up.
2. Verifique que o Galão 20L exibe **R$ 12,90**.
3. Assine o produto (selling plan do Loop) e finalize a compra.
4. No admin da Shopify, abra o pedido.

**Esperado:** o pedido mostra a variante `Região = Campina Grande - Centro`, o
valor de R$ 12,90 e o cart attribute `Região: Campina Grande - Centro`.

- [ ] Passou · Resultado observado: ______________________

---

## Teste 2 — Renovação usa o mesmo preço da região

1. No Loop, force uma renovação da assinatura criada no Teste 1
   (*Subscriptions → a assinatura → Bill now* ou equivalente).
2. Confira o pedido de renovação gerado.

**Esperado:** R$ 12,90 novamente, na mesma variante regional.

Este é o teste que justifica toda a decisão de arquitetura. Se falhar, a
premissa de "variante carrega o preço na recorrência" está errada e é preciso
reavaliar antes de seguir.

- [ ] Passou · Resultado observado: ______________________

---

## Teste 3 — Alterar o preço da região com assinatura ativa

1. No app: **Regiões → Editar preços** da Região A → Galão 20L para **R$ 13,90**
   → Confirmar e sincronizar.
2. Aguarde o sync terminar.
3. Force outra renovação da assinatura do Teste 1.

**O que observar:** o Loop pode **congelar o preço original** (a assinatura
continua a R$ 12,90) ou **seguir o preço atual da variante** (passa a R$ 13,90).
Os dois comportamentos são defensáveis; o que não pode é o cliente descobrir
qual é na hora da cobrança.

- [ ] Comportamento observado: ( ) congela o preço original ( ) segue o preço novo
- [ ] **Comunicado ao cliente e documentado aqui:** ______________________

> Este é o item da tabela de riscos "Loop congela preço antigo em assinaturas".
> Documentar o comportamento **é** a mitigação.

---

## Teste 4 — Produto que não existe na Região B

1. No storefront, troque para a **Região B**.
2. Localize o produto que não tem preço na Região B.

**Esperado:** o produto não exibe preço regional e o botão de compra fica
desabilitado. Se ele já estivesse no carrinho, a troca de região avisa que o
item será removido (ver Etapa 7).

3. Tente assinar esse produto na Região B.

**Esperado:** não é possível.

- [ ] Passou · Resultado observado: ______________________

---

## Teste 5 — Selling plan associado a todas as variantes regionais

1. No admin da Shopify, abra um produto que tenha selling plan do Loop.
2. Confira, variante por variante, se o plano de assinatura aparece em todas as
   regiões — não só na variante base.

**Se faltar em alguma:** confirme que `Associar os selling plans do produto às
variantes regionais` está ligado nas Configurações do app e rode
**Saúde → Reconciliar com a Shopify**, ou reenvie o sync da região.

- [ ] Passou · Resultado observado: ______________________

---

## Critério de aceite

> Assinatura criada em uma região renova com o preço correto daquela região.

Os testes 1 e 2 são bloqueantes: sem os dois verdes, não vai para produção.
