# Orientação para agentes — CITY EYES

1. Leia a issue atribuída, critérios de aceite e dependências.
2. Leia `README.md`, `CONTRIBUTING.md` e o plano canônico em `city-eyes-docs`.
3. Para UI, leia a documentação de `artifacts/city-eyes-system/docs/` antes de alterar telas; use seus tokens e componentes.
4. Consulte a especificação de testes e arquitetura correspondente. Não altere contratos compartilhados em paralelo sem coordenação.

## Precedência

A decisão explícita mais recente do usuário prevalece. Depois vêm decisões aprovadas documentadas, especificação da issue e propostas. Em conflito, registre a divergência e peça decisão; não transforme proposta em requisito.

## Limites

- Android/iOS com Expo são o destino; os protótipos atuais não são app nativo implementado.
- Leitura pública; conta para publicar. Autoria, papel e cidade autorizada serão verificados no servidor, não confiados ao cliente.
- Bbox é aproximação; câmera e heurísticas de IA não comprovam autenticidade.
- O recorte de transparência está pendente. Amostra de licitações é fictícia, não um feed oficial.
- Não copie memória interna ou anexos para repositórios públicos.
- Não crie PRs concorrentes para a mesma issue ou altere fontes canônicas em dois repos.
- Respeite o padrão de commits com escopo e corpo; PR inclui issue e CI deve ser acompanhado até o fim.
