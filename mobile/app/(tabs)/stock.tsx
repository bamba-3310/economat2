import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchArticles, fetchCategories } from "../../src/api/endpoints";
import type { Article, Category } from "../../src/api/types";
import { useI18n } from "../../src/lib/i18n";
import { articleStatus } from "../../src/lib/stock-rules";
import { theme, type } from "../../src/lib/theme";
import { Chip, Eyebrow } from "../../src/ui/kit";

const STATUS_TONE = { Critique: "danger", "Seuil bas": "warn", Stable: "ok" } as const;
const STATUS_ORDER = { Critique: 0, "Seuil bas": 1, Stable: 2 } as const;

export default function StockScreen() {
  const { t } = useI18n();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextArticles, nextCategories] = await Promise.all([
        fetchArticles(),
        fetchCategories(),
      ]);
      setArticles(nextArticles);
      setCategories(nextCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles
      .map((article) => {
        const category = categories.find((item) => item.id === article.category);
        return { article, category, status: articleStatus(article, category) };
      })
      .filter(
        ({ article, category }) =>
          !needle ||
          article.name.toLowerCase().includes(needle) ||
          category?.name.toLowerCase().includes(needle),
      )
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          a.article.name.localeCompare(b.article.name),
      );
  }, [articles, categories, query]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Eyebrow>Économat</Eyebrow>
        <Text style={type.display}>{t("Stock")}</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t("Rechercher un article")}
          placeholderTextColor={theme.muted}
          autoCorrect={false}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={({ article }) => String(article.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={{ color: theme.muted, paddingVertical: 24, textAlign: "center" }}>
            {t("Aucun article")}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.article.name}
              </Text>
              <Text style={styles.rowMeta}>{item.category?.name ?? ""}</Text>
            </View>
            <Text style={styles.rowQty}>
              {item.article.stock_quantity} {item.article.unit}
            </Text>
            <Chip label={t(item.status)} tone={STATUS_TONE[item.status]} />
          </View>
        )}
      />
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
  searchBox: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.ink,
    backgroundColor: theme.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.lineSoft,
  },
  rowName: {
    fontSize: 15,
    color: theme.ink,
    fontWeight: "500",
  },
  rowMeta: {
    fontSize: 12,
    color: theme.muted,
  },
  rowQty: {
    fontSize: 14,
    color: theme.ink,
    fontVariant: ["tabular-nums"],
  },
  error: {
    color: theme.danger,
    fontSize: 13,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
});
