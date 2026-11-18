import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Button } from "@workspace/city-eyes-system/components/native/button";
import { Empty } from "@workspace/city-eyes-system/components/native/empty";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { Screen } from "@/components/app-ui";
import { StyleSheet, View } from "react-native";

export default function NotFoundScreen() {
  const colors = useColors();

  return (
    <Screen>
      <View style={styles.container}>
        <Empty
          icon={<Feather name="map-pin" size={20} color={colors.primary} />}
          title="Esta tela não existe"
          description="Volte à consulta pública e escolha uma cidade."
          action={<Button onPress={() => router.replace("/")}>Ir para cidades</Button>}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
});
