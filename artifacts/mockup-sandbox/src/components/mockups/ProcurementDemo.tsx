import { useMemo, useState } from "react";
import { Badge } from "@workspace/city-eyes-system/components/ui/badge";
import { Button } from "@workspace/city-eyes-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/city-eyes-system/components/ui/card";
import { Input } from "@workspace/city-eyes-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/city-eyes-system/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/city-eyes-system/components/ui/table";
import { procurementDemo } from "../../data/procurement-demo";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const municipalSourceUrl =
  "https://portal.londrina.pr.gov.br/consulta-as-licitacoes-contratos";
const procurementListingUrl =
  "https://portal-prefeitura-londrina.equiplano.cloud/relatorio/licitacao-contrato/licitacoes/licitacoes/listagem?flagDescartada=false&flagVideoconferencia=false&updateParams=false";

function formatMoney(cents: number | null): string {
  return cents === null ? "—" : money.format(cents / 100);
}

export function ProcurementDemo() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const statuses = useMemo(
    () => [...new Set(procurementDemo.records.map((record) => record.status))],
    [],
  );

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

    return procurementDemo.records.filter((record) => {
      const matchesStatus = status === "all" || record.status === status;
      const searchableText = [
        record.number,
        record.year,
        record.modality,
        record.nature,
        record.entity,
        record.objectSummary,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return matchesStatus && searchableText.includes(normalizedQuery);
    });
  }, [query, status]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              CITY EYES · Transparência pública · Protótipo
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Licitações — amostra demonstrativa
            </h1>
            <p className="max-w-3xl text-muted-foreground">
              Prévia da estrutura de uma listagem municipal. Não é uma consulta
              nem uma importação de dados oficiais.
            </p>
          </div>
          <Badge variant="destructive" className="w-fit px-3 py-1 text-sm">
            DADOS 100% FICTÍCIOS
          </Badge>
        </header>

        <section aria-label="Referência oficial de licitações de Londrina">
          <Card className="border-primary/30 shadow-none">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">FONTE OFICIAL · EXTERNA</Badge>
                <Badge variant="secondary">Não importada</Badge>
              </div>
              <div className="space-y-1.5">
                <CardTitle>Prefeitura de Londrina / Equiplano</CardTitle>
                <CardDescription>
                  A página oficial da Prefeitura encaminha para a listagem de
                  licitações hospedada pela Equiplano. Esta referência não é um
                  registro do CITY EYES.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Link conferido em <strong className="font-semibold text-foreground">18/11/2026</strong>.
                  A conferência do endereço não confirma a atualização dos
                  registros.
                </p>
                <Button asChild className="w-fit">
                  <a
                    href={procurementListingUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Abrir listagem oficial no Equiplano
                    <span aria-hidden="true">↗</span>
                  </a>
                </Button>
              </div>
              <p className="text-sm">
                <a
                  className="text-primary underline underline-offset-4"
                  href={municipalSourceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Ver a página oficial da Prefeitura que encaminha para a listagem
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </p>
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold">Limites conhecidos</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  <li>
                    A listagem consultada informa cobertura a partir de
                    01/04/2026. A amostra mostrava 10 linhas por página e 8.173
                    registros declarados; isso não confirma o conteúdo ou o
                    tamanho de uma exportação.
                  </li>
                  <li>
                    Nenhuma exportação foi baixada. O tipo e o tamanho do
                    arquivo, o esquema dos campos e a estabilidade dos
                    identificadores não foram confirmados.
                  </li>
                  <li>
                    Só a página da lista foi observada; detalhes e anexos não
                    foram avaliados quanto a dados pessoais. “Formato aberto”
                    não especifica o formato do arquivo. A pesquisa não
                    confirmou licença CC BY 4.0 específica para esta listagem.
                  </li>
                </ul>
                <p className="mt-3 text-sm text-foreground">
                  O CITY EYES não importou nem validou esses dados, não os
                  enviou à Prefeitura e não relacionou a fonte a relatos
                  comunitários.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-label="Amostra fictícia do CITY EYES">
          <Card className="border-accent/40 bg-accent/5 shadow-none">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">DADOS 100% FICTÍCIOS</Badge>
                <Badge variant="outline">DEMONSTRAÇÃO CITY EYES</Badge>
              </div>
              <CardTitle className="text-lg">Relatos da comunidade e fonte oficial são coisas diferentes</CardTitle>
              <CardDescription className="text-foreground">
                Os registros exibidos abaixo foram inventados para demonstrar
                uma tabela. Não são dados municipais nem relatos reais da
                comunidade; um relato CITY EYES também não é protocolo da
                Prefeitura.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle>Registros de exemplo</CardTitle>
                <CardDescription>
                  {filteredRecords.length} de {procurementDemo.records.length}{" "}
                  itens fictícios
                </CardDescription>
              </div>
              <Badge variant="outline">Identificadores DEMO</Badge>
            </div>
            <div className="grid gap-3 pt-3 sm:grid-cols-[minmax(220px,1fr)_220px]">
              <label className="space-y-1.5 text-sm font-medium">
                <span>Buscar na amostra</span>
                <Input
                  aria-label="Buscar na amostra fictícia"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Número, modalidade, entidade ou objeto"
                  value={query}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                <span>Filtrar por situação</span>
                <Select onValueChange={setStatus} value={status}>
                  <SelectTrigger aria-label="Filtrar por situação">
                    <SelectValue placeholder="Todas as situações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as situações</SelectItem>
                    {statuses.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRecords.length ? (
              <Table>
                <TableCaption>
                  Todos os campos e valores desta tabela são fictícios.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número / ano</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Natureza</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Abertura</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Resumo do objeto</TableHead>
                    <TableHead className="text-right">Preço estimado</TableHead>
                    <TableHead className="text-right">Valor homologado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {record.number}/{record.year}
                      </TableCell>
                      <TableCell>{record.modality}</TableCell>
                      <TableCell>{record.nature}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{record.status}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {dateTime.format(new Date(record.openingAt))}
                      </TableCell>
                      <TableCell className="min-w-48">{record.entity}</TableCell>
                      <TableCell className="min-w-64">
                        {record.objectSummary}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {formatMoney(record.estimatedValueCents)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {formatMoney(record.awardedValueCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                <p className="font-medium">Nenhum exemplo encontrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste a busca ou selecione outra situação.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
