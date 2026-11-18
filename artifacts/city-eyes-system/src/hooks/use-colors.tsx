import { useColorScheme } from "react-native";
import { nativeTheme } from "../lib/native-theme";

export function useColors() {
  const colorScheme = useColorScheme();
  return nativeTheme.colors[colorScheme === "dark" ? "dark" : "light"];
}
