import React from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useListCities } from "@workspace/api-client-react";
import { Button } from "@workspace/city-eyes-system/components/native/button";
import { Empty } from "@workspace/city-eyes-system/components/native/empty";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";
import {
  BrandHeader,
  CityCard,
  DemoNotice,
  EmptyError,
  LoadingCards,
  Screen,
  ScreenScrollView,
} from "@/components/app-ui";

export default function CitySelectionScreen() {
  const colors = useColors();
  const citiesQuery = useListCities({
    query: {
      staleTime: 5 * 60_000,
    },
  });
  const cities = citiesQuery.data ?? [];

  const openCity = async (cityId: string) => {
    try {
      await Haptics.selectionAsync();
    } catch {
      // Haptics are optional; navigation must still work on unsupported devices.
    }
    router.push({ pathname: "/city/[cityId]", params: { cityId } });
  };

  return (
    <Screen inTabs>
      <ScreenScrollView
        refreshControl={
          <RefreshControl
            refreshing={citiesQuery.isRefetching}
            onRefresh={() => void citiesQuery.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <BrandHeader />
        <View style={styles.intro}>
          <Typography variant="eyebrow">OLHOS ABERTOS PARA A CIDADE</Typography>
          <Typography variant="display">Cidade em foco.</Typography>
          <Typography variant="muted">
            Consulte exemplos de relatos urbanos e veja como a informação pode
            ser organizada por cidade.
          </Typography>
        </View>

        <DemoNotice />

        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Typography variant="title">Escolha uma cidade</Typography>
            <Typography variant="muted">
              O piloto começa com quatro cidades do Paraná.
            </Typography>
          </View>
          <Typography variant="caption">
            {cities.length ? `${cities.length} cidades` : ""}
          </Typography>
        </View>

        {citiesQuery.isPending ? <LoadingCards count={4} /> : null}

        {citiesQuery.isError ? (
          <EmptyError
            title="Não foi possível carregar as cidades"
            description="Confira sua conexão e tente consultar novamente."
            onRetry={() => void citiesQuery.refetch()}
          />
        ) : null}

        {!citiesQuery.isPending && !citiesQuery.isError && cities.length === 0 ? (
          <Empty
            title="Nenhuma cidade disponível"
            description="A lista de cidades ainda não foi configurada."
            action={
              <Button
                variant="outline"
                onPress={() => void citiesQuery.refetch()}
              >
                Atualizar lista
              </Button>
            }
          />
        ) : null}

        {cities.map((city) => (
          <CityCard
            key={city.id}
            city={city}
            onPress={() => void openCity(city.id)}
          />
        ))}

        <View style={styles.footer}>
          <Typography variant="caption">
            Olhar Cidadão · consulta pública demonstrativa
          </Typography>
        </View>
      </ScreenScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: nativeTheme.spacing.sm,
    marginTop: nativeTheme.spacing.md,
    marginBottom: nativeTheme.spacing.xs,
  },
  sectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: nativeTheme.spacing.md,
  },
  sectionCopy: {
    flex: 1,
    gap: nativeTheme.spacing.xs,
  },
  footer: {
    alignItems: "center",
    paddingVertical: nativeTheme.spacing.sm,
  },
});
