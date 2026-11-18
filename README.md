# CITY EYES — código

Monorepo do CITY EYES. A aplicação Android/iOS usa Expo; o workspace contém cliente mobile, API TypeScript/Express, contratos compartilhados, design system e protótipos.

## Antes de implementar

- Leia o [contexto e plano de produto](https://github.com/City-Eyes/city-eyes-docs).
- Use o [Project único](https://github.com/orgs/City-Eyes/projects/1) e as labels `repo:code`, `workstream:city-problems`, `workstream:transparency` e `workstream:shared`.
- A direção visual, requisitos e limites estão na documentação canônica; transparência está aprovada no MVP apenas como diretório de links oficiais, sem ingestão ou encaminhamento municipal.

## Estado técnico

- Esta branch local acrescenta Replit Auth e envio autenticado de relatos com foto e localização revisável. Ainda não está publicada na `main`; a entrega será rastreada por PRs vinculados às issues. A fila municipal será adicionada em uma etapa separada.
- Os uploads usam App Storage. O servidor confirma tipo, assinatura e tamanho do arquivo; fotos vinculadas a relatos são removidas após 30 dias. Imagens, texto e localização ficam públicos depois do consentimento explícito. Metadados da foto não são tratados como prova de autenticidade.
- A autoria é derivada da sessão autenticada, não dos dados enviados pelo cliente.
- As quatro cidades usam caixas geográficas aproximadas derivadas das malhas municipais do IBGE. Elas não substituem limites municipais precisos.
- A frente de transparência, o mapa, a análise de autenticidade e o envio automático de denúncias continuam fora desta entrega.
- Demonstração de licitações tem cinco registros fictícios e não é fonte municipal. A implementação do diretório ainda precisa de validação individual dos links oficiais.

## Rodar e validar

Requer Node.js 24 e pnpm 10:

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/mockup-sandbox test
pnpm --filter @workspace/api-server run dev
```

Os testes da API só rodam com `DATABASE_TEST_URL` apontando para um banco de teste isolado. O comando falha se essa variável estiver ausente; nunca use o banco de desenvolvimento compartilhado para testes. O CI cria um PostgreSQL temporário e separado.

## Prontidão do banco e alertas

- `/api/healthz` informa se a API está ativa; não testa o banco. `/api/readyz` faz uma consulta simples e retorna `503` quando o PostgreSQL não está acessível.
- A API registra somente a mudança de estado para indisponível e a recuperação, sem incluir mensagens, credenciais ou URLs de conexão. Isso reduz repetição no log, mas só detecta falhas quando o endpoint é consultado.
- O [Monitoring do Replit](https://docs.replit.com/features/publishing/monitoring-a-deployment) não acompanha endpoints personalizados. O [monitoramento do banco](https://docs.replit.com/features/data-and-storage/monitor-your-database) mostra consultas e desempenho; ele não confirma um alerta de indisponibilidade. O alerta de uptime do app publicado cobre quando a aplicação fica fora do ar, não uma falha isolada do banco.
- Para notificação específica de falha do banco, é necessário um monitor externo que consulte `/api/readyz`. Nenhum serviço externo ou destinatário foi configurado; isso depende de aprovação do proprietário.

Não registre secrets no repositório. Consulte [CONTRIBUTING](CONTRIBUTING.md), [AGENTS](AGENTS.md) e [LICENSE](LICENSE).
