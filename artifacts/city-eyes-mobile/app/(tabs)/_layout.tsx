import React from "react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, router, useGlobalSearchParams } from "expo-router";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { FloatingTabBar } from "@/components/floating-tab-bar";
import { parseCityId } from "@/components/app-ui";

export default function CityTabsLayout() {
  const colors = useColors();
  const params = useGlobalSearchParams<{ cityId?: string | string[] }>();
  const activeCityId = parseCityId(params.cityId);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
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
            <Feather
              name="plus"
              size={25}
              color={colors.accentForeground as string}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
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
