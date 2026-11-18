# CITY EYES — código

Monorepo de código do CITY EYES. O app Android/iOS planejado usa Expo; o workspace atual contém API TypeScript/Express, contratos compartilhados, design system e protótipos web.

## Antes de implementar

- Leia o [contexto e plano de produto](https://github.com/City-Eyes/city-eyes-docs).
- Use o [Project único](https://github.com/orgs/City-Eyes/projects/1) e as labels `repo:code`, `workstream:city-problems`, `workstream:transparency` e `workstream:shared`.
- A direção visual, requisitos e limites estão na documentação canônica; transparência permanece proposta até aprovação do recorte.

## Estado técnico

- API atual: rota de health check; schema Drizzle ainda sem tabelas do produto.
- App Expo ainda não scaffoldado; protótipos não enviam dados nem autenticam.
- Demonstração de licitações tem cinco registros fictícios e não é fonte municipal.

## Rodar e validar

Requer Node.js 24 e pnpm 10:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/mockup-sandbox test
pnpm --filter @workspace/api-server run dev
```

Não registre secrets no repositório. Consulte [CONTRIBUTING](CONTRIBUTING.md), [AGENTS](AGENTS.md) e [LICENSE](LICENSE).
