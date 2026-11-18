import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useColors } from "../../hooks/use-colors";
import { nativeTheme } from "../../lib/native-theme";
import { Typography } from "./typography";

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export type BadgeProps = ViewProps & {
  variant?: BadgeVariant;
};

export function Badge({
  children,
  style,
  variant = "secondary",
  ...props
}: BadgeProps) {
  const colors = useColors();
  const palette = {
    default: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      color: colors.primaryForeground,
    },
    secondary: {
      backgroundColor: colors.secondary,
      borderColor: colors.secondary,
      color: colors.secondaryForeground,
    },
    outline: {
      backgroundColor: "transparent",
      borderColor: colors.border,
      color: colors.mutedForeground,
    },
    destructive: {
      backgroundColor: colors.destructive,
      borderColor: colors.destructive,
      color: colors.destructiveForeground,
    },
  }[variant];

  return (
    <View
      {...props}
      style={[
        styles.badge,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        style,
      ]}
    >
      <Typography variant="eyebrow" style={{ color: palette.color }}>
        {children}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: nativeTheme.spacing.md,
    paddingVertical: nativeTheme.spacing.xs,
  },
});
