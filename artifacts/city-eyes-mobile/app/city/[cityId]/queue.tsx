import React, { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  getListOperatorCitiesQueryKey,
  getListOperatorReportsQueryKey,
  useListOperatorCities,
  useListOperatorReports,
  type ReportStatus,
} from "@workspace/api-client-react";
import { Badge } from "@workspace/city-eyes-system/components/native/badge";
import { Button } from "@workspace/city-eyes-system/components/native/button";
import { Card } from "@workspace/city-eyes-system/components/native/card";
import { Empty } from "@workspace/city-eyes-system/components/native/empty";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";
import {
  BackHeader,
  EmptyError,
  LoadingCards,
  Screen,
  ScreenScrollView,
  categoryLabel,
  formatDate,
  parseCityId,
} from "@/components/app-ui";
import { useAuth } from "@/lib/auth";
import { clearProtectedCache, isAuthorizationError, protectedKey } from "@/lib/protected-cache";
import { useQueryClient } from "@tanstack/react-query";

const statuses: { value: ReportStatus | undefined; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "open", label: "Aberto" },
  { value: "in_review", label: "Em análise" },
  { value: "in_progress", label: "Em andamento" },
  { value: "resolved", label: "Resolvido" },
];
const statusLabel: Record<ReportStatus, string> = {
  open: "Aberto",
  in_review: "Em análise",
  in_progress: "Em andamento",
  resolved: "Resolvido",
};

