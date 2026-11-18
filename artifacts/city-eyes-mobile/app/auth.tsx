import React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@workspace/city-eyes-system/components/native/button";
import { Card } from "@workspace/city-eyes-system/components/native/card";
import { Skeleton } from "@workspace/city-eyes-system/components/native/skeleton";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";
import { BackHeader, Screen, ScreenScrollView } from "@/components/app-ui";
import { useAuth } from "@/lib/auth";

export default function AuthScreen() {
  const { user, isLoading, error, login, logout, refreshUser } = useAuth();

  return (
    <Screen>
      <ScreenScrollView contentContainerStyle={styles.content}>
        <BackHeader
          label="Voltar"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
        />
        <ViewHeading />
        {isLoading ? (
          <Card style={styles.card}>
            <Skeleton width="70%" />
            <Skeleton width="45%" />
          </Card>
        ) : user ? (
          <Card style={styles.card}>
            <Typography variant="title">Você está conectado</Typography>
            <Typography variant="body">
              {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                user.email ||
                "Conta ativa"}
            </Typography>
            {user.email ? (
              <Typography variant="muted">{user.email}</Typography>
            ) : null}
            <Button testID="auth-return-city" onPress={() => router.back()}>
              Continuar
            </Button>
            <Button testID="auth-sign-out" variant="outline" onPress={() => void logout()}>
              Sair da conta
            </Button>
          </Card>
        ) : (
          <Card style={styles.card}>
            <Typography variant="title">Entre com sua conta</Typography>
            <Typography variant="muted">
              O acesso abre a página segura de autenticação. Não pedimos sua senha neste app.
            </Typography>
            {error ? (
              <Typography variant="muted" accessibilityRole="alert">
                {error}
              </Typography>
            ) : null}
            <Button testID="auth-sign-in" onPress={() => void login()}>
              Entrar
            </Button>
            {error ? (
              <Button
                testID="auth-retry-account"
                variant="outline"
                onPress={() => void refreshUser()}
              >
                Atualizar conta
              </Button>
            ) : null}
          </Card>
        )}
      </ScreenScrollView>
    </Screen>
  );
}

function ViewHeading() {
  return (
    <View style={styles.heading}>
      <Typography variant="eyebrow">CONTA CITY EYES</Typography>
      <Typography variant="display">Acesso seguro</Typography>
      <Typography variant="muted">
        Entre para enviar um relato. Sua conta ajuda a proteger a fila de envios.
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  heading: { gap: nativeTheme.spacing.sm, marginTop: nativeTheme.spacing.md },
  card: { gap: nativeTheme.spacing.md },
});
