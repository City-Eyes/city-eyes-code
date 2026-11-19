# Decisões registradas

Decisões de fundação já implementadas na `main`. A documentação canônica do produto continua em [city-eyes-docs](https://github.com/City-Eyes/city-eyes-docs).

## B-02: limites aproximados das quatro cidades (#1)

- Fonte: IBGE, Malha Municipal API v4 (`https://servicodados.ibge.gov.br/api/v4/malhas/municipios/<código>?formato=application/vnd.geo+json&qualidade=maxima`), consultada em 18/11/2026.
- Método: bbox derivada do polígono do município devolvido pela API. É aproximação, não fronteira municipal.
- Ordem: `min_lat, min_lng, max_lat, max_lng` (graus decimais, WGS84).

| Cidade | Código IBGE | min_lat | min_lng | max_lat | max_lng |
|---|---|---|---|---|---|
| Curitiba | 4106902 | -25.6454 | -49.3893 | -25.3450 | -49.1844 |
| Londrina | 4113700 | -23.7799 | -51.3213 | -23.1722 | -50.8763 |
| Maringá | 4115200 | -23.5581 | -52.1001 | -23.2540 | -51.8358 |
| Ponta Grossa | 4119905 | -25.3866 | -50.4565 | -24.8921 | -49.6802 |

- Onde está: valores e proveniência (`boundary_source`, `boundary_source_url`, `boundary_retrieved_at`) em `lib/db/scripts/seed.mjs`; colunas em `lib/db/src/schema/cities.ts`.
- Validação: o envio de relato recusa coordenada fora da bbox da cidade escolhida (`artifacts/api-server/src/routes/report-submission.ts`), coberto por "server rejects coordinates outside the selected city's estimated bounds" em `artifacts/api-server/src/routes/urban-flows.test.ts`.
- Sem PostGIS e sem polígonos nesta etapa.

## B-03: provedor de autenticação (#2)

- Escolha: Replit Auth (OIDC, `https://replit.com/oidc`), com PKCE e `nonce`.
- Suporte: app nativo Android e iOS via `expo-auth-session`; o retorno ao app usa o esquema `city-eyes-mobile` e a API só aceita `redirect_uri` de uma lista fixa ("native authorization callback accepts exact allowlist redirect uris only").
- Backend: o app troca o código em `/api/mobile-auth/token-exchange`; a API cria uma sessão no Postgres (`sessions`) e devolve o identificador, usado como Bearer. Navegador e app resolvem a mesma sessão (`artifacts/api-server/src/lib/auth.ts`, `src/routes/auth.ts`, `src/middlewares/authMiddleware.ts`).
- Identidade e papel: o autor do relato vem da sessão, nunca do cliente; papel de operador vem de `city_eyes_city_memberships`.
- Expiração e logout: sessão com `expire` no banco; `/api/mobile-auth/logout` encerra a sessão e o app apaga o token local. Sessão ausente ou inválida devolve 401 e não cria dados ("anonymous sessions cannot upload or submit reports").
- Fallback de demonstração: não existe endpoint de login demo na API. Dados de demonstração são só relatos sintéticos do seed.
- Limitação: o login web (Expo web) não está disponível; o acesso com conta é pelo app móvel.
