# Checklist de go-live

Marque cada item só depois de verificar de fato. Os itens em **negrito** são
bloqueantes.

## Infraestrutura

- [ ] **App instalado na loja de produção** (`/auth?shop=...` concluído sem erro)
- [ ] `GET /health` responde `200` com `"database":"up"` pelo domínio público
- [ ] HTTPS válido (Let's Encrypt) no domínio do app
- [ ] Healthcheck do Coolify apontando para `/health`
- [ ] Deploy automático no push da branch `main` funcionando
- [ ] **`ALLOW_DEV_AUTH` ausente ou `false`** (o app se recusa a subir com
      `NODE_ENV=production` e essa flag ligada — confira mesmo assim)
- [ ] `ENCRYPTION_KEY` e `SESSION_SECRET` gerados com `openssl rand -hex 32`
      e guardados fora do repositório
- [ ] **Backup do banco configurado e restore testado** (`scripts/restore.sh`
      num banco descartável — um backup nunca testado não é um backup)
- [ ] Webhook de alerta de falha configurado em **Configurações**

## Dados

- [ ] **Todas as regiões cadastradas com matchers validados** (nenhum conflito
      de CEP reportado no Passo 1)
- [ ] **Preços de todo o catálogo preenchidos em todas as regiões**
- [ ] **Sync concluído sem erros** — painel de Saúde limpo:
      0 produtos sem preço, 0 preços com erro, 0 jobs falhos
- [ ] Região padrão definida em Configurações
- [ ] **Preço base dos produtos igual ao preço da região padrão** — é o que o
      cliente vê se o JavaScript estiver bloqueado

## Storefront

- [ ] App embed **Precificação Regional** ativado no tema
- [ ] Pop-up aparece no primeiro acesso e **bloqueia a navegação**
- [ ] Pop-up funciona em **mobile e desktop** (teste em ambos, de verdade)
- [ ] **Os preços não "piscam"** ao carregar a página (sem flash do preço base)
- [ ] Se o app estiver fora do ar, os preços aparecem mesmo assim em até 2s
      (teste desligando o container por um minuto)
- [ ] **Seletor de variante nativo oculto na página de produto**
- [ ] Badge da região ativa aparece e permite trocar
- [ ] CEP não atendido exibe "Ainda não entregamos nessa região"
- [ ] Preço regional correto na home, na coleção e na página de produto

## Carrinho e checkout

- [ ] **Troca de região com 3+ itens no carrinho** atualiza todos para as
      variantes corretas **preservando as quantidades**
- [ ] Item indisponível na nova região é removido **com aviso antes**
- [ ] Falha no meio da troca reverte o carrinho e mantém a região anterior
      (teste desligando o app durante a troca)
- [ ] Checkout mostra os preços da região selecionada
- [ ] **Cart attribute `Região` aparece no pedido**

## Assinaturas

- [ ] **Todos os testes de [`loop-commerce.md`](loop-commerce.md) executados**
- [ ] Testes 1 e 2 verdes (primeira cobrança e renovação com o preço da região)
- [ ] Comportamento do Teste 3 documentado e **comunicado ao cliente**

## Pessoas

- [ ] **Operador treinado: sabe que NUNCA edita variantes no admin nativo**
- [ ] Operador sabe usar o wizard, o "copiar preços de outra região" e o painel
      de saúde
- [ ] Operador sabe que excluir uma região afeta assinaturas ativas
- [ ] Alguém sabe onde ficam os backups e como restaurar
