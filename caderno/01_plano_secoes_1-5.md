# Caderno de Testes — Loja Aurora
## P2 — Gestão da Qualidade e Teste de Software

> Etapa 1 de 5: seções 1 a 5 do modelo (identificação, inventário, ambiente, plano/critérios e matriz de rastreabilidade).
> Status de execução e evidências entram nas seções 6 a 12 depois da campanha.

---

## 1. Identificação do projeto

| Campo | Preenchimento |
|---|---|
| Sistema / versão | Loja Aurora 1.0.0 — loja virtual didática (Node.js sem dependências, dados em JSON local). Campanha executada sobre a versão original e sobre a versão corrigida (`1.0.0-corrigida`) |
| Equipe / turma | Bruno Corrêa dos Santos — matrícula 202322952 — ENG.SOFT 07A, 7º período (trabalho individual) |
| Repositório | Pasta local `alunos` + pacote `.zip` entregue junto deste caderno. Não há git no projeto, então não existe commit para citar |
| Período de execução | 07/10/2026 a 18/11/2026 |
| Responsável pelos testes | Bruno Corrêa dos Santos |

---

## 2. Escopo e inventário de funcionalidades

Dez funcionalidades do `REQUISITOS.md` do projeto. A **RF-11 (área administrativa)** fica fora desta campanha: exige perfil `admin`, não faz parte da jornada de compra e já é coberta pela RN-11 no código.

Critério de risco: **alto** = mexe em dinheiro, estoque ou impede a compra; **médio** = afeta confiança ou uso; **baixo** = leitura sem efeito colateral.

| ID | Funcionalidade / requisito verificável | Pré-condições | Risco |
|---|---|---|---|
| RF01 | Uma pessoa se cadastra com nome, e-mail e senha válidos e a conta passa a autenticar | Base resetada; e-mail não cadastrado | Médio |
| RF02 | Pessoa cadastrada entra com credenciais válidas e sai da conta; credencial inválida é recusada | Conta `cliente-a@loja.test` existente | Alto |
| RF03 | O catálogo público lista nome, descrição, categoria, preço e estoque dos produtos ativos | Base resetada; servidor no ar | Baixo |
| RF04 | A busca restringe o catálogo pelo texto e o filtro de categoria reduz a lista | Catálogo carregado com 1.159 produtos ativos | Médio |
| RF05 | O carrinho inclui item, altera quantidade e remove item, recalculando o subtotal | Sessão autenticada | Alto |
| RF06 | O estoque de cada produto é controlado: venda reduz, venda acima do disponível é recusada | `produto-teste` com estoque 5 | Alto |
| RF07 | O cupom é aplicado no fechamento; vencido, inativo ou inexistente é recusado; não acumula com o desconto automático | Cupons `ANTIGO`, `VINTE`, `CINCO`; relógio fixo controlável | Alto |
| RF08 | O pedido exige endereço completo (rua, número, bairro, cidade, UF e CEP) | Sessão autenticada; carrinho com item | Alto |
| RF09 | O cliente autenticado finaliza a compra e o pedido é gravado com subtotal, desconto, frete e total corretos | Sessão autenticada; endereço completo | Alto |
| RF10 | O cliente consulta o histórico e o detalhe dos próprios pedidos, inclusive depois de recarregar | Sessão autenticada; pedido criado na mesma base | Alto |

**Regras de negócio cobertas:** RN-01 (desconto de 10% a partir de R$ 200,00), RN-02 (frete R$ 18,50 e grátis a partir de R$ 300,00, antes do desconto), RN-03 (quantidade inteira, positiva, até o estoque), RN-04 (validade do cupom até o fim do dia), RN-05 (cupom não acumula), RN-06 (arredondamento half-up), RN-08 (estoque e persistência), RN-10 (cada cliente vê só os próprios pedidos), RN-12 (preço validado no servidor), RN-13 (endereço completo).
**Requisitos não funcionais cobertos:** RNF-01 a RNF-09, nas modalidades de usabilidade/acessibilidade, desempenho e segurança.

---

## 3. Ambiente e massa de dados

| Item | Descrição |
|---|---|
| Aplicação / URL local | Loja Aurora em `http://127.0.0.1:3000` (servidor `node server.js`) |
| Sistema operacional / navegador | Windows 11 Pro (10.0.26300) — AMD Ryzen 5 2600 (6 núcleos, 12 threads), 15,9 GB de RAM. Google Chrome 157.0.8103.79 como navegador principal; Mozilla Firefox 159.0 para o teste de compatibilidade |
| Linguagem / framework / banco | JavaScript (CommonJS), Node.js v24.4.0, npm 10.9.0. Servidor HTTP nativo sem dependências externas; persistência em `data/db.json` gerado a partir de `data/dataset_loja_6000.json` |
| Ferramentas de teste e versões | `node:test` (runner nativo, Node v24.4.0) para unitário e integração; Playwright 1.65.1 com `@axe-core/playwright` para sistema, usabilidade e compatibilidade; k6 v2.4.0 para carga e estresse |
| Dados fictícios de teste | Massa do `npm run reset`: 1.200 produtos (1.159 ativos), 1.200 pedidos e 800 contas. Fixtures do README: `produto-teste` R$ 150,00 com estoque 5; contas `cliente-a@loja.test`, `cliente-b@loja.test` e `admin@loja.test` (senha `SenhaDidatica123!`); cupons `ANTIGO` (20%, vencido em 06/10/2026), `VINTE` (20%) e `CINCO` (5%). Nenhum dado pessoal real |
| Restrições e permissões | Tudo em ambiente local, sem rede externa e sem sistema de terceiros. Carga limitada ao próprio host. Testes de segurança não destrutivos, sem ataque invasivo. A base é reiniciada com o servidor parado antes de cada bateria |

