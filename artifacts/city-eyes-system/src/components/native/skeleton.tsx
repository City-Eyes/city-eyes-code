import React from "react";
import { View, type DimensionValue, type ViewStyle } from "react-native";
import { useColors } from "../../hooks/use-colors";
import { nativeTheme } from "../../lib/native-theme";

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  style?: ViewStyle;
};

export function Skeleton({
  height = nativeTheme.spacing.xl,
  style,
  width = "100%",
}: SkeletonProps) {
  const colors = useColors();

  return (
    <View
      accessibilityLabel="Carregando"
      style={[
        {
          backgroundColor: colors.secondary,
          borderRadius: nativeTheme.radius,
          height,
          width,
        },
        style,
      ]}
    />
  );
}
