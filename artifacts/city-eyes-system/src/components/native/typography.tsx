import React from "react";
import {
  Text,
  StyleSheet,
  type TextProps,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { useColors } from "../../hooks/use-colors";
import { nativeTheme, type NativeTypographyVariant } from "../../lib/native-theme";

export type TypographyProps = TextProps & {
  variant?: NativeTypographyVariant;
  style?: StyleProp<TextStyle>;
};

export function Typography({
  children,
  style,
  variant = "body",
  ...props
}: TypographyProps) {
  const colors = useColors();
  const variantStyle: Record<NativeTypographyVariant, TextStyle> = {
    display: {
      color: colors.foreground,
      fontFamily: nativeTheme.fontFamily.bold,
      fontSize: nativeTheme.typography.display,
      lineHeight: nativeTheme.typography.display * 1.16,
      letterSpacing: -0.6,
    },
    title: {
      color: colors.foreground,
      fontFamily: nativeTheme.fontFamily.bold,
      fontSize: nativeTheme.typography.title,
      lineHeight: nativeTheme.typography.title * 1.2,
      letterSpacing: -0.4,
    },
    body: {
      color: colors.foreground,
      fontFamily: nativeTheme.fontFamily.regular,
      fontSize: nativeTheme.typography.body,
      lineHeight: nativeTheme.typography.body * 1.5,
    },
    muted: {
      color: colors.mutedForeground,
      fontFamily: nativeTheme.fontFamily.regular,
      fontSize: nativeTheme.typography.small,
      lineHeight: nativeTheme.typography.small * 1.5,
    },
    small: {
      color: colors.foreground,
      fontFamily: nativeTheme.fontFamily.medium,
      fontSize: nativeTheme.typography.small,
      lineHeight: nativeTheme.typography.small * 1.4,
    },
    caption: {
      color: colors.mutedForeground,
      fontFamily: nativeTheme.fontFamily.medium,
      fontSize: nativeTheme.typography.caption,
      lineHeight: nativeTheme.typography.caption * 1.4,
    },
    eyebrow: {
      color: colors.mutedForeground,
      fontFamily: nativeTheme.fontFamily.bold,
      fontSize: nativeTheme.typography.caption,
      letterSpacing: 0.8,
      lineHeight: nativeTheme.typography.caption * 1.4,
      textTransform: "uppercase",
    },
  };

  return (
    <Text {...props} style={[styles.base, variantStyle[variant], style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
