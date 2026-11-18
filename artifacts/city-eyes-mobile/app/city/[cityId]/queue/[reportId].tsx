import React, { useState } from "react";
import {
  Image,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListOperatorCitiesQueryKey,
  getListOperatorReportsQueryKey,
  useListOperatorCities,
  useListOperatorReports,
  useUpdateOperatorReport,
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

const statuses: { value: ReportStatus; label: string }[] = [
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

export default function OperatorReportDetailScreen() {
  const params = useLocalSearchParams<{
    cityId?: string | string[];
    reportId?: string | string[];
    page?: string | string[];
    status?: string | string[];
    sort?: string | string[];
  }>();
  const cityId = parseCityId(params.cityId);
  const reportId = typeof params.reportId === "string" ? params.reportId : "";
  const parsedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const statusFilter =
    typeof params.status === "string" &&
    statuses.some((item) => item.value === params.status)
      ? (params.status as ReportStatus)
      : undefined;
  const sort: "newest" | "oldest" =
    params.sort === "oldest" ? "oldest" : "newest";
  const colors = useColors();
  const client = useQueryClient();
  const auth = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus>("open");
  const [publicNote, setPublicNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const operatorCities = useListOperatorCities({
    query: {
      queryKey: getListOperatorCitiesQueryKey(),
      enabled: Boolean(auth.user),
      retry: false,
    },
  });
  const authorized = Boolean(
    cityId && operatorCities.data?.some((city) => city.id === cityId),
  );
  const pageParams = { status: statusFilter, page, limit: 20, sort };
  const reportQuery = useListOperatorReports(
    cityId ?? "curitiba",
    pageParams,
    {
      query: {
        enabled: authorized,
        queryKey: getListOperatorReportsQueryKey(
          cityId ?? "curitiba",
          pageParams,
        ),
      },
    },
  );
  const report = reportQuery.data?.items.find((item) => item.id === reportId);
  const updateReport = useUpdateOperatorReport();

  React.useEffect(() => {
    if (report) setSelectedStatus(report.status);
  }, [report?.id, report?.status]);

  const returnToQueue = (notice?: string) => {
    if (!cityId) {
      router.replace("/");
      return;
    }
    router.replace({
      pathname: "/city/[cityId]/queue",
      params: {
        cityId,
        page: String(page),
        sort,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(notice ? { notice } : {}),
      },
    });
  };

  const save = async () => {
    if (!cityId || !report) return;
    setIsSaving(true);
    setMessage("");
    try {
      await updateReport.mutateAsync({
        cityId,
        reportId: report.id,
        data: {
          status: selectedStatus,
          ...(publicNote.trim() ? { publicNote: publicNote.trim() } : {}),
          ...(internalNote.trim()
            ? { internalNote: internalNote.trim() }
            : {}),
        },
      });
      await client.invalidateQueries({
        queryKey: getListOperatorReportsQueryKey(cityId, pageParams),
      });
      returnToQueue("updated");
    } catch {
      setMessage(
        "Não foi possível salvar. As notas continuam preenchidas; tente novamente.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenScrollView
        refreshControl={
          <RefreshControl
            refreshing={reportQuery.isRefetching || operatorCities.isRefetching}
            onRefresh={() => {
              void operatorCities.refetch();
              if (authorized) void reportQuery.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.content}
      >
        <BackHeader
          label="Voltar à fila"
          onPress={() => returnToQueue()}
        />
        <View style={styles.heading}>
          <Typography variant="eyebrow">ATENDIMENTO MUNICIPAL</Typography>
          <Typography variant="display">Detalhe do relato</Typography>
          <Typography variant="muted">
            Notas internas ficam visíveis somente para operadores autorizados.
          </Typography>
        </View>
        {auth.isLoading ? <LoadingCards count={1} /> : null}
        {!auth.isLoading && !auth.user ? (
          <Empty
            title="Entre para continuar"
            description="Este atendimento exige uma conta autorizada."
            action={
              <Button onPress={() => router.push("/auth")}>Entrar</Button>
            }
          />
        ) : null}
        {auth.user && operatorCities.isPending ? <LoadingCards count={2} /> : null}
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
          <Empty
            title="Sem acesso a esta cidade"
            description="Sua conta não tem autorização para abrir este atendimento."
            action={
              <Button variant="outline" onPress={() => returnToQueue()}>
                Voltar à fila
              </Button>
            }
          />
        ) : null}
        {authorized && reportQuery.isPending ? <LoadingCards count={2} /> : null}
        {authorized && reportQuery.isError ? (
          <EmptyError
            title="O relato não carregou"
            description="Tente novamente. A fila continua restrita à sua cidade."
            onRetry={() => void reportQuery.refetch()}
          />
        ) : null}
        {authorized &&
        !reportQuery.isPending &&
        !reportQuery.isError &&
        !report ? (
          <Empty
            title="Relato não encontrado"
            description="Ele pode ter saído do filtro aplicado à fila."
            action={
              <Button variant="outline" onPress={() => returnToQueue()}>
                Voltar à fila
              </Button>
            }
          />
        ) : null}
        {report ? (
          <>
            <Card style={styles.reportCard}>
              <View style={styles.reportHeading}>
                <View style={styles.reportTitle}>
                  <Typography variant="title">{report.title}</Typography>
                  <Typography variant="muted">
                    {categoryLabel(report.category)} · {formatDate(report.createdAt)}
                  </Typography>
                </View>
                <Badge variant="outline">{statusLabel[report.status]}</Badge>
              </View>
              {report.photoUrl ? (
                <Image
                  source={{ uri: report.photoUrl }}
                  accessibilityLabel={`Foto: ${report.title}`}
                  style={styles.photo}
                />
              ) : null}
              <Typography variant="body">{report.description}</Typography>
              <Typography variant="small">Localização pública</Typography>
              <Typography variant="muted">
                {report.locationLabel}
                {report.latitude != null && report.longitude != null
                  ? ` · ${report.latitude}, ${report.longitude}`
                  : ""}
              </Typography>
            </Card>

            <Card style={styles.reportCard}>
              <Typography variant="title">Atualizar situação</Typography>
              <View style={styles.chips}>
                {statuses.map((item) => (
                  <Button
                    key={item.value}
                    testID={`queue-status-${report.id}-${item.value}`}
                    size="sm"
                    variant={
                      selectedStatus === item.value ? "default" : "outline"
                    }
                    onPress={() => setSelectedStatus(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </View>
              <TextInput
                testID={`queue-public-note-${report.id}`}
                value={publicNote}
                onChangeText={setPublicNote}
                placeholder="Nota pública para quem acompanha o relato"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={1000}
                accessibilityLabel="Nota pública"
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.foreground },
                ]}
              />
              <Typography variant="caption">
                NOTA PÚBLICA · exibida no histórico do relato
              </Typography>
              <TextInput
                testID={`queue-internal-note-${report.id}`}
                value={internalNote}
                onChangeText={setInternalNote}
                placeholder="Nota interna para a equipe municipal"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={1000}
                accessibilityLabel="Nota interna municipal"
                style={[
                  styles.input,
                  styles.internalInput,
                  { borderColor: colors.border, color: colors.foreground },
                ]}
              />
              <Typography variant="caption">
                NOTA INTERNA · visível somente nesta fila municipal
              </Typography>
              {message ? (
                <Typography variant="muted">{message}</Typography>
              ) : null}
              <Button
                testID={`queue-save-${report.id}`}
                disabled={isSaving}
                onPress={() => void save()}
              >
                {isSaving ? "Salvando…" : "Salvar atualização"}
              </Button>
            </Card>

            <Card style={styles.reportCard}>
              <Typography variant="title">Histórico</Typography>
              {report.events.length ? (
                report.events.map((event) => (
                  <View
                    key={event.id}
                    style={[styles.event, { borderTopColor: colors.border }]}
                  >
                    <Typography variant="small">
                      {event.statusBefore
                        ? statusLabel[event.statusBefore]
                        : "Relato recebido"}{" "}
                      → {statusLabel[event.statusAfter]}
                    </Typography>
                    <Typography variant="caption">
                      {formatDate(event.createdAt)}
                    </Typography>
                    {event.publicNote ? (
                      <Typography variant="muted">
                        Nota pública: {event.publicNote}
                      </Typography>
                    ) : null}
                    {event.internalNote ? (
                      <Typography variant="muted">
                        Nota interna: {event.internalNote}
                      </Typography>
                    ) : null}
                  </View>
                ))
              ) : (
                <Typography variant="muted">
                  Ainda não há eventos de atendimento.
                </Typography>
              )}
            </Card>
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
  reportCard: { gap: nativeTheme.spacing.md },
  reportHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: nativeTheme.spacing.sm,
    justifyContent: "space-between",
  },
  reportTitle: { flex: 1, gap: nativeTheme.spacing.xs },
  photo: { width: "100%", height: 220, borderRadius: nativeTheme.radius },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: nativeTheme.spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: nativeTheme.radius,
    minHeight: 80,
    padding: nativeTheme.spacing.md,
    fontFamily: nativeTheme.fontFamily.regular,
    fontSize: nativeTheme.typography.body,
    textAlignVertical: "top",
  },
  internalInput: { borderStyle: "dashed" },
  event: {
    gap: nativeTheme.spacing.xs,
    borderTopWidth: 1,
    paddingTop: nativeTheme.spacing.sm,
  },
});
