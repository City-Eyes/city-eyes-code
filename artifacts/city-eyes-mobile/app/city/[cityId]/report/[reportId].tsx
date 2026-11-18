import React from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useGetCityReport } from "@workspace/api-client-react";
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
  const reportQuery = useGetCityReport(
    cityId ?? "curitiba",
    reportId ?? "",
    {
      query: {
        enabled: Boolean(cityId && reportId),
        staleTime: 60_000,
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
            </View>

            <DemoNotice />

            <Card style={styles.detailCard}>
              <View style={styles.detailLabel}>
                <Feather name="map-pin" size={16} color={colors.primary} />
                <Typography variant="small">Localização</Typography>
              </View>
              <Typography variant="body">
                {reportQuery.data.locationLabel}
              </Typography>
            </Card>

            <Card style={styles.detailCard}>
              <Typography variant="eyebrow">DESCRIÇÃO</Typography>
              <Typography variant="body">{reportQuery.data.description}</Typography>
            </Card>

            <Typography variant="caption" style={styles.disclaimer}>
              Este conteúdo fictício não confirma ocorrência, atendimento ou
              providência de qualquer órgão público.
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
  disclaimer: {
    textAlign: "center",
    paddingHorizontal: nativeTheme.spacing.md,
  },
});
