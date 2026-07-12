import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SessionProvider } from "../src/auth/session";
import { I18nProvider } from "../src/lib/i18n";
import { theme } from "../src/lib/theme";

export default function RootLayout() {
  return (
    <I18nProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
          }}
        />
      </SessionProvider>
    </I18nProvider>
  );
}
