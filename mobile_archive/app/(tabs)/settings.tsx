import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getServerUrl } from "../../src/api/client";
import { useSession } from "../../src/auth/session";
import { useI18n } from "../../src/lib/i18n";
import { theme, type } from "../../src/lib/theme";
import { Button, Card, Eyebrow, Row } from "../../src/ui/kit";

export default function SettingsScreen() {
  const { user, signOut } = useSession();
  const { t, lang, setLang } = useI18n();
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    void getServerUrl().then((stored) => setServerUrl(stored ?? ""));
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={{ gap: 2, marginBottom: 8 }}>
          <Eyebrow>Économat</Eyebrow>
          <Text style={type.display}>{t("Réglages")}</Text>
        </View>

        <Card>
          <Eyebrow>{t("Compte")}</Eyebrow>
          <Row label={t("Email")} value={user?.email ?? "—"} />
          <Row label="Rôle" value={user?.role ?? "—"} />
          <Row label={t("Compte")} value={user?.name ?? "—"} />
        </Card>

        <Card>
          <Eyebrow>{t("Serveur")}</Eyebrow>
          <Text style={{ color: theme.ink, fontSize: 14 }}>{serverUrl || "—"}</Text>
        </Card>

        <Card>
          <Eyebrow>{t("Langue")}</Eyebrow>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label={t("Français")}
                variant={lang === "fr" ? "primary" : "line"}
                onPress={() => setLang("fr")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t("Anglais")}
                variant={lang === "en" ? "primary" : "line"}
                onPress={() => setLang("en")}
              />
            </View>
          </View>
        </Card>

        <Button
          label={t("Se déconnecter")}
          variant="danger"
          onPress={() => void signOut()}
        />

        <Text style={styles.version}>{t("Version")} 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  body: {
    padding: 20,
    gap: 16,
  },
  version: {
    color: theme.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
