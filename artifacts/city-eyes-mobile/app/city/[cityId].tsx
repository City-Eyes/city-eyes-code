import React from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  useListCities,
  useListCityReports,
} from "@workspace/api-client-react";
import { Badge } from "@workspace/city-eyes-system/components/native/badge";
import { Empty } from "@workspace/city-eyes-system/components/native/empty";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";
import {
  BackHeader,
  DemoNotice,
  EmptyError,
  LoadingCards,
  ReportCard,
  Screen,
  ScreenScrollView,
  parseCityId,
} from "@/components/app-ui";

export default function CityReportsScreen() {
  const params = useLocalSearchParams<{ cityId?: string | string[] }>();
  const cityId = parseCityId(params.cityId);
  const colors = useColors();
  const citiesQuery = useListCities({
    query: {
      staleTime: 5 * 60_000,
    },
  });
  const reportsQuery = useListCityReports(
    cityId ?? "curitiba",
    { page: 1, limit: 50 },
    {
      query: {
        enabled: Boolean(cityId),
        staleTime: 60_000,
      },
    },
  );
  const city = citiesQuery.data?.find((item) => item.id === cityId);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const openReport = async (reportId: string) => {
    if (!cityId) return;
    try {
      await Haptics.selectionAsync();
    } catch {
      // Haptics are optional; navigation must still work on unsupported devices.
    }
    router.push({
      pathname: "/city/[cityId]/report/[reportId]",
      params: { cityId, reportId },
    });
  };

  const retry = () => {
    void citiesQuery.refetch();
    if (cityId) void reportsQuery.refetch();
  };

  return (
    <Screen>
      <ScreenScrollView
        refreshControl={
          <RefreshControl
            refreshing={reportsQuery.isRefetching || citiesQuery.isRefetching}
            onRefresh={retry}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <BackHeader label="Todas as cidades" onPress={goBack} />

        {!cityId ? (
          <Empty
            title="Cidade não reconhecida"
            description="Volte e escolha uma das cidades disponíveis."
          />
        ) : (
          <>
            <View style={styles.heading}>
              <Typography variant="eyebrow">CONSULTA POR CIDADE</Typography>
              <Typography variant="display">{city?.name ?? "Relatos"}</Typography>
              <Typography variant="muted">
                Relatos públicos de demonstração, sem vínculo com uma prefeitura.
              </Typography>
            </View>

            <DemoNotice />

            <View style={styles.listHeading}>
              <Typography variant="title">Relatos nesta cidade</Typography>
              {reportsQuery.data ? (
                <Badge variant="outline">
                  {reportsQuery.data.total} exemplos
                </Badge>
              ) : null}
            </View>

            {citiesQuery.isError || reportsQuery.isError ? (
              <EmptyError
                title="Não foi possível carregar os relatos"
                description="Tente novamente. A consulta fica restrita à cidade escolhida."
                onRetry={retry}
              />
            ) : null}

            {citiesQuery.isPending || reportsQuery.isPending ? (
              <LoadingCards count={3} />
            ) : null}

            {!citiesQuery.isPending &&
            !reportsQuery.isPending &&
            !citiesQuery.isError &&
            !reportsQuery.isError &&
            !city ? (
              <Empty
                title="Cidade não encontrada"
                description="Essa cidade não está disponível no diretório."
              />
            ) : null}

            {reportsQuery.data?.items.length === 0 ? (
              <Empty
                title="Nenhum relato nesta cidade"
                description="Ainda não há exemplos para esta seleção."
              />
            ) : null}

            {reportsQuery.data?.items.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onPress={() => void openReport(report.id)}
              />
            ))}
          </>
        )}
      </ScreenScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: nativeTheme.spacing.sm,
    marginTop: nativeTheme.spacing.xs,
    marginBottom: nativeTheme.spacing.xs,
  },
  listHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: nativeTheme.spacing.sm,
  },
});
