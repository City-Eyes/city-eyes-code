# CITY EYES — código

Monorepo do CITY EYES. A aplicação Android/iOS usa Expo; o workspace contém cliente mobile, API TypeScript/Express, contratos compartilhados, design system e protótipos.

## Antes de implementar

- Leia o [contexto e plano de produto](https://github.com/City-Eyes/city-eyes-docs).
- Use o [Project único](https://github.com/orgs/City-Eyes/projects/1) e as labels `repo:code`, `workstream:city-problems`, `workstream:transparency` e `workstream:shared`.
- A direção visual, requisitos e limites estão na documentação canônica; transparência está aprovada no MVP apenas como diretório de links oficiais, sem ingestão ou encaminhamento municipal.

## Estado técnico

- API expõe consulta pública paginada de cidades e relatos por cidade; Drizzle e seed local incluem quatro cidades e relatos sintéticos.
- App Expo local tem seleção de cidade, lista e detalhe; publicação de relatos, autenticação, fila municipal, mapa e diretório de transparência ainda estão pendentes.
- Demonstração de licitações tem cinco registros fictícios e não é fonte municipal. A implementação do diretório ainda precisa de validação individual dos links oficiais.

## Rodar e validar

Requer Node.js 24 e pnpm 10:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/mockup-sandbox test
pnpm --filter @workspace/api-server run dev
```

## Prontidão do banco e alertas

- `/api/healthz` informa se a API está ativa; não testa o banco. `/api/readyz` faz uma consulta simples e retorna `503` quando o PostgreSQL não está acessível.
- A API registra somente a mudança de estado para indisponível e a recuperação, sem incluir mensagens, credenciais ou URLs de conexão. Isso reduz repetição no log, mas só detecta falhas quando o endpoint é consultado.
- O [Monitoring do Replit](https://docs.replit.com/features/publishing/monitoring-a-deployment) não acompanha endpoints personalizados. O [monitoramento do banco](https://docs.replit.com/features/data-and-storage/monitor-your-database) mostra consultas e desempenho; ele não confirma um alerta de indisponibilidade. O alerta de uptime do app publicado cobre quando a aplicação fica fora do ar, não uma falha isolada do banco.
- Para notificação específica de falha do banco, é necessário um monitor externo que consulte `/api/readyz`. Nenhum serviço externo ou destinatário foi configurado; isso depende de aprovação do proprietário.

Não registre secrets no repositório. Consulte [CONTRIBUTING](CONTRIBUTING.md), [AGENTS](AGENTS.md) e [LICENSE](LICENSE).
