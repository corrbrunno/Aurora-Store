# P2 — Gestão da Qualidade e Teste de Software · Loja Aurora

**Avaliação P2 — trabalho prático de planejamento, implementação, execução e documentação de testes de software.**

| | |
|---|---|
| Aluno | Bruno Corrêa dos Santos |
| Matrícula | 202322952 |
| Turma | ENG.SOFT 07A — 7º período |
| Disciplina | Gestão da Qualidade e Teste de Software |
| Valor | 10,0 pontos |
| Período de execução | 07/10/2026 a 18/11/2026 |
| Repositório | https://github.com/corrbrunno/Aurora-Store |

**Sistema sob avaliação:** Loja Aurora 1.0.0 — loja virtual didática em Node.js, sem dependências externas, com persistência em arquivo JSON local.

---

## 1. O que tem neste repositório

```
baseline/    Loja Aurora 1.0.0 original, com os 13 defeitos de regra de negócio (é o "antes")
corrigido/   a mesma versão com as 13 correções aplicadas (é o "depois" e o sistema entregue)
tests-ui/    casos de sistema, usabilidade, acessibilidade, compatibilidade e exploratório (Playwright)
carga/       scripts de carga e estresse (k6)
evidencias/  uma pasta por ID de caso, com print, log ou JSON da execução
sondagem/    sonda de comportamento (probe.js) e os logs das duas versões
ferramentas/ script que aplica as correções e o teste de caixa-preta
caderno/     Caderno de Testes em PDF (e o markdown do plano)
package.json, playwright.config.cjs   harness do Playwright
```

`baseline/tests` e `corrigido/tests` têm **os mesmos arquivos de teste**. O código de teste é idêntico nas duas pastas: o que muda é o código sob teste. É isso que permite a comparação antes × depois.

> **Não há dependências npm na loja.** O servidor usa apenas a biblioteca padrão do Node. As dependências do `package.json` da raiz são só do harness de navegador (Playwright e axe-core).

## 2. Requisitos de ambiente

Versões em que a campanha foi executada e medida:

| Item | Versão |
|---|---|
| Node.js | v24.4.0 |
| npm | 10.9.0 |
| Playwright | 1.65.1 |
| Navegadores | Google Chrome 157.0.8103.79 e Firefox 159.0 |
| k6 | v2.4.0 (apenas para carga e estresse) |
| Sistema | Windows 11 Pro, Ryzen 5 2600 (12 threads), 15,9 GB de RAM |

Node 18 ou superior é suficiente para a aplicação.

## 3. Instalar e executar

**Aplicação** (dentro de `corrigido/`, ou `baseline/` para ver os defeitos):

```bash
cd corrigido
npm run reset     # recria data/db.json a partir do dataset didático
npm start         # sobe em http://127.0.0.1:3000
```

Pare o servidor antes de rodar o reset. Se a porta 3000 estiver ocupada: `PORT=3001 npm start` (PowerShell: `$env:PORT=3001; npm start`).

**Harness de navegador** (na raiz do repositório, uma vez):

```bash
npm install
npx playwright install firefox      # o Chrome é o instalado na máquina (channel: chrome)
```

## 4. Rodar os testes

### Unitários — não precisam de servidor

```bash
cd corrigido
node --test tests/unit/regras.test.js
```

### Integração — precisam do servidor no ar

```bash
cd corrigido
node --test --test-concurrency=1 tests/integration/api.test.js
```

### Sistema, usabilidade e acessibilidade — servidor no ar

```bash
npx playwright test funcional.spec.cjs --project=chrome
npx playwright test acessibilidade.spec.cjs --project=chrome
```

### Compatibilidade — mesma tarefa em Chrome e Firefox

```bash
npx playwright test compatibilidade.spec.cjs
```

### Exploratório — sessão cronometrada de 15 minutos

```bash
npx playwright test exploratorio.spec.cjs --project=chrome
```

### Carga e estresse — servidor no ar

```bash
cd carga
k6 run carga.js                                  # 5 VUs por 30 s
k6 run -e VUS=10 carga.js                        # pico previsto
k6 run estresse.js                               # 5 → 15 → 30 → 5 → 0
k6 run -e VUS=60 patamar.js                      # repetir com 100 e 200
```

Os scripts gravam o resumo em JSON pelo `handleSummary`, com p95, média, máximo, vazão, taxa de erro e checks.

