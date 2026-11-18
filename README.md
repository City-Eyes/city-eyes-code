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

Não registre secrets no repositório. Consulte [CONTRIBUTING](CONTRIBUTING.md), [AGENTS](AGENTS.md) e [LICENSE](LICENSE).
