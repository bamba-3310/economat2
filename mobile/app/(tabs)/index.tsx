import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  activateLot,
  exitLot,
  fetchArticles,
  fetchBatches,
  fetchCategories,
} from "../../src/api/endpoints";
import type { Article, Batch, Category } from "../../src/api/types";
import { useI18n } from "../../src/lib/i18n";
import { parseLotQrValue } from "../../src/lib/qr";
import { evaluateScan, isExpired, type ScanDecision } from "../../src/lib/stock-rules";
import { theme, type } from "../../src/lib/theme";
import { Button, Card, Chip, Eyebrow, Row, Stepper } from "../../src/ui/kit";

type ScanResult =
  | { kind: "unknown"; raw: string }
  | {
      kind: "lot";
      batch: Batch;
      article: Article;
      category?: Category;
      decision: ScanDecision;
    };

function formatDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function ScanScreen() {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();

  const [focused, setFocused] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [manual, setManual] = useState("");
  const [quantityOut, setQuantityOut] = useState(1);
  const [busyAction, setBusyAction] = useState<"activate" | "exit" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const scanLockRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const resolveScan = useCallback(
    async (raw: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setResolving(true);
      setError("");
      setFeedback("");
      setQuantityOut(1);
      try {
        const parsed = parseLotQrValue(raw);
        if (!parsed.lotCode && parsed.lotId === undefined) {
          setResult({ kind: "unknown", raw });
          return;
        }
        // Always refetch on scan so quantities and statuses are current —
        // PostgreSQL stays the single source of truth.
        const [batches, articles, categories] = await Promise.all([
          fetchBatches(),
          fetchArticles(),
          fetchCategories(),
        ]);
        const code = parsed.lotCode?.toLowerCase();
        const batch =
          batches.find((item) => item.code && item.code.toLowerCase() === code) ??
          (parsed.lotId !== undefined
            ? batches.find((item) => item.id === parsed.lotId)
            : undefined);
        if (!batch) {
          setResult({ kind: "unknown", raw });
          return;
        }
        const article = articles.find((item) => item.id === batch.article);
        if (!article) {
          setResult({ kind: "unknown", raw });
          return;
        }
        const category = categories.find((item) => item.id === article.category);
        const decision = evaluateScan({
          batch,
          article,
          category,
          allBatches: batches,
          quantityOut: 1,
        });
        setResult({ kind: "lot", batch, article, category, decision });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        scanLockRef.current = false;
      } finally {
        setResolving(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    scanLockRef.current = false;
    setResult(null);
    setFeedback("");
    setError("");
    setManual("");
    setQuantityOut(1);
  }, []);

  const runAction = useCallback(
    async (action: "activate" | "exit") => {
      if (!result || result.kind !== "lot") return;
      setBusyAction(action);
      setError("");
      try {
        if (action === "activate") {
          await activateLot(result.batch);
          setFeedback(t("Lot activé."));
        } else {
          await exitLot(result.batch, quantityOut);
          setFeedback(t("Sortie enregistrée."));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyAction(null);
      }
    },
    [result, quantityOut, t],
  );

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.permissionBox}>
          <Eyebrow>{t("Scanner un lot")}</Eyebrow>
          <Text style={{ color: theme.muted, textAlign: "center" }}>
            {t("La caméra est nécessaire pour scanner les QR codes des lots.")}
          </Text>
          <Button label={t("Autoriser la caméra")} onPress={() => void requestPermission()} />
        </View>
      </SafeAreaView>
    );
  }

  const showCamera = focused && !result && !resolving;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Eyebrow>Économat</Eyebrow>
        <Text style={type.display}>{t("Scanner un lot")}</Text>
      </View>

      <View style={styles.cameraBox}>
        {showCamera ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => void resolveScan(data)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scannerBg }]} />
        )}
        <View pointerEvents="none" style={styles.reticle} />
        {resolving ? (
          <Text style={styles.cameraHint}>{t("Lecture en cours...")}</Text>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {!result ? (
          <Card>
            <Eyebrow>{t("Saisie manuelle")}</Eyebrow>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={styles.manualInput}
                value={manual}
                onChangeText={setManual}
                placeholder={t("Code du lot (LC-...)")}
                placeholderTextColor={theme.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={() => manual.trim() && void resolveScan(manual)}
              />
              <Button
                label={t("Rechercher")}
                variant="line"
                onPress={() => manual.trim() && void resolveScan(manual)}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Card>
        ) : result.kind === "unknown" ? (
          <Card>
            <Chip label={t("QR non référencé")} tone="warn" />
            <Text style={{ color: theme.muted, fontSize: 13 }}>{result.raw}</Text>
            <Button label={t("Scanner à nouveau")} variant="line" onPress={reset} />
          </Card>
        ) : (
          <Card>
            <View style={styles.lotHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <Eyebrow>{result.category?.name ?? ""}</Eyebrow>
                <Text style={[type.display, { fontSize: 18 }]} numberOfLines={2}>
                  {result.article.name}
                </Text>
              </View>
              <Chip
                label={
                  isExpired(result.batch)
                    ? t("Expiré")
                    : result.batch.status === "in_service"
                      ? t("En service")
                      : t("En réserve")
                }
                tone={
                  isExpired(result.batch)
                    ? "danger"
                    : result.batch.status === "in_service"
                      ? "ok"
                      : "neutral"
                }
              />
            </View>

            <View>
              <Row label={t("Lot")} value={result.batch.code ?? `#${result.batch.id}`} />
              <Row
                label={t("Qté restante")}
                value={`${result.batch.quantity} ${result.article.unit}`}
              />
              <Row label={t("Exp.")} value={formatDate(result.batch.expiry_date)} />
            </View>

            <Text
              style={{
                fontSize: 13,
                color:
                  result.decision.severity === "blocked"
                    ? theme.danger
                    : result.decision.severity === "warning"
                      ? theme.warn
                      : theme.ok,
              }}
            >
              {t(result.decision.reason)}
            </Text>

            {feedback ? (
              <>
                <Text style={{ color: theme.ok, fontSize: 14, fontWeight: "600" }}>
                  {feedback}
                </Text>
                <Button label={t("Scanner à nouveau")} onPress={reset} />
              </>
            ) : (
              <>
                {result.decision.canExit ? (
                  <View style={{ gap: 10 }}>
                    <Eyebrow>{t("Quantité")}</Eyebrow>
                    <Stepper
                      value={quantityOut}
                      onChange={setQuantityOut}
                      min={1}
                      max={result.batch.quantity}
                    />
                    <Button
                      label={t("Enregistrer la sortie")}
                      onPress={() => void runAction("exit")}
                      loading={busyAction === "exit"}
                      disabled={busyAction !== null}
                    />
                  </View>
                ) : null}
                {result.decision.canActivate ? (
                  <Button
                    label={t("Mettre en service")}
                    variant={result.decision.canExit ? "line" : "primary"}
                    onPress={() => void runAction("activate")}
                    loading={busyAction === "activate"}
                    disabled={busyAction !== null}
                  />
                ) : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label={t("Annuler")} variant="ghost" onPress={reset} />
              </>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 2,
  },
  permissionBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  cameraBox: {
    height: 260,
    marginHorizontal: 20,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: theme.scannerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  reticle: {
    width: 150,
    height: 150,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 2,
  },
  cameraHint: {
    position: "absolute",
    bottom: 12,
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  body: {
    padding: 20,
    gap: 16,
  },
  manualInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.ink,
    backgroundColor: theme.surface,
  },
  lotHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  error: {
    color: theme.danger,
    fontSize: 13,
  },
});
