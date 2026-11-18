import React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { useColors } from "../../hooks/use-colors";
import { nativeTheme } from "../../lib/native-theme";

export type CardProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, style, ...props }: CardProps) {
  const colors = useColors();

  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: nativeTheme.radius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: nativeTheme.spacing.lg,
  },
});
