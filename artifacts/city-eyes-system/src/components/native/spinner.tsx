import React from "react";
import { ActivityIndicator, View, type ViewStyle } from "react-native";
import { useColors } from "../../hooks/use-colors";
import { nativeTheme } from "../../lib/native-theme";
import { Typography } from "./typography";

export type SpinnerProps = {
  label?: string;
  style?: ViewStyle;
};

export function Spinner({ label, style }: SpinnerProps) {
  const colors = useColors();

  return (
    <View
      accessibilityRole="progressbar"
      style={[
        {
          alignItems: "center",
          gap: nativeTheme.spacing.md,
          justifyContent: "center",
          padding: nativeTheme.spacing.xl,
        },
        style,
      ]}
    >
      <ActivityIndicator color={colors.primary} />
      {label ? <Typography variant="muted">{label}</Typography> : null}
    </View>
  );
}