## 5. Reproduzir o antes × depois

O `baseline` está intacto, com os defeitos originais — é o que prova que o defeito existia.

```bash
# ANTES
cd baseline
npm run reset && npm start
node --test tests/unit/regras.test.js                            # 4 falhas
node --test --test-concurrency=1 tests/integration/api.test.js    # 5 falhas

# DEPOIS
cd ../corrigido
npm run reset && npm start
node --test tests/unit/regras.test.js                            # 4 aprovados
node --test --test-concurrency=1 tests/integration/api.test.js    # 5 aprovados
```

Cada teste isolado também pode ser rodado por ID, com `--test-name-pattern="CT-U02"`.

## 6. Massa de dados

- `npm run reset` recria a base a partir de `data/dataset_loja_6000.json`: 1.200 produtos (1.159 ativos), 1.200 pedidos e 800 contas.
- Contas de teste, senha `SenhaDidatica123!`: `cliente-a@loja.test`, `cliente-b@loja.test`, `admin@loja.test`.
- Fixtures: `produto-teste` (R$ 150,00, estoque 5); cupons `ANTIGO` (20%, vencido em 06/10/2026), `VINTE` (20%) e `CINCO` (5%).
- Relógio controlável em `src/domain/clock.js` (`setClock` / `resetClock`), com `REFERENCE_INSTANT = 2026-10-07T15:00:00.000Z`.
- Apenas dados fictícios. Nenhum dado pessoal real.

## 7. Escopo: as 10 funcionalidades avaliadas

| ID | Funcionalidade / requisito verificável | Risco |
|---|---|---|
| RF01 | Cadastro com nome, e-mail e senha válidos; a conta passa a autenticar | Médio |
| RF02 | Entrar com credenciais válidas e sair; credencial inválida é recusada | Alto |
| RF03 | Catálogo lista nome, descrição, categoria, preço e estoque dos ativos | Baixo |
| RF04 | Busca restringe o catálogo pelo texto e o filtro por categoria reduz a lista | Médio |
| RF05 | Carrinho inclui item, altera quantidade e remove, recalculando o subtotal | Alto |
| RF06 | Estoque: a venda reduz o saldo e a venda acima do disponível é recusada | Alto |
| RF07 | Cupom aplicado no fechamento; vencido/inativo/inexistente recusado; não acumula | Alto |
| RF08 | Pedido exige endereço completo (rua, número, bairro, cidade, UF, CEP) | Alto |
| RF09 | Cliente autenticado finaliza a compra com subtotal, desconto, frete e total corretos | Alto |
| RF10 | Cliente consulta histórico e detalhe dos próprios pedidos, inclusive após recarregar | Alto |

**Fora do escopo:** RF-11 (área administrativa), que exige perfil admin e não integra a jornada de compra; pagamento real e e-mail (não implementados); concorrência de estoque entre processos (servidor único com base em arquivo); testes invasivos e carga em sistema de terceiros (proibidos pelo enunciado).

Regras de negócio cobertas: RN-01 a RN-06, RN-08, RN-10, RN-12 e RN-13. Requisitos não funcionais: RNF-01 a RNF-09.

## 8. Casos por modalidade

| Modalidade | Mínimo do enunciado | Planejado | IDs |
|---|---|---|---|
| Unitário | 3 automatizados com assertivas | 4 | CT-U01 a CT-U04 |
| Integração | 2 cenários entre componentes, API ou banco | 5 | CT-I01 a CT-I05 |
| Funcional / sistema | 10 casos, ≥1 por funcionalidade, 3 negativos | 10 (4 negativos) | CT-F01 a CT-F10 |
| Caixa-preta | particionamento de equivalência + valor-limite em 2 casos | 2 | CT-B01, CT-B02 |
| Exploratório | 1 sessão de 15 minutos com roteiro e achados | 1 | CT-E01 |
| Confirmação (reteste) | 1 caso após correção, com antes/depois | 1 | CT-CONF01 |
| Regressão | 3 casos sobre o que a correção podia afetar | 3 | CT-R01 a CT-R03 |
| Carga | 1 cenário com carga crescente e métricas | 2 | CT-P01, CT-P02 |
| Estresse | 1 cenário acima da referência, com recuperação | 3 | CT-P03 a CT-P05 |
| Segurança básica | 2 cenários não destrutivos | 2 | CT-S01, CT-S02 |
| Usabilidade / acessibilidade | 1 inspeção com 5 critérios verificáveis | 5 | CT-A01 a CT-A05 |
| Compatibilidade | 2 ambientes distintos | 1 (2 ambientes) | CT-C01 |
| **Total** | — | **39 casos** | — |

