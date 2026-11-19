import React from "react";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { Card } from "@workspace/city-eyes-system/components/native/card";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";
import { Screen, ScreenScrollView } from "@/components/app-ui";

const previewSections = [
  { icon: "book-open" as const, title: "Planos de governo", description: "Consulte planos e prioridades publicados pelos candidatos." },
  { icon: "check-circle" as const, title: "Promessas", description: "Acompanhe compromissos de campanha e seu andamento." },
  { icon: "activity" as const, title: "Ações e prova", description: "Veja ações e evidências públicas, quando disponíveis." },
];

export default function PrometeuCumpriuScreen() {
  const colors = useColors();
  return (
    <Screen inTabs>
      <ScreenScrollView>
        <View style={styles.heading}>
          <Typography variant="eyebrow">TRANSPARÊNCIA POLÍTICA</Typography>
          <Typography variant="display">Prometeu cumpriu</Typography>
          <Typography variant="muted">
            Acompanhe os candidatos, seus planos de governo e o que fazem para cumprir cada promessa.
          </Typography>
          <View style={[styles.comingSoon, { backgroundColor: colors.secondary }]}>
            <Typography variant="small">Em breve</Typography>
          </View>
        </View>
        <View style={styles.cards}>
          {previewSections.map((s) => (
            <Card key={s.title} style={styles.card}>
              <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
                <Feather name={s.icon} size={19} color={colors.primary} />
              </View>
              <View style={styles.cardCopy}>
                <Typography variant="title">{s.title}</Typography>
                <Typography variant="muted">{s.description}</Typography>
              </View>
            </Card>
          ))}
        </View>
      </ScreenScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: nativeTheme.spacing.md, marginBottom: nativeTheme.spacing.sm, minWidth: 0 },
  comingSoon: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: nativeTheme.spacing.md, paddingVertical: nativeTheme.spacing.xs },
  cards: { gap: nativeTheme.spacing.md },
  card: { alignItems: "flex-start", flexDirection: "row", gap: nativeTheme.spacing.md, padding: nativeTheme.spacing.md },
  icon: { alignItems: "center", borderRadius: nativeTheme.radius, height: 40, justifyContent: "center", width: 40 },
  cardCopy: { flex: 1, gap: nativeTheme.spacing.xs, minWidth: 0 },
});
