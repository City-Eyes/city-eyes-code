# Contribuir com CITY EYES

## Antes de começar

- Consulte a issue, suas dependências e critérios de aceite no [Project único](https://github.com/orgs/City-Eyes/projects/1).
- Leia a documentação canônica em [city-eyes-docs](https://github.com/City-Eyes/city-eyes-docs).
- Não implemente propostas como decisões aprovadas. Relatos, imagens e dados de demonstração devem permanecer identificados como sintéticos.
- Não publique credenciais, dados pessoais, memória de agentes, anexos ou exportações municipais não revisadas.

## Branch, commit e PR

1. Use a issue para criar uma branch `N-descricao`, a partir de `main`.
2. Commits e título de PR seguem `tipo(escopo): resumo`. Todo commit tem linha em branco e corpo explicando **por que** a mudança é necessária. Em documentos, o escopo é o assunto.
3. Abra PR com `Closes #N` para uma issue deste repositório, ou referência completa para o outro repositório. Use `sem-issue` somente para exceção explícita.
4. Aguarde os checks até o fim. Corrija erros reais; falhas de infraestrutura podem ser repetidas, com registro do motivo.
5. Não faça merge por iniciativa própria em trabalho de equipe. Auto-merge de PR só segue a política aprovada para a quantidade de colaboradores do repositório.
6. Após merge: `git switch main`, `git pull --ff-only`, `git fetch -p` e `git branch -d N-descricao`. Se squash impedir `-d`, só use `-D` após confirmar PR mergeado daquela branch; sem confirmação, preserve a branch.

Exemplo:

```text
docs(prd): explicitar limites da verificação de imagens

Evita que um sinal heurístico seja apresentado como prova de autenticidade.
```

Sem atribuições automáticas, coautoria artificial ou dados de sessões em commits e PRs. Ao iniciar trabalho, revise `git branch --merged main` e limpe somente branches de trabalho cujo merge esteja confirmado; preserve branches padrão, backup e branches gerenciadas pelo ambiente.

## Validação

No código: `pnpm install --frozen-lockfile`, `pnpm run typecheck` e `pnpm --filter @workspace/mockup-sandbox test`.

Na documentação: `python3 scripts/validate-docs.py`. Confira também referências, fontes e se afirmações distinguem aprovado, proposto e implementado. A aprovação do design não equivale a app nativo implementado.

## Configuração GitHub

- Somente merge commit; excluir branches remotas após merge; auto-merge disponível.
- `main`: PR, checks obrigatórios, sem force push/deleção. Repo solo: zero aprovações; com equipe: pelo menos uma aprovação e CODEOWNERS.
- Não criar `.github/dependabot.yml`.
- A automação de Project precisa de `PROJECT_TOKEN` configurado nos secrets do GitHub com acesso aos dois repos e ao Project. Nunca colocar seu valor em arquivos ou chat.
- O script de auditoria pessoal fornecido não inclui `City-Eyes`; auditar estes repositórios explicitamente.
