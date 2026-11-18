import React, { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useColors } from "../../hooks/use-colors";
import { nativeTheme } from "../../lib/native-theme";
import { Typography } from "./typography";

export type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  children,
  disabled,
  size = "default",
  style,
  variant = "default",
  ...props
}: ButtonProps) {
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
      color: colors.foreground,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      color: colors.primary,
    },
    destructive: {
      backgroundColor: colors.destructive,
      borderColor: colors.destructive,
      color: colors.destructiveForeground,
    },
  }[variant];
  const dimensions = {
    sm: { minHeight: 36, paddingHorizontal: nativeTheme.spacing.md },
    default: { minHeight: 44, paddingHorizontal: nativeTheme.spacing.lg },
    lg: { minHeight: 52, paddingHorizontal: nativeTheme.spacing.xl },
    icon: { height: 44, width: 44, paddingHorizontal: 0 },
  }[size];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        dimensions,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        style,
      ]}
      {...props}
    >
      <Typography
        variant="body"
        style={[styles.label, { color: palette.color }]}
      >
        {children}
      </Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: nativeTheme.radius,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  label: {
    fontFamily: nativeTheme.fontFamily.semiBold,
  },
});
