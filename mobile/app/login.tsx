import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getServerUrl } from "../src/api/client";
import { useSession } from "../src/auth/session";
import { useI18n } from "../src/lib/i18n";
import { theme, type } from "../src/lib/theme";
import { Button, Eyebrow, Field } from "../src/ui/kit";

export default function LoginScreen() {
  const { user, signIn } = useSession();
  const { t } = useI18n();

  const [serverUrl, setServerUrlInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getServerUrl().then((stored) => {
      if (stored) setServerUrlInput(stored);
    });
  }, []);

  if (user) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    const url = serverUrl.trim().replace(/\/+$/, "");
    if (!url || !email.trim() || !password) {
      setError(t("Champs requis."));
      return;
    }
    setError("");
    setBusy(true);
    try {
      await signIn(url, email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4, marginBottom: 32 }}>
          <Eyebrow>Économat</Eyebrow>
          <Text style={type.display}>{t("Connexion")}</Text>
        </View>

        <View style={{ gap: 16 }}>
          <Field
            label={t("Adresse du serveur")}
            value={serverUrl}
            onChangeText={setServerUrlInput}
            placeholder="http://192.168.1.20:8000"
            keyboardType="url"
            autoCorrect={false}
          />
          <Field
            label={t("Email")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCorrect={false}
            autoComplete="email"
          />
          <Field
            label={t("Mot de passe")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={busy ? t("Connexion...") : t("Se connecter")}
            onPress={() => void submit()}
            loading={busy}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  error: {
    color: theme.danger,
    fontSize: 13,
  },
});
