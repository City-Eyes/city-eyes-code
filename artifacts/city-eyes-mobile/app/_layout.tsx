import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDesignSystemFonts } from "@workspace/city-eyes-system/hooks/use-fonts";
import { setBaseUrl } from "@workspace/api-client-react";
import { Stack } from "expo-router";

const publicDomain = process.env.EXPO_PUBLIC_DOMAIN;
if (!publicDomain) {
  throw new Error("EXPO_PUBLIC_DOMAIN must be set for the mobile API client.");
}
setBaseUrl(`https://${publicDomain}`);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="city/[cityId]" />
      <Stack.Screen name="city/[cityId]/report/[reportId]" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useDesignSystemFonts();

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