**Máquina de teste:** gerador e servidor no mesmo host, por loopback. Os números absolutos de carga medem este equipamento, não a capacidade de produção.

---

## 4. Plano de testes e critérios

**Objetivo:** verificar se a Loja Aurora cumpre os requisitos funcionais RF-01 a RF-10 e os não funcionais RNF-01 a RNF-09 em uso real, e demonstrar por execução quais defeitos existem, se foram corrigidos e se a correção não quebrou o que funcionava.

**Escopo:** cadastro, autenticação, catálogo, busca e filtro, carrinho, estoque, cupom, endereço, finalização e histórico de pedidos — pela API HTTP e pela interface no navegador.

**Fora do escopo (justificado):** área administrativa (RF-11, exige perfil admin e não integra a jornada de compra); pagamento real e e-mail (não implementados no projeto); concorrência de estoque entre processos (o servidor é um único processo com base em arquivo); teste de invasão, injeção destrutiva e carga em sistema de terceiros (proibidos pelo enunciado).

**Critérios de entrada:** `npm run reset` executado com o servidor parado e servidor no ar respondendo HTTP 200 em `/api/products`; contas e fixtures do README disponíveis; versões da tabela da seção 3 registradas.

**Critérios de saída:** nenhum dos 10 requisitos sem caso funcional; todas as 12 modalidades com o mínimo do enunciado executado; cada caso com status (aprovado/reprovado/bloqueado), data e evidência identificada pelo ID; defeitos classificados por severidade; métricas de carga e estresse registradas (p95, vazão, erros); conclusão técnica fundamentada no que foi medido.

**Priorização (baseada em risco):** primeiro os requisitos de risco alto (RF02, RF05 a RF10), porque um erro ali cobra dinheiro errado, vende o que não existe ou perde o pedido; depois os de risco médio (RF01, RF04), que afetam confiança e uso; por último o de risco baixo (RF03). Dentro de cada requisito, os casos negativos rodam antes dos positivos: erro de validação aparece antes e explica a falha dos demais.

### 4.1 Plano por modalidade

| Modalidade | Mínimo do enunciado | Planejado | IDs |
|---|---|---|---|
| Unitário | 3 automatizados com assertivas | 4 | CT-U01 a CT-U04 |
| Integração | 2 cenários entre componentes/API/banco | 5 | CT-I01 a CT-I05 |
| Funcional / sistema | 10 casos, ≥1 por funcionalidade, 3 negativos | 10 (4 negativos) | CT-F01 a CT-F10 |
| Caixa-preta | particionamento de equivalência + valor-limite em 2 casos | 2 | CT-B01, CT-B02 |
| Exploratório | 1 sessão de 15 min com roteiro e achados | 1 | CT-E01 |
| Confirmação (reteste) | 1 caso após correção, antes/depois | 1 | CT-CONF01 |
| Regressão | 3 casos sobre o que a correção podia afetar | 3 | CT-R01 a CT-R03 |
| Carga | 1 cenário com carga crescente e métricas | 2 | CT-P01, CT-P02 |
| Estresse | 1 cenário acima da referência, com recuperação | 3 | CT-P03 a CT-P05 |
| Segurança básica | 2 cenários não destrutivos | 2 | CT-S01, CT-S02 |
| Usabilidade / acessibilidade | 1 inspeção com 5 critérios verificáveis | 5 | CT-A01 a CT-A05 |
| Compatibilidade | 2 ambientes distintos | 1 (2 ambientes) | CT-C01 |
| **Total** | — | **39 casos** | — |

---

## 5. Matriz de rastreabilidade

Nenhum dos 10 requisitos fica sem cobertura funcional. A coluna de situação é fechada na seção 11, depois da execução.

| Requisito | Casos associados | Situação |
|---|---|---|
| RF01 | CT-F01, CT-A01, CT-A02 | Coberto |
| RF02 | CT-F02, CT-S01, CT-I01 | Coberto |
| RF03 | CT-F03, CT-B01 | Coberto |
| RF04 | CT-F04, CT-P01, CT-A03, CT-C01 | Coberto |
| RF05 | CT-F05, CT-U02, CT-U03, CT-A05 | Coberto |
| RF06 | CT-F06, CT-I02, CT-U04 | Coberto |
| RF07 | CT-F07, CT-U01, CT-CONF01, CT-R01 | Coberto |
| RF08 | CT-F08, CT-I03 | Coberto |
| RF09 | CT-F09, CT-I04, CT-R02, CT-E01 | Coberto |
| RF10 | CT-F10, CT-I05, CT-S01, CT-R03, CT-B02 | Coberto |

**Cobertura de casos negativos:** CT-F01 (cadastro com dados inválidos), CT-F06 (compra acima do estoque), CT-F07 (cupom vencido), CT-F08 (endereço incompleto) — quatro casos, contra o mínimo de três.
