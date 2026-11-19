import React, { type ReactNode } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  CityId as CityIds,
  type City,
  type CityId,
  type Report,
  type ReportCategory,
} from "@workspace/api-client-react";
import { Badge } from "@workspace/city-eyes-system/components/native/badge";
import { Button } from "@workspace/city-eyes-system/components/native/button";
import { Card } from "@workspace/city-eyes-system/components/native/card";
import { Empty } from "@workspace/city-eyes-system/components/native/empty";
import { Skeleton } from "@workspace/city-eyes-system/components/native/skeleton";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const cityIdValues = Object.values(CityIds) as CityId[];

export function parseCityId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && cityIdValues.includes(candidate as CityId)
    ? (candidate as CityId)
    : undefined;
}

const categoryLabels: Record<ReportCategory, string> = {
  accessibility: "Acessibilidade",
  drainage: "Drenagem",
  lighting: "Iluminação",
  "public-space": "Espaço público",
  waste: "Resíduos",
};

const categoryIcons: Record<ReportCategory, keyof typeof Feather.glyphMap> = {
  accessibility: "users",
  drainage: "cloud-rain",
  lighting: "sun",
  "public-space": "map-pin",
  waste: "trash-2",
};

export function categoryLabel(category: ReportCategory) {
  return categoryLabels[category];
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const paddingTop =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const paddingBottom =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingBottom, paddingTop },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ScreenScrollView(props: ScrollViewProps) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
      contentContainerStyle={[
        styles.content,
        props.contentContainerStyle,
      ]}
    />
  );
}

export function BrandHeader() {
  const colors = useColors();
  return (
    <View style={styles.brandHeader}>
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.brandIcon}
        accessibilityLabel="Símbolo do Olhar Cidadão"
      />
      <View style={styles.brandCopy}>
        <Typography variant="small" style={styles.brandName}>
          Olhar Cidadão
        </Typography>
        <Typography variant="caption">relatos urbanos por cidade</Typography>
      </View>
      <Feather name="eye" size={20} color={colors.primary} />
    </View>
  );
}

export function BackHeader({
  onPress,
  label,
}: {
  onPress: () => void;
  label: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="back-button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.backHeader,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Feather name="arrow-left" size={20} color={colors.primary} />
      <Typography variant="small" style={{ color: colors.primary }}>
        {label}
      </Typography>
    </Pressable>
  );
}

export function DemoNotice() {
  const colors = useColors();

  return (
    <Card style={styles.demoNotice}>
      <Feather name="info" size={18} color={colors.accent} />
      <View style={styles.demoCopy}>
        <Typography variant="eyebrow" style={{ color: colors.accent }}>
          Informação importante
        </Typography>
        <Typography variant="muted">
          Relatos enviados ficam públicos, mas não são encaminhados automaticamente à prefeitura.
        </Typography>
      </View>
    </Card>
  );
}

export function CityCard({
  city,
  onPress,
}: {
  city: City;
  onPress: () => void;
}) {
  const colors = useColors();
  const reportText =
    city.reportCount === 1
      ? "1 relato público"
      : `${city.reportCount} relatos públicos`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${city.name}, ${reportText}`}
      testID={`city-${city.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressableCard,
        { opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <Card style={styles.cityCard}>
        <View style={styles.cityText}>
          <Typography variant="title">{city.name}</Typography>
          <Typography variant="muted">
            {city.state} · {reportText}
          </Typography>
        </View>
        <View
          style={[
            styles.cityArrow,
            { backgroundColor: colors.secondary },
          ]}
        >
          <Feather name="arrow-up-right" size={18} color={colors.primary} />
        </View>
      </Card>
    </Pressable>
  );
}

export function ReportCard({
  report,
  onPress,
}: {
  report: Report;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir relato: ${report.title}`}
      testID={`report-${report.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressableCard,
        { opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <Card style={styles.reportCard}>
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: colors.secondary },
          ]}
        >
          <Feather
            name={categoryIcons[report.category]}
            size={18}
            color={colors.primary}
          />
        </View>
        <View style={styles.reportCopy}>
          <Typography variant="small" numberOfLines={2}>
            {report.title}
          </Typography>
          <Typography variant="caption" style={styles.reportMeta}>
            {categoryLabels[report.category]} · {formatDate(report.createdAt)}
          </Typography>
          <Typography variant="caption">{report.locationLabel}</Typography>
          <Typography variant="caption">
            {report.isDemo ? "Registro demonstrativo" : "Relato publicado"}
          </Typography>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Card>
    </Pressable>
  );
}

export function ReportDemoBadge() {
  return <Badge variant="secondary">Relato demonstrativo</Badge>;
}

export function EmptyError({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  const colors = useColors();

  return (
    <Empty
      icon={<Feather name="alert-circle" size={20} color={colors.destructive} />}
      title={title}
      description={description}
      action={
        <Button variant="outline" onPress={onRetry}>
          Tentar novamente
        </Button>
      }
    />
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.loadingList}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={`skeleton-${index}`} style={styles.loadingCard}>
          <Skeleton width="55%" height={nativeTheme.spacing.lg} />
          <Skeleton width="82%" height={nativeTheme.spacing.md} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
  },
  content: {
    flexGrow: 1,
    gap: nativeTheme.spacing.lg,
    paddingHorizontal: nativeTheme.spacing.lg,
    paddingTop: nativeTheme.spacing.lg,
    paddingBottom: nativeTheme.spacing.xl,
    width: "100%",
  },
  brandHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: nativeTheme.spacing.md,
    marginBottom: nativeTheme.spacing.xs,
  },
  brandIcon: {
    borderRadius: nativeTheme.radius,
    height: 36,
    width: 36,
  },
  brandCopy: {
    flex: 1,
    gap: nativeTheme.spacing.xs,
  },
  brandName: {
    letterSpacing: 1,
  },
  backHeader: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: nativeTheme.spacing.sm,
    minHeight: 44,
    paddingRight: nativeTheme.spacing.md,
  },
  demoNotice: {
    alignItems: "flex-start",
    backgroundColor: "transparent",
    flexDirection: "row",
    gap: nativeTheme.spacing.md,
    padding: nativeTheme.spacing.md,
  },
  demoCopy: {
    flex: 1,
    gap: nativeTheme.spacing.xs,
  },
  pressableCard: {
    width: "100%",
  },
  cityCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: nativeTheme.spacing.md,
    minHeight: 82,
  },
  cityText: {
    flex: 1,
    gap: nativeTheme.spacing.xs,
  },
  cityArrow: {
    alignItems: "center",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  reportCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: nativeTheme.spacing.md,
    padding: nativeTheme.spacing.md,
  },
  categoryIcon: {
    alignItems: "center",
    borderRadius: nativeTheme.radius,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  reportCopy: {
    flex: 1,
    gap: nativeTheme.spacing.xs,
  },
  reportMeta: {
    marginTop: nativeTheme.spacing.xs,
  },
  loadingList: {
    gap: nativeTheme.spacing.md,
  },
  loadingCard: {
    gap: nativeTheme.spacing.md,
  },
});