Cada caso tem ID único, requisito, modalidade, prioridade, pré-condições, dados de entrada, passos numerados, resultado esperado, resultado obtido, status, data e evidência — a ficha completa está no Caderno de Testes.

## 9. Resultados

Execução final na **1.0.0-corrigida**:

| Indicador | Valor |
|---|---|
| Casos planejados / executados | 39 / 39 |
| Aprovados / reprovados / bloqueados | 35 / 4 / 0 |
| Taxa de aprovação | 89,7% |
| Defeitos encontrados | 19 (crítica 3 · alta 10 · média 5 · baixa 1) |
| Defeitos de regra corrigidos e retestados | 13 |
| Defeitos de interface abertos | 6 |

**Carga e estresse:** p95 de 9,6 ms com 5 usuários virtuais e 12,5 ms com 10; saturação em torno de 300 requisições por segundo entre 100 e 200 VUs (vazão parada, p95 de 156,7 para 486,8 ms); recuperação em 10,0 ms depois do estresse, sem falhas em nenhuma execução.

## 10. Defeitos

| ID | Requisito | Descrição | Situação |
|---|---|---|---|
| BUG-01 | RN-02 | Frete de R$ 18,50 cobrado de R$ 300,00 a R$ 333,33 | Corrigido |
| BUG-02 | RN-01 | Desconto não incide no valor exato de R$ 200,00 | Corrigido |
| BUG-03 | RN-06 | Arredondamento trunca o meio centavo | Corrigido |
| BUG-04 | RN-06 | Total do pedido soma o desconto em vez de subtrair | Corrigido |
| BUG-05 | RN-03 | Quantidade negativa aceita, com total negativo | Corrigido |
| BUG-06 | RN-03 | Venda acima do estoque é aceita | Corrigido |
| BUG-07 | RN-08 | Estoque não é reduzido na finalização | Corrigido |
| BUG-08 | RN-08 | Pedido não persiste e some ao reiniciar | Corrigido |
| BUG-09 | RN-13 | Endereço incompleto aceito (só a rua) | Corrigido |
| BUG-10 | RN-04 | Cupom vencido é aceito no checkout | Corrigido |
| BUG-11 | RN-12 | Preço enviado pelo navegador substitui o do catálogo | Corrigido |
| BUG-12 | RN-10 | Cliente lê o pedido de outro cliente pelo id | Corrigido |
| BUG-13 | RNF-04 | Mensagem de cadastro não diz qual campo está inválido | Corrigido |
| BUG-14 | RNF-01 | Rótulos do cadastro sem associação com os campos | Aberto |
| BUG-15 | RNF-02/03 | Foco do teclado não entra nos cards do catálogo | Aberto |
| BUG-16 | RNF-01..05 | Contraste e filtro de categoria sem nome acessível | Aberto |
| BUG-17 | RNF-05 | Carrinho vazio sem explicação e sem volta ao catálogo | Aberto |
| BUG-18 | RNF-07 | Cada renderização empilha um tratador: 56 chamadas em 5 cliques | Aberto |
| BUG-19 | RN-03 / RNF-05 | Quantidade 0 no carrinho remove a linha e trava a tela | Aberto |

Os seis abertos são de interface e ficam como proposta de melhoria: a correção acordada nesta entrega cobre regras de negócio e mensagens.

## 11. Evidências

Cada pasta em `evidencias/` leva o ID do caso e contém o arquivo que comprova a execução:

| Pasta | Conteúdo |
|---|---|
| `CT-U01` a `CT-U04` | `unit_antes.txt` e `unit_depois.txt` (log do `node --test` com o caso isolado) |
| `CT-I01` a `CT-I05` | `integ_antes.txt` e `integ_depois.txt` |
| `CT-F01` a `CT-F10` | `antes.txt` e `depois.txt` com os trechos da sonda; nos casos de interface (F04 e F05), também `observacao.txt` e prints |
| `CT-B01`, `CT-B02` | `resultado.json` e `observacao.txt` com as três fronteiras cotadas |
| `CT-E01` | `sessao.txt` (20 observações com horário) e prints por área |
| `CT-A01` a `CT-A05` | observação, prints e `axes.json` (violações do axe) |
| `CT-C01` | `compat-chrome.json`, `compat-firefox.json` e prints |
| `CT-P01` a `CT-P05` | `k6.txt` e os JSON de resultado de cada execução |
| `CT-S01`, `CT-S02` | log da sonda com o antes e o depois da autorização e do preço |
| `CT-CONF01`, `CT-R01` a `CT-R03` | log da reexecução depois das correções |