export default function OperatorQueueScreen() {
  const params = useLocalSearchParams<{
    cityId?: string | string[];
    status?: string | string[];
    page?: string | string[];
    sort?: string | string[];
    notice?: string | string[];
  }>();
  const cityId = parseCityId(params.cityId);
  const initialStatus = typeof params.status === "string" ? params.status : "";
  const initialPage = typeof params.page === "string" ? Number(params.page) : 1;
  const initialSort = params.sort === "oldest" ? "oldest" : "newest";
  const colors = useColors();
  const auth = useAuth();
  const client = useQueryClient();
  const [accessDenied, setAccessDenied] = useState(false);
  const [filter, setFilter] = useState<ReportStatus | undefined>(
    statuses.find((item) => item.value === initialStatus)?.value,
  );
  const [page, setPage] = useState(
    Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1,
  );
  const [sort, setSort] = useState<"newest" | "oldest">(initialSort);
  const operatorCities = useListOperatorCities({
    query: {
      queryKey: protectedKey(auth.user?.id, getListOperatorCitiesQueryKey()),
      enabled: Boolean(auth.user) && !auth.isLoading && !accessDenied,
      retry: false,
      staleTime: 0,
      refetchOnMount: "always",
    },
  });
  const authorized = Boolean(
    auth.user && !auth.isLoading && !accessDenied && !operatorCities.isError &&
    !operatorCities.isFetching && cityId && operatorCities.data?.some((city) => city.id === cityId),
  );
  const pageParams = { status: filter, page, limit: 20, sort };
  const reportsQuery = useListOperatorReports(
    cityId ?? "curitiba",
    pageParams,
    {
      query: {
        enabled: authorized,
        queryKey: protectedKey(auth.user?.id, getListOperatorReportsQueryKey(
          cityId ?? "curitiba",
          pageParams,
        )),
        retry: false,
      },
    },
  );
  React.useEffect(() => {
    if (isAuthorizationError(operatorCities.error) || isAuthorizationError(reportsQuery.error)) {
      setAccessDenied(true);
    }
  }, [operatorCities.error, reportsQuery.error]);

  React.useEffect(() => {
    if (operatorCities.isSuccess && operatorCities.data && cityId) {
      const hasCity = operatorCities.data.some((city) => city.id === cityId);
      if (!hasCity) {
        setAccessDenied(true);
        void clearProtectedCache(client);
      }
    }
  }, [operatorCities.isSuccess, operatorCities.data, cityId, client]);

  const openReport = (reportId: string) => {
    if (!cityId) return;
    router.push({
      pathname: "/city/[cityId]/queue/[reportId]",
      params: {
        cityId,
        reportId,
        page: String(page),
        sort,
        ...(filter ? { status: filter } : {}),
      },
    });
  };

  const retry = () => {
    if (!auth.user || auth.isLoading) return;
    setAccessDenied(false);
    void operatorCities.refetch();
    if (authorized) void reportsQuery.refetch();
  };

  return (
    <Screen>
      <ScreenScrollView
        refreshControl={
          <RefreshControl
            refreshing={
              reportsQuery.isRefetching || operatorCities.isRefetching
            }
            onRefresh={retry}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.content}
      >
        <BackHeader
          label="Voltar à cidade"
          onPress={() =>
            cityId
              ? router.replace({ pathname: "/city/[cityId]", params: { cityId } })
              : router.replace("/")
          }
        />
        <View style={styles.heading}>
          <Typography variant="eyebrow">ÁREA DE OPERAÇÃO</Typography>
          <Typography variant="display">Fila da cidade</Typography>
          <Typography variant="muted">
            A fila mostra apenas cidades autorizadas para esta conta.
          </Typography>
        </View>
        {params.notice === "updated" ? (
          <Typography variant="small">Atualização salva.</Typography>
        ) : null}
        {auth.isLoading ? <LoadingCards count={1} /> : null}
        {accessDenied ? <Empty title="Acesso não autorizado" description="Sua autorização mudou. Entre novamente ou consulte suas cidades autorizadas." /> : null}
        {!auth.isLoading && !auth.user ? (
          <Empty
            title="Entre para continuar"
            description="A fila municipal exige uma conta autorizada."
            action={
              <Button
                testID="queue-sign-in"
                onPress={() => router.push("/auth")}
              >
                Entrar
              </Button>
            }
          />
        ) : null}
        {auth.user && operatorCities.isPending ? (
          <LoadingCards count={2} />
        ) : null}
        {auth.user && operatorCities.isError ? (
          <EmptyError
            title="Não foi possível verificar a autorização"
            description="Tente consultar as cidades autorizadas novamente."
            onRetry={() => void operatorCities.refetch()}
          />
        ) : null}
        {auth.user &&
        !operatorCities.isPending &&
        !operatorCities.isError &&
        !authorized ? (
          operatorCities.data?.length ? (
            <Card style={styles.reportCard}>
              <Typography variant="title">
                Escolha uma cidade autorizada
              </Typography>
              {operatorCities.data.map((city) => (
                <Button
                  key={city.id}
                  testID={`queue-city-${city.id}`}
                  variant={city.id === cityId ? "secondary" : "outline"}
                  onPress={() =>
                    router.replace({
                      pathname: "/city/[cityId]/queue",
                      params: { cityId: city.id },
                    })
                  }
                >
                  {city.name} · {city.openReportCount} em aberto
                </Button>
              ))}
            </Card>
          ) : (
            <Empty
              title="Sem acesso a esta cidade"
              description="Esta conta ainda não tem autorização para consultar uma fila municipal."
            />
          )
        ) : null}
        {authorized ? (
          <>
            <Card style={styles.statusFilters}>
              <Typography variant="small">Filtrar por situação</Typography>
              <View style={styles.chips}>
                {statuses.map((item) => (
                  <Button
                    key={item.label}
                    testID={`queue-filter-${item.value ?? "all"}`}
                    size="sm"
                    variant={filter === item.value ? "default" : "outline"}
                    onPress={() => {
                      setFilter(item.value);
                      setPage(1);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </View>
              <Typography variant="small">Ordenar por data</Typography>
              <View style={styles.chips}>
                <Button
                  testID="queue-sort-newest"
                  size="sm"
                  variant={sort === "newest" ? "default" : "outline"}
                  onPress={() => {
                    setSort("newest");
                    setPage(1);
                  }}
                >
                  Mais recentes
                </Button>
                <Button
                  testID="queue-sort-oldest"
                  size="sm"
                  variant={sort === "oldest" ? "default" : "outline"}
                  onPress={() => {
                    setSort("oldest");
                    setPage(1);
                  }}
                >
                  Mais antigos
                </Button>
              </View>
              {reportsQuery.isSuccess && reportsQuery.data ? (
                <Typography variant="caption">
                  {reportsQuery.data.total} relatos · página {page}
                </Typography>
              ) : null}
            </Card>
            {reportsQuery.isPending ? <LoadingCards count={3} /> : null}
            {reportsQuery.isError ? (
              <EmptyError
                title="A fila não carregou"
                description="A conexão pode estar instável. Tente novamente."
                onRetry={() => void reportsQuery.refetch()}
              />
            ) : null}
            {!reportsQuery.isPending &&
            !reportsQuery.isError &&
            reportsQuery.data?.items.length === 0 ? (
              <Empty
                title="Nenhum relato nesta situação"
                description="Quando houver relatos para este filtro, eles aparecerão aqui."
              />
            ) : null}
            {reportsQuery.isSuccess && reportsQuery.data?.items.map((report) => (
              <Card key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeading}>
                  <View style={styles.reportTitle}>
                    <Typography variant="title">{report.title}</Typography>
                    <Typography variant="muted">
                      {categoryLabel(report.category)} ·{" "}
                      {formatDate(report.createdAt)}
                    </Typography>
                  </View>
                  <Badge variant="outline">{statusLabel[report.status]}</Badge>
                </View>
                <Typography variant="muted">{report.locationLabel}</Typography>
                <Button
                  testID={`queue-open-${report.id}`}
                  variant="outline"
                  onPress={() => openReport(report.id)}
                >
                  Abrir atendimento
                </Button>
              </Card>
            ))}
            {reportsQuery.isSuccess && reportsQuery.data &&
            (page > 1 || reportsQuery.data.hasNextPage) ? (
              <View style={styles.pagination}>
                <Button
                  testID="queue-previous-page"
                  variant="outline"
                  disabled={page <= 1}
                  onPress={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </Button>
                <Button
                  testID="queue-next-page"
                  variant="outline"
                  disabled={!reportsQuery.data.hasNextPage}
                  onPress={() => setPage((current) => current + 1)}
                >
                  Próxima
                </Button>
              </View>
            ) : null}
          </>
        ) : null}
      </ScreenScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: nativeTheme.spacing.md,
    paddingHorizontal: nativeTheme.spacing.lg,
    paddingTop: nativeTheme.spacing.lg,
    paddingBottom: nativeTheme.spacing.xl,
  },
  heading: { gap: nativeTheme.spacing.sm },
  statusFilters: { gap: nativeTheme.spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: nativeTheme.spacing.xs },
  reportCard: { gap: nativeTheme.spacing.md },
  reportHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: nativeTheme.spacing.sm,
    justifyContent: "space-between",
  },
  reportTitle: { flex: 1, gap: nativeTheme.spacing.xs },
  pagination: {
    flexDirection: "row",
    gap: nativeTheme.spacing.sm,
    justifyContent: "space-between",
  },
});
