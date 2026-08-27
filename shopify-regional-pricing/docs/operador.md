# Guia do operador

Guia curto para quem gerencia os preços no dia a dia.

---

## A regra mais importante

> **Nunca edite variantes no admin da Shopify.**

Você vai ver, dentro de cada produto, uma opção chamada **Região** com uma
variante para cada região. Isso é encanamento: o Shopify exige que o preço
esteja numa variante, então o app cria essas variantes por você.

Se você editar uma variante à mão, o app e a loja passam a discordar sobre qual
é o preço. Tudo que envolve preço se faz **dentro do app**, em
**Apps → Precificação Regional**.

(Se acontecer, não é o fim do mundo: vá em **Saúde → Reconciliar com a Shopify**
que o app corrige. Mas evite.)

---

## Cadastrar uma região nova

**Regiões → + Cadastrar Região**

**Passo 1 — quem é essa região.** Dê um nome (é o que o cliente vê) e diga como
identificá-la:

- **Faixa de CEP** — de 58400-000 até 58419-999. O jeito mais comum.
- **CEPs específicos** — cole uma lista, um por linha.
- **Cidade/Estado** — quando a região é um município inteiro.

Pode combinar quantos quiser: três faixas de CEP mais uma cidade, por exemplo.

Se um CEP já pertencer a outra região, o app avisa na hora, em vermelho, e não
deixa continuar. Isso é proposital: um CEP em duas regiões deixaria o preço
ambíguo.

**Passo 2 — os preços.** O catálogo inteiro numa tela só. Digite o preço de cada
produto nessa região.

Dois atalhos que economizam muito tempo:

- **Copiar preços de outra região** — traz a tabela inteira de outra região.
- **Aplicar percentual** — no mesmo diálogo: copiar da Região X com **+8%**.
  Use negativo para reduzir.

Produto com o preço **em branco** não é vendido nessa região. Se preferir manter
o preço cadastrado mas esconder o produto, desmarque **Disponível**.

Dá para **Salvar rascunho** e voltar depois — nada foi para a loja ainda.

**Passo 3 — confirmar.** Revise e clique em **Confirmar e sincronizar**. O app
cria as variantes nos produtos. Isso leva alguns minutos num catálogo grande;
você pode fechar a tela, o progresso continua aparecendo no painel.

---

## Mudar preços de uma região que já existe

**Regiões → Editar preços** na linha da região. Cai direto no Passo 2.
Altere o que precisar, avance e confirme.

---

## Produto novo na loja

Não precisa fazer nada imediatamente: o app percebe sozinho e cria as variantes
de todas as regiões, usando o **preço base do produto** como ponto de partida.

Depois, o painel de **Saúde** avisa que ele precisa de preço ajustado. Vá em
cada região e corrija.

---

## Excluir uma região

Cuidado aqui. Excluir uma região:

- remove as variantes daquela região de **todos** os produtos;
- **afeta assinaturas ativas** naquela região — o Loop perde a variante à qual
  a assinatura está ligada.

Por isso o app exige que você digite o nome exato da região para confirmar.

Se a ideia é só parar de vender ali temporariamente, **desative** a região
(Editar região → desmarcar "Região ativa") em vez de excluir. A região some do
pop-up mas as variantes e assinaturas continuam intactas.

---

## Painel de Saúde

Olhe aqui de vez em quando, e sempre antes de uma campanha:

- **Produtos sem preço em alguma região** — o cliente daquela região não
  consegue comprar esses produtos.
- **Sincronizações com falha** — mostra o erro. Normalmente há um botão
  **Reprocessar produtos com erro** que resolve.
- **Reconciliar com a Shopify** — compara o app com a loja e corrige diferenças.
  Use se desconfiar que alguém mexeu em variante à mão.

---

## Configurações

- **Pop-up** — título, subtítulo, e se o cliente escolhe por CEP, cidade, ou os
  dois.
- **Bloquear navegação** — deixe ligado. Sem região escolhida, o cliente veria o
  preço base do produto, que pode não ser o preço dele.
- **Região padrão** — usada quando o CEP não bate com nenhuma região. Se você
  não definir nenhuma, o cliente vê "Ainda não entregamos nessa região".
