"use client";

import { useState } from "react";
import { ChevronRight, Search, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  useAppData,
  hasClientPermission,
  type StockStatusFilterValue,
} from "@/lib/app-data";
import { useCompactMobile } from "@/lib/hooks";
import type { Category, Lot, Product, StockStatus } from "@/types/domain";
import { Eyebrow, EmptyState, StatusChip } from "@/components/ui/kit";
import SemiCircleStock from "@/components/stock/SemiCircleStock";
import ProductDetail from "@/components/stock/ProductDetail";

const statusFilters: StockStatusFilterValue[] = [
  "all",
  "Critique",
  "Seuil bas",
  "Bientôt expiré",
  "Stable",
  "Expiré",
];

export default function StockView({
  categoryId,
  filteredProducts,
  selectedProduct,
  selectedLots,
  selectedCategoryName,
  stockSearch,
  stockStatus,
  onCategoryChange,
  onSearchChange,
  onSelectProduct,
  onStatusChange,
  onFocusLot,
}: {
  categoryId: string;
  filteredProducts: Product[];
  selectedProduct: Product;
  selectedLots: Lot[];
  selectedCategoryName: string;
  stockSearch: string;
  stockStatus: StockStatusFilterValue;
  onCategoryChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSelectProduct: (id: string) => void;
  onStatusChange: (value: StockStatusFilterValue) => void;
  onFocusLot: (lotId: string) => void;
}) {
  const { t } = useI18n();
  const { categories, currentUser, deleteCategory, products } = useAppData();
  const isCompact = useCompactMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const canManageCategories = hasClientPermission(currentUser, [
    "manage_categories",
    "edit_thresholds",
  ]);

  async function handleDeleteCategory(category: Category) {
    if (!window.confirm(`${t("Supprimer la catégorie")} « ${category.name} » ?`)) return;
    if (categoryId === category.id) onCategoryChange("all");
    const result = await deleteCategory({ categoryId: category.id });
    if (!result.ok) window.alert(t(result.message ?? "Suppression impossible."));
  }

  function openOnMobile(id: string) {
    onSelectProduct(id);
    setSheetOpen(true);
  }

  function resetFilters() {
    onCategoryChange("all");
    onSearchChange("");
    onStatusChange("all");
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="view-head">
        <div>
          <Eyebrow>
            {filteredProducts.length} {t("Produits visibles")}
          </Eyebrow>
          <h1 className="view-title mt-3">{t("Stock")}</h1>
        </div>
        <label className="relative flex w-full max-w-xs items-center gap-2 border-b border-[var(--line-strong)] pb-1">
          <Search size={16} strokeWidth={1.5} className="text-[var(--muted)]" />
          <input
            value={stockSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("Rechercher")}
            className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-[var(--faint)]"
          />
        </label>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const active = categoryId === category.id;
            const isDeletable =
              canManageCategories &&
              category.id !== "all" &&
              !products.some((product) => product.categoryId === category.id);
            return (
              <span
                key={category.id}
                className={`chip transition-colors ${
                  active ? "chip--active" : "hover:border-[var(--ink)]"
                } ${isDeletable ? "pr-1" : ""}`}
              >
                <button type="button" onClick={() => onCategoryChange(category.id)}>
                  {t(category.name)}
                </button>
                {isDeletable ? (
                  <button
                    type="button"
                    aria-label={`${t("Supprimer la catégorie")} ${category.name}`}
                    title={t("Supprimer la catégorie")}
                    onClick={() => void handleDeleteCategory(category)}
                    className="ml-1 inline-flex h-4 w-4 items-center justify-center opacity-60 hover:opacity-100"
                  >
                    <Trash2 size={11} strokeWidth={1.5} />
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {statusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onStatusChange(filter)}
              className={`text-[0.64rem] uppercase tracking-[0.16em] transition-colors ${
                stockStatus === filter
                  ? "text-[var(--ink)] underline underline-offset-4"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {filter === "all" ? t("Tous") : t(filter as StockStatus)}
            </button>
          ))}
        </div>
      </div>

      {filteredProducts.length === 0 || !selectedProduct ? (
        <EmptyState
          title={t("Aucun produit visible")}
          hint={t("La recherche ou le statut isole trop le stock.")}
          action={
            <button type="button" className="btn btn-line btn-sm" onClick={resetFilters}>
              {t("Réinitialiser")}
            </button>
          }
        />
      ) : isCompact ? (
        /* ---------- MOBILE : compact list + bottom sheet ---------- */
        <>
          <div className="card overflow-hidden">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => openOnMobile(product.id)}
                className="flex w-full items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 text-left transition-colors last:border-0 active:bg-[var(--bg-2)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.92rem]">{product.name}</span>
                  <span className="tabular block text-[0.74rem] text-[var(--muted)]">
                    {product.quantity} {product.unit}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusChip status={product.status} />
                  <ChevronRight
                    size={16}
                    strokeWidth={1.5}
                    className="text-[var(--faint)]"
                  />
                </span>
              </button>
            ))}
          </div>

          {sheetOpen ? (
            <>
              <div
                className="sheet-backdrop"
                aria-hidden
                onClick={() => setSheetOpen(false)}
              />
              <div className="sheet" role="dialog" aria-label={selectedProduct.name}>
                <div className="sheet-head">
                  <span className="sheet-handle" />
                  <span className="truncate text-[0.95rem]">{selectedProduct.name}</span>
                  <button
                    type="button"
                    className="icon-btn h-9 w-9"
                    aria-label={t("Fermer")}
                    onClick={() => setSheetOpen(false)}
                  >
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="sheet-body">
                  <ProductDetail
                    product={selectedProduct}
                    lots={selectedLots}
                    categoryName={selectedCategoryName}
                    onFocusLot={(lotId) => {
                      setSheetOpen(false);
                      onFocusLot(lotId);
                    }}
                  />
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : (
        /* ---------- DESKTOP / TABLET ---------- */
        <>
          <section className="mx-auto w-full max-w-[460px]">
            <SemiCircleStock
              products={filteredProducts}
              selectedId={selectedProduct.id}
              onSelect={onSelectProduct}
              categoryName={selectedCategoryName}
            />
          </section>

          <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.05fr]">
            <section>
              <Eyebrow>{t("Index produits")}</Eyebrow>
              <div className="rule mb-4 mt-3" />
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {filteredProducts.map((product) => {
                  const active = product.id === selectedProduct.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => onSelectProduct(product.id)}
                      className={`card flex flex-col gap-3 p-4 text-left ${
                        active
                          ? "border-[var(--ink)] bg-[var(--bg-2)]"
                          : "hover:border-[var(--line-strong)]"
                      }`}
                    >
                      <span className="block truncate text-[0.9rem]">{product.name}</span>
                      <span className="numeric text-2xl leading-none">
                        {product.quantity}
                        <span className="ml-1 text-[0.7rem] text-[var(--muted)]">
                          {product.unit}
                        </span>
                      </span>
                      <StatusChip status={product.status} />
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div key={selectedProduct.id} className="swap">
                <ProductDetail
                  product={selectedProduct}
                  lots={selectedLots}
                  categoryName={selectedCategoryName}
                  onFocusLot={onFocusLot}
                />
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
