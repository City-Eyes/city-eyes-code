import React from "react";
import { StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { reloadAppAsync } from "expo";
import { Button } from "@workspace/city-eyes-system/components/native/button";
import { Card } from "@workspace/city-eyes-system/components/native/card";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ resetError }: ErrorFallbackProps) {
  const colors = useColors();

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      console.error("Failed to restart app:", restartError);
      resetError();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Card style={styles.card}>
        <Feather name="alert-triangle" size={24} color={colors.destructive} />
        <Typography variant="title">O app encontrou um problema</Typography>
        <Typography variant="muted">
          Não foi possível abrir esta tela. Tente novamente.
        </Typography>
        <Button onPress={handleRestart}>Tentar novamente</Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    gap: nativeTheme.spacing.md,
    maxWidth: 520,
    width: '100%',
  },
});