Os prints são nomeados pelo ID do caso. Nenhum resultado foi digitado à mão: todos saem do log da execução.

## 12. Caderno de Testes

`caderno/Caderno_Testes_P2_Bruno_Correa_202322952.pdf` — 29 páginas, com identificação, inventário, ambiente, plano e critérios, matriz de rastreabilidade, as 39 fichas de caso, os 19 registros de defeito, o relatório de carga, os checklists, a confirmação/regressão, os indicadores, a conclusão e dois anexos: as capturas de evidência identificadas por caso (Anexo A) e o roteiro da demonstração prática (Anexo B).

O caderno segue o modelo do professor, com os quadros duplicados por caso e por defeito.

## 13. Demonstração prática (roteiro de 6 minutos)

1. **Mostrar o defeito ainda vivo** (1 min) — subir o `baseline` e, no carrinho, fechar uma compra de 2 × R$ 150,00: o total sai R$ 318,50 em vez de R$ 270,00, e o estoque não muda.
2. **Rodar o teste que pega isso** (1 min) — `node --test tests/unit/regras.test.js` e `tests/integration/api.test.js` no `baseline`: 4 e 5 falhas, com a mensagem de cada asserção.
3. **Mostrar a correção** (2 min) — abrir os arquivos alterados (`shipping.js`, `discount.js`, `orderTotals.js`, `checkout.js`, `database.js`, `coupon.js`, `address.js`, `quantity.js`, `money.js`, `api.js`) e explicar em uma frase o que cada um fazia de errado.
4. **Repetir a mesma compra** (1 min) — no `corrigido`: total R$ 270,00, frete zero, estoque 5 → 3, pedido consultável depois de reiniciar.
5. **Ver o desempenho** (1 min) — mostrar o resumo do k6: p95 9,6 ms na carga de referência e a saturação em ~300 req/s no patamar de 200.

## 14. Entregáveis do enunciado

| # | Entregável | Onde está |
|---|---|---|
| 1 | Caderno de Testes preenchido em PDF | `caderno/Caderno_Testes_P2_Bruno_Correa_202322952.pdf` |
| 2 | Código-fonte do sistema e scripts de teste | `baseline/`, `corrigido/`, `tests-ui/`, `carga/` e `tests/` dentro das duas versões |
| 3 | Pasta de evidências organizada por ID | `evidencias/` (101 arquivos em 39 pastas, uma por caso) |
| 4 | README com comandos de instalar, executar e testar | este arquivo |
| 5 | Demonstração prática de execução e interpretação | roteiro na seção 13 e leitura dos números na seção 9 |

## 15. Limitações e riscos remanescentes

- **Carga medida em máquina única**, com gerador e servidor no mesmo host e por loopback: os valores absolutos não representam capacidade de produção.
- **Sem teste de concorrência de estoque** entre processos: o servidor é um processo único com base em arquivo.
- `GET /api/products` devolve o catálogo inteiro (~306 KB) e **não filtra** por busca ou categoria no servidor; o filtro é feito no navegador.
- Os **seis defeitos de interface** seguem abertos (seção 10). O de maior impacto é o BUG-19: digitar quantidade 0 deixa o carrinho inutilizável até adicionar o produto novamente.
- A acessibilidade foi avaliada com axe-core e inspeção manual de teclado; **aprovação automatizada não certifica acessibilidade completa**.

## 16. Método e honestidade dos dados

- Nenhum resultado foi inventado: o "antes" e o "depois" saem do mesmo roteiro executado nas duas versões, com log preservado em `sondagem/` e `evidencias/`.
- Falha encontrada foi registrada com passos, esperado, obtido e impacto — inclusive as que não foram corrigidas.
- Os testes de carga rodaram só em ambiente local, com dados fictícios, sem sistema de terceiros e sem ataque invasivo.
- Os casos negativos aparecem antes dos positivos na ordem de execução, porque erro de validação explica a falha dos demais.
