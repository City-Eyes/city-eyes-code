import React from "react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, router, useGlobalSearchParams } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { parseCityId } from "@/components/app-ui";

export default function CityTabsLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useGlobalSearchParams<{ cityId?: string | string[] }>();
  const activeCityId = parseCityId(params.cityId);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarShowLabel: false,
        tabBarBackground: () => (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
        ),
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          overflow: "visible",
          paddingBottom: Platform.OS === "web" ? 0 : insets.bottom,
          height: Platform.OS === "web" ? 84 : 64 + insets.bottom,
        },
        tabBarItemStyle: { alignItems: "center", flex: 1, justifyContent: "center", overflow: "visible" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Relatos",
          tabBarAccessibilityLabel: "Relatos",
          tabBarButtonTestID: "tab-reports",
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={size} color={typeof color === "string" ? color : (colors.primary as string)} />
          ),
        }}
      />
      <Tabs.Screen
        name="publish"
        listeners={{
          tabPress: (event) => {
            if (!activeCityId) return;
            event.preventDefault();
            router.push({ pathname: "/city/[cityId]/report/new", params: { cityId: activeCityId } });
          },
        }}
        options={{
          title: "Publicar",
          tabBarAccessibilityLabel: activeCityId ? "Publicar relato nesta cidade" : "Escolher cidade para publicar",
          tabBarButtonTestID: "tab-publish",
          tabBarIcon: () => (
            <View style={[styles.publishIcon, { backgroundColor: colors.accent }]}>
              <Feather
                name="plus"
                size={25}
                color={colors.accentForeground as string}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="prometeu-cumpriu"
        options={{
          title: "Prometeu cumpriu",
          tabBarAccessibilityLabel: "Prometeu cumpriu, em breve",
          tabBarButtonTestID: "tab-promises",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="check-decagram"
              size={size}
              color={typeof color === "string" ? color : (colors.primary as string)}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  publishIcon: { alignItems: "center", borderRadius: 999, height: 44, justifyContent: "center", width: 44 },
});
