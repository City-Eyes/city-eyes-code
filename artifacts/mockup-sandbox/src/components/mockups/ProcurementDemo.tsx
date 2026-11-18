import { useMemo, useState } from "react";
import { Badge } from "@workspace/city-eyes-system/components/ui/badge";
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

        <Card className="border-accent/40 bg-accent/5 shadow-none">
          <CardHeader className="gap-2">
            <CardTitle className="text-lg">Aviso sobre esta demonstração</CardTitle>
            <CardDescription className="text-foreground">
              Os IDs, datas, órgãos, objetos e valores abaixo foram inventados.
              Não representam licitações reais, não são relatos da comunidade
              CITY EYES e não comprovam vínculo com a Prefeitura.
            </CardDescription>
          </CardHeader>
        </Card>

        <section
          aria-label="Proveniência e data de corte"
          className="grid gap-4 md:grid-cols-2"
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Origem da estrutura</CardTitle>
              <CardDescription>{procurementDemo.sourceDescription}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm font-medium">
              Fonte dos registros: nenhuma — amostra sintética local.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Data de corte</CardTitle>
              <CardDescription>
                Não se aplica. Como não há dados oficiais, esta amostra não tem
                data de atualização nem cobertura temporal municipal.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm font-medium">
              Importação oficial: não liberada nem implementada.
            </CardContent>
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
