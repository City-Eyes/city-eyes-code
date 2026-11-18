import React, { useState } from "react";
import { Image, RefreshControl, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  getGetCityReportQueryKey,
  useCreateReportConfirmation,
  useGetCityReport,
} from "@workspace/api-client-react";
import { Badge } from "@workspace/city-eyes-system/components/native/badge";
import { Button } from "@workspace/city-eyes-system/components/native/button";
import { Card } from "@workspace/city-eyes-system/components/native/card";
import { Empty } from "@workspace/city-eyes-system/components/native/empty";
import { Spinner } from "@workspace/city-eyes-system/components/native/spinner";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";
import {
  BackHeader,
  DemoNotice,
  EmptyError,
  ReportDemoBadge,
  Screen,
  ScreenScrollView,
  categoryLabel,
  formatDate,
  parseCityId,
} from "@/components/app-ui";
import { useAuth } from "@/lib/auth";

const statusLabels = {
  open: "Aberto",
  in_review: "Em análise",
  in_progress: "Em andamento",
  resolved: "Resolvido",
} as const;

export default function ReportDetailScreen() {
  const params = useLocalSearchParams<{
    cityId?: string | string[];
    reportId?: string | string[];
  }>();
  const cityId = parseCityId(params.cityId);
  const reportId = Array.isArray(params.reportId)
    ? params.reportId[0]
    : params.reportId;
  const colors = useColors();
  const auth = useAuth();
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const createConfirmationMutation = useCreateReportConfirmation();

  const reportQuery = useGetCityReport(
    cityId ?? "curitiba",
    reportId ?? "",
    {
      query: {
        enabled: Boolean(cityId && reportId),
        staleTime: 60_000,
        queryKey: getGetCityReportQueryKey(cityId ?? "curitiba", reportId ?? ""),
      },
    },
  );

  const goBack = () => {
    if (cityId) {
      router.replace({ pathname: "/city/[cityId]", params: { cityId } });
    } else {
      router.replace("/");
    }
  };

  const handleSupport = async () => {
    if (!auth.user) {
      router.push("/auth");
      return;
    }
    if (!cityId || !reportId) return;
    setIsConfirming(true);
    setConfirmationMessage("");
    try {
      await createConfirmationMutation.mutateAsync({
        cityId,
        reportId,
        data: { type: "support" },
      });
      await reportQuery.refetch();
      setConfirmationMessage("Apoio registrado com sucesso!");
    } catch (err: any) {
      if (err?.status === 409) {
        setConfirmationMessage("Você já apoiou este relato.");
      } else {
        setConfirmationMessage("Não foi possível registrar o apoio agora.");
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleConfirmResolution = async () => {
    if (!auth.user) {
      router.push("/auth");
      return;
    }
    if (!cityId || !reportId) return;
    setIsConfirming(true);
    setConfirmationMessage("");
    try {
      await createConfirmationMutation.mutateAsync({
        cityId,
        reportId,
        data: { type: "resolution" },
      });
      await reportQuery.refetch();
      setConfirmationMessage("Confirmação de resolução registrada!");
    } catch (err: any) {
      if (err?.status === 409) {
        setConfirmationMessage("Você já confirmou a resolução deste relato.");
      } else {
        setConfirmationMessage("Não foi possível registrar a confirmação agora.");
      }
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Screen>
      <ScreenScrollView
        refreshControl={
          <RefreshControl
            refreshing={reportQuery.isRefetching}
            onRefresh={() => void reportQuery.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <BackHeader label="Voltar aos relatos" onPress={goBack} />

        {!cityId || !reportId ? (
          <Empty
            title="Relato não encontrado"
            description="Volte à lista para escolher um relato disponível."
          />
        ) : reportQuery.isPending ? (
          <Spinner label="Carregando relato…" />
        ) : reportQuery.isError ? (
          <EmptyError
            title="Relato não encontrado"
            description="Ele pode ter sido removido ou não pertencer a esta cidade."
            onRetry={() => void reportQuery.refetch()}
          />
        ) : reportQuery.data ? (
          <>
            <View style={styles.heading}>
              <Typography variant="eyebrow">{reportQuery.data.cityName}</Typography>
              <Typography variant="display">{reportQuery.data.title}</Typography>
              <View style={styles.metaRow}>
                <Typography variant="muted">
                  {categoryLabel(reportQuery.data.category)} ·{" "}
                  {formatDate(reportQuery.data.createdAt)}
                </Typography>
              </View>
              {reportQuery.data.isDemo ? <ReportDemoBadge /> : null}
              {!reportQuery.data.isDemo ? (
                <Badge variant="outline">{statusLabels[reportQuery.data.status]}</Badge>
              ) : null}
            </View>

            <DemoNotice />

            {/* Cartão de Confirmações e Apoio Cidadão (B-12) */}
            <Card style={styles.detailCard}>
              <View style={styles.detailLabel}>
                <Feather name="check-circle" size={16} color={colors.primary} />
                <Typography variant="small">Acompanhamento e Confirmações</Typography>
              </View>

              {reportQuery.data.status !== "resolved" ? (
                <View style={styles.confirmationRow}>
                  <View style={styles.confirmationInfo}>
                    <Typography variant="body">
                      {reportQuery.data.supportsCount}{" "}
                      {reportQuery.data.supportsCount === 1
                        ? "cidadão apoiou este relato"
                        : "cidadãos apoiaram este relato"}
                    </Typography>
                    <Typography variant="caption">
                      Seu apoio ajuda a evidenciar a relevância do problema.
                    </Typography>
                  </View>
                  {reportQuery.data.userHasSupported ? (
                    <Badge variant="default">Você apoiou ✓</Badge>
                  ) : (
                    <Button
                      testID="report-support-button"
                      size="sm"
                      disabled={isConfirming}
                      onPress={handleSupport}
                    >
                      {isConfirming ? "Enviando…" : "Apoiar relato"}
                    </Button>
                  )}
                </View>
              ) : (
                <View style={styles.confirmationRow}>
                  <View style={styles.confirmationInfo}>
                    <Typography variant="body">
                      {reportQuery.data.resolutionConfirmationsCount}{" "}
                      {reportQuery.data.resolutionConfirmationsCount === 1
                        ? "confirmação de resolução"
                        : "confirmações de resolução"}
                    </Typography>
                    <Typography variant="caption">
                      Confirme se o reparo foi verificado no local.
                    </Typography>
                  </View>
                  {reportQuery.data.userHasConfirmedResolution ? (
                    <Badge variant="default">Resolução confirmada ✓</Badge>
                  ) : (
                    <Button
                      testID="report-confirm-resolution-button"
                      size="sm"
                      disabled={isConfirming}
                      onPress={handleConfirmResolution}
                    >
                      {isConfirming ? "Enviando…" : "Confirmar reparo"}
                    </Button>
                  )}
                </View>
              )}
              {confirmationMessage ? (
                <Typography variant="caption" style={{ color: colors.primary }}>
                  {confirmationMessage}
                </Typography>
              ) : null}
            </Card>

            <Card style={styles.detailCard}>
              <View style={styles.detailLabel}>
                <Feather name="map-pin" size={16} color={colors.primary} />
                <Typography variant="small">Localização</Typography>
              </View>
              <Typography variant="body">
                {reportQuery.data.locationLabel}
              </Typography>
            </Card>

            {reportQuery.data.photoUrl ? (
              <Image
                source={{ uri: reportQuery.data.photoUrl }}
                accessibilityLabel={`Foto do relato: ${reportQuery.data.title}`}
                style={styles.photo}
              />
            ) : null}

            <Card style={styles.detailCard}>
              <Typography variant="eyebrow">DESCRIÇÃO</Typography>
              <Typography variant="body">{reportQuery.data.description}</Typography>
            </Card>

            {reportQuery.data.latitude != null &&
            reportQuery.data.longitude != null ? (
              <Card style={styles.detailCard}>
                <Typography variant="eyebrow">COORDENADAS PUBLICADAS</Typography>
                <Typography variant="body">
                  {reportQuery.data.latitude}, {reportQuery.data.longitude}
                </Typography>
              </Card>
            ) : null}

            {reportQuery.data.events.some(
              (event) => event.publicNote || event.evidenceImageUrl,
            ) ? (
              <Card style={styles.detailCard}>
                <Typography variant="eyebrow">ATUALIZAÇÕES PÚBLICAS</Typography>
                {reportQuery.data.events
                  .filter((event) => event.publicNote || event.evidenceImageUrl)
                  .map((event) => (
                    <View key={event.id} style={styles.event}>
                      <Typography variant="small">
                        {statusLabels[event.statusAfter]}
                      </Typography>
                      {event.publicNote ? (
                        <Typography variant="body">{event.publicNote}</Typography>
                      ) : null}
                      {event.evidenceImageUrl ? (
                        <View style={styles.evidenceContainer}>
                          <Typography variant="caption">EVIDÊNCIA DE RESOLUÇÃO</Typography>
                          <Image
                            source={{ uri: event.evidenceImageUrl }}
                            accessibilityLabel="Foto da resolução pela prefeitura"
                            style={styles.evidencePhoto}
                          />
                        </View>
                      ) : null}
                      <Typography variant="caption">
                        {formatDate(event.createdAt)}
                      </Typography>
                    </View>
                  ))}
              </Card>
            ) : null}

            <Typography variant="caption" style={styles.disclaimer}>
              {reportQuery.data.isDemo
                ? "Este conteúdo fictício não confirma ocorrência, atendimento ou providência de qualquer órgão público."
                : "Relato enviado por uma pessoa. As informações não foram verificadas e não comprovam ocorrência, atendimento ou providência de qualquer órgão público."}
            </Typography>
          </>
        ) : null}
      </ScreenScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: nativeTheme.spacing.md,
    marginTop: nativeTheme.spacing.xs,
    marginBottom: nativeTheme.spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detailCard: {
    gap: 12,
  },
  detailLabel: {
    alignItems: "center",
    flexDirection: "row",
    gap: nativeTheme.spacing.sm,
  },
  confirmationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: nativeTheme.spacing.md,
  },
  confirmationInfo: {
    flex: 1,
    gap: nativeTheme.spacing.xs,
  },
  photo: {
    borderRadius: nativeTheme.radius,
    height: 240,
    width: "100%",
  },
  event: {
    gap: nativeTheme.spacing.xs,
  },
  evidenceContainer: {
    gap: nativeTheme.spacing.xs,
    marginTop: nativeTheme.spacing.xs,
  },
  evidencePhoto: {
    borderRadius: nativeTheme.radius,
    height: 180,
    width: "100%",
  },
  disclaimer: {
    textAlign: "center",
    paddingHorizontal: nativeTheme.spacing.md,
  },
});
