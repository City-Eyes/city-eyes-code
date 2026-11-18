import React, { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useColors } from "../../hooks/use-colors";
import { nativeTheme } from "../../lib/native-theme";
import { Card } from "./card";
import { Typography } from "./typography";

export type EmptyProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function Empty({ action, description, icon, title }: EmptyProps) {
  const colors = useColors();

  return (
    <Card style={styles.card}>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
          {icon}
        </View>
      ) : null}
      <Typography variant="small" style={styles.title}>
        {title}
      </Typography>
      <Typography variant="muted" style={styles.description}>
        {description}
      </Typography>
      {action ? <View style={styles.action}>{action}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderStyle: "dashed",
    padding: nativeTheme.spacing.xl,
  },
  icon: {
    alignItems: "center",
    borderRadius: nativeTheme.radius,
    height: 44,
    justifyContent: "center",
    marginBottom: nativeTheme.spacing.md,
    width: 44,
  },
  title: {
    textAlign: "center",
  },
  description: {
    marginTop: nativeTheme.spacing.xs,
    textAlign: "center",
  },
  action: {
    marginTop: nativeTheme.spacing.lg,
    width: "100%",
  },
});
