import { Redirect, Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSession } from "../../src/auth/session";
import { useI18n } from "../../src/lib/i18n";
import { theme } from "../../src/lib/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.35 }}>{label}</Text>
  );
}

export default function TabsLayout() {
  const { user, ready } = useSession();
  const { t } = useI18n();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.ink} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.ink,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("Scanner"),
          tabBarIcon: ({ focused }) => <TabIcon label="▣" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: t("Stock"),
          tabBarIcon: ({ focused }) => <TabIcon label="≡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("Réglages"),
          tabBarIcon: ({ focused }) => <TabIcon label="◦" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
