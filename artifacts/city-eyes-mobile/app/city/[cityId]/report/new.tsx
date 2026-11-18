import React, { useEffect, useState } from "react";
import { Image, Linking, Platform, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as ImageManipulator from "expo-image-manipulator";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { getListCityReportsQueryKey, useCreateCityReport, useRequestUploadUrl, type ReportInput, type ReportInputCategory } from "@workspace/api-client-react";
import { Button } from "@workspace/city-eyes-system/components/native/button";
import { Card } from "@workspace/city-eyes-system/components/native/card";
import { Empty } from "@workspace/city-eyes-system/components/native/empty";
import { Skeleton } from "@workspace/city-eyes-system/components/native/skeleton";
import { Typography } from "@workspace/city-eyes-system/components/native/typography";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";
import { nativeTheme } from "@workspace/city-eyes-system/lib/native-theme";
import { BackHeader, Screen } from "@/components/app-ui";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { parseCityId } from "@/components/app-ui";
import { useAuth } from "@/lib/auth";
import { draftKeyFor } from "@/lib/protected-cache";

type Draft = { title: string; description: string; category: ReportInputCategory; locationLabel: string; latitude: string; longitude: string; uri: string; captureSource: "camera" | "gallery"; consent: boolean };
const initialDraft: Draft = { title: "", description: "", category: "accessibility", locationLabel: "", latitude: "", longitude: "", uri: "", captureSource: "gallery", consent: false };
const categories: { value: ReportInputCategory; label: string }[] = [
  { value: "accessibility", label: "Acessibilidade" }, { value: "drainage", label: "Drenagem" },
  { value: "lighting", label: "Iluminação" }, { value: "public-space", label: "Espaço público" }, { value: "waste", label: "Resíduos" },
];

export default function NewReportScreen() {
  const params = useLocalSearchParams<{ cityId?: string | string[] }>();
  const cityId = parseCityId(params.cityId);
  const colors = useColors();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const requestUpload = useRequestUploadUrl();
  const createReport = useCreateCityReport();
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [galleryPermission, requestGalleryPermission] = ImagePicker.useMediaLibraryPermissions();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const draftKey = auth.user && cityId ? draftKeyFor(auth.user.id, cityId) : null;
  const [hydrated, setHydrated] = useState<string | null>(null);
  const active = React.useRef(true);
  useEffect(() => () => { active.current = false; }, []);

  useEffect(() => {
    let mounted = true;
    setHydrated(null);
    setDraft(initialDraft);
    if (!draftKey) return;
    void AsyncStorage.removeItem(`city-eyes-report-draft-${cityId}`).catch(() => undefined);
    void AsyncStorage.getItem(draftKey).then((stored) => {
      if (mounted && stored) {
        try { setDraft({ ...initialDraft, ...JSON.parse(stored) as Partial<Draft>, consent: false }); } catch { setError("O rascunho salvo não pôde ser recuperado."); }
      }
      if (mounted) setHydrated(draftKey);
    }).catch(() => { if (mounted) setError("Não foi possível abrir o rascunho neste aparelho."); });
    return () => { mounted = false; };
  }, [cityId, draftKey]);
  useEffect(() => {
    if (!draftKey || hydrated !== draftKey || success) return;
    void AsyncStorage.setItem(draftKey, JSON.stringify({ ...draft, consent: false }))
      .catch(() => setError("Não foi possível salvar o rascunho neste aparelho."));
  }, [draft, hydrated, draftKey, success]);

  const update = (key: keyof Draft, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const selectPhoto = async (source: "camera" | "gallery") => {
    setError("");
    try {
      if (source === "camera" && !cameraPermission?.granted) {
        const permissionResult = await requestCameraPermission();
        if (!permissionResult.granted) {
          setError(permissionResult.canAskAgain
            ? "A permissão da câmera não foi concedida. Você pode tentar novamente ou escolher uma foto da galeria."
            : "A permissão da câmera está desativada nas configurações. Use a galeria ou altere a permissão nas configurações.");
          return;
        }
      }
      if (source === "gallery" && !galleryPermission?.granted) {
        const permissionResult = await requestGalleryPermission();
        if (!permissionResult.granted) {
          setError(permissionResult.canAskAgain
            ? "A permissão da galeria não foi concedida. Você pode tentar novamente ou usar a câmera."
            : "A permissão da galeria está desativada nas configurações. Use a câmera ou altere a permissão nas configurações.");
          return;
        }
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const resize = Math.max(asset.width, asset.height) > 2048
        ? asset.width >= asset.height
          ? [{ resize: { width: 2048 } }]
          : [{ resize: { height: 2048 } }]
        : [];
      const jpeg = await ImageManipulator.manipulateAsync(asset.uri, resize, { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
      setDraft((current) => ({ ...current, uri: jpeg.uri, captureSource: source }));
    } catch {
      setError("Não foi possível selecionar a imagem. Tente novamente.");
    }
  };
  const locate = async () => {
    setError("");
    try {
      const current = await Location.requestForegroundPermissionsAsync();
      setPermission(current);
      if (!current.granted) return;
      const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDraft((value) => ({ ...value, latitude: String(point.coords.latitude), longitude: String(point.coords.longitude) }));
    } catch {
      setError("Não foi possível obter a localização. Você pode inserir as coordenadas manualmente.");
    }
  };
  const submit = async () => {
    if (!cityId || !auth.user || !draftKey || hydrated !== draftKey) { router.push("/auth"); return; }
    if (!draft.uri || !draft.consent || !draft.title.trim() || !draft.description.trim() || !draft.locationLabel.trim() || !Number.isFinite(Number(draft.latitude)) || !Number.isFinite(Number(draft.longitude))) {
      setError("Revise os campos obrigatórios, adicione uma foto e confirme a publicação.");
      return;
    }
    setBusy(true); setError("");
    try {
      await AsyncStorage.setItem(draftKey, JSON.stringify({ ...draft, consent: false }));
      if (!active.current) return;
      const file = new File(draft.uri);
      if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > 10 * 1024 * 1024) {
        throw new Error("Tamanho de foto inválido");
      }
      const upload = await requestUpload.mutateAsync({ data: { size: file.size, contentType: "image/jpeg" } });
      if (!active.current) return;
      const response = await fetch(upload.uploadURL, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: file });
      if (!response.ok) throw new Error("Falha ao enviar a foto");
      if (!active.current) return;
      const body: ReportInput = {
        title: draft.title.trim(), description: draft.description.trim(), category: draft.category,
        locationLabel: draft.locationLabel.trim(), latitude: Number(draft.latitude), longitude: Number(draft.longitude),
        captureSource: draft.captureSource, imageObjectPath: upload.objectPath, consentToPublicDisplay: true,
      };
      await createReport.mutateAsync({ cityId, data: body });
      setSuccess(true);
      void queryClient.invalidateQueries({
        queryKey: getListCityReportsQueryKey(cityId, { page: 1, limit: 50 }),
      }).catch(() => undefined);
      await AsyncStorage.removeItem(draftKey).catch(() => undefined);
    } catch {
      setError("O envio não foi concluído. Seus campos e a foto continuam salvos neste aparelho; tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAwareScrollViewCompat style={styles.flex} contentContainerStyle={styles.content} bottomOffset={nativeTheme.spacing.xl}>
        <BackHeader label="Voltar à cidade" onPress={() => cityId ? router.replace({ pathname: "/city/[cityId]", params: { cityId } }) : router.back()} />
        <View style={styles.heading}>
          <Typography variant="eyebrow">NOVO RELATO</Typography>
          <Typography variant="display">Mostre o que precisa de atenção</Typography>
          <Typography variant="muted">Um relato não é enviado automaticamente à prefeitura. Ele entra no diretório público desta cidade.</Typography>
        </View>
        {auth.isLoading ? (
          <Card style={styles.fieldGroup}>
            <Skeleton width="65%" />
            <Skeleton width="40%" />
          </Card>
        ) : null}
        {!auth.isLoading && !auth.user ? (
          <Card style={styles.fieldGroup}>
            <Typography variant="title">Entre para enviar</Typography>
            <Typography variant="muted">É necessária uma conta para publicar um relato.</Typography>
            {auth.error ? <Typography variant="muted">{auth.error}</Typography> : null}
            <Button testID="report-sign-in" onPress={() => router.push("/auth")}>Entrar</Button>
          </Card>
        ) : null}
        {success ? (
          <Empty title="Relato enviado" description="O relato foi publicado no diretório desta cidade. Ele não foi encaminhado automaticamente à prefeitura." action={<Button testID="report-success-back" onPress={() => cityId ? router.replace({ pathname: "/city/[cityId]", params: { cityId } }) : router.replace("/")}>Voltar à cidade</Button>} />
        ) : auth.user && !auth.isLoading && hydrated === draftKey ? (
          <>
            <Card style={styles.fieldGroup}>
              <Typography variant="title">1. Foto do local</Typography>
              <Typography variant="muted">A imagem será convertida para JPEG antes do envio. Não usamos metadados para afirmar autenticidade. A foto fica no diretório por 30 dias.</Typography>
              <View style={styles.actions}>
                <Button testID="report-camera" variant="outline" onPress={() => void selectPhoto("camera")}>Abrir câmera</Button>
                <Button testID="report-gallery" variant="outline" onPress={() => void selectPhoto("gallery")}>Escolher foto</Button>
              </View>
              {cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain && Platform.OS !== "web" ? <Button testID="report-camera-settings" variant="outline" onPress={() => void Linking.openSettings()}>Abrir configurações</Button> : null}
              {galleryPermission && !galleryPermission.granted && !galleryPermission.canAskAgain && Platform.OS !== "web" ? <Button testID="report-gallery-settings" variant="outline" onPress={() => void Linking.openSettings()}>Abrir configurações da galeria</Button> : null}
              {draft.uri ? <Image source={{ uri: draft.uri }} accessibilityLabel="Prévia da foto selecionada" style={styles.photo} /> : null}
            </Card>
            <Card style={styles.fieldGroup}>
              <Typography variant="title">2. Revise a localização</Typography>
              <Typography variant="muted">Use sua localização atual ou ajuste os dados manualmente antes de publicar.</Typography>
              <Button testID="report-location" variant="outline" onPress={() => void locate()}>Usar localização atual</Button>
              {permission && !permission.granted ? (
                <View style={styles.fieldGroup}>
                  <Typography variant="muted">A permissão de localização não foi concedida. Você pode preencher as coordenadas manualmente.</Typography>
                  {!permission.canAskAgain && Platform.OS !== "web" ? <Button testID="report-open-settings" variant="outline" onPress={() => void Linking.openSettings()}>Abrir configurações</Button> : <Button testID="report-location-retry" variant="outline" onPress={() => void locate()}>Tentar permissão novamente</Button>}
                </View>
              ) : null}
              <Field label="Localização em palavras" value={draft.locationLabel} onChangeText={(value) => update("locationLabel", value)} placeholder="Ex.: esquina da Rua A com a Rua B" testID="report-location-label" />
              <View style={styles.actions}>
               <Field label="Latitude" value={draft.latitude} onChangeText={(value) => update("latitude", value)} placeholder="-25.43" keyboardType="numbers-and-punctuation" testID="report-latitude" />
               <Field label="Longitude" value={draft.longitude} onChangeText={(value) => update("longitude", value)} placeholder="-49.27" keyboardType="numbers-and-punctuation" testID="report-longitude" />
              </View>
            </Card>
            <Card style={styles.fieldGroup}>
              <Typography variant="title">3. Descreva o problema</Typography>
              <Field label="Título" value={draft.title} onChangeText={(value) => update("title", value)} placeholder="Um resumo claro" maxLength={120} testID="report-title" />
              <Field label="Descrição" value={draft.description} onChangeText={(value) => update("description", value)} placeholder="O que está acontecendo? Inclua detalhes úteis." multiline maxLength={2000} testID="report-description" />
              <Typography variant="small">Categoria</Typography>
              <View style={styles.categories}>
                {categories.map((category) => <Button key={category.value} testID={`report-category-${category.value}`} size="sm" variant={draft.category === category.value ? "default" : "outline"} onPress={() => update("category", category.value)}>{category.label}</Button>)}
              </View>
            </Card>
            <Card style={styles.fieldGroup}>
              <Typography variant="title">4. Publicação e consentimento</Typography>
              <Typography variant="muted">Ao enviar, a foto, o texto e a localização deste relato ficam públicos no diretório da cidade. A foto será removida depois de 30 dias; o texto e a localização permanecem. O envio não significa que a prefeitura recebeu ou assumiu o atendimento.</Typography>
              <Button testID="report-public-consent" accessibilityRole="checkbox" accessibilityState={{ checked: draft.consent }} variant={draft.consent ? "secondary" : "outline"} onPress={() => update("consent", !draft.consent)}>
                {draft.consent ? "Autorizado: foto, texto e localização públicos" : "Autorizo a exibição pública da foto, do texto e da localização"}
              </Button>
              {error ? <Typography variant="muted" style={{ color: colors.destructive }}>{error}</Typography> : null}
              {busy ? <Typography variant="muted">Enviando a foto e publicando o relato… Não feche esta tela.</Typography> : null}
              <Button testID="report-submit" disabled={busy || auth.isLoading || !auth.user} onPress={() => void submit()}>{busy ? "Enviando…" : "Enviar relato"}</Button>
            </Card>
          </>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; testID: string; multiline?: boolean; maxLength?: number; keyboardType?: "numbers-and-punctuation" }) {
  const colors = useColors();
  return <View style={styles.field}>
    <Typography variant="small">{props.label}</Typography>
    <TextInput
      testID={props.testID} value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder}
      placeholderTextColor={colors.mutedForeground} keyboardType={props.keyboardType} multiline={props.multiline}
      maxLength={props.maxLength} textAlignVertical={props.multiline ? "top" : "center"}
      style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }, props.multiline ? styles.multiline : null]}
    />
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, gap: nativeTheme.spacing.md, paddingHorizontal: nativeTheme.spacing.lg, paddingTop: nativeTheme.spacing.lg, paddingBottom: nativeTheme.spacing.xl },
  heading: { gap: nativeTheme.spacing.sm },
  fieldGroup: { gap: nativeTheme.spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: nativeTheme.spacing.sm },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: nativeTheme.spacing.xs },
  photo: { width: "100%", height: 220, borderRadius: nativeTheme.radius },
  field: { flex: 1, minWidth: 130, gap: nativeTheme.spacing.xs },
  input: { borderWidth: 1, borderRadius: nativeTheme.radius, minHeight: 46, paddingHorizontal: nativeTheme.spacing.md, paddingVertical: nativeTheme.spacing.sm, fontFamily: nativeTheme.fontFamily.regular, fontSize: nativeTheme.typography.body },
  multiline: { minHeight: 120 },
});
