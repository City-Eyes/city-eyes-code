import React from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useListCities } from "@workspace/api-client-react";
import { Button } from "@workspace/city-eyes-system/components/native/button";
import { Empty } from "@workspace/city-eyes-system/components/native/empty";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";
import { CityCard, EmptyError, LoadingCards, Screen, ScreenScrollView } from "@/components/app-ui";

export default function PublishScreen() {
  const colors = useColors();
  const citiesQuery = useListCities({ query: { staleTime: 5 * 60_000 } });
  const cities = citiesQuery.data ?? [];

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
        <View style={styles.heading}>
          <Typography variant="eyebrow">PUBLICAR UM RELATO</Typography>
          <Typography variant="display">Escolha uma cidade</Typography>
          <Typography variant="muted">Selecione onde o problema foi observado para continuar.</Typography>
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
              <Button variant="outline" onPress={() => void citiesQuery.refetch()}>
                Atualizar lista
              </Button>
            }
          />
        ) : null}
        {cities.map((city) => (
          <CityCard
            key={city.id}
            city={city}
            onPress={() => router.push({ pathname: "/city/[cityId]/report/new", params: { cityId: city.id } })}
          />
        ))}
      </ScreenScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: nativeTheme.spacing.sm, marginBottom: nativeTheme.spacing.xs, minWidth: 0 },
});
