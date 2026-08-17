"use client";

import { useMemo, useState } from "react";
import { Check, Download, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  useAppData,
  type DeliveryDraft,
  type DeliveryLine,
  type DeliveryValidationResult,
} from "@/lib/app-data";
import { createLotQrValue, getDeliveryExpirationDate } from "@/lib/stock-engine";
import {
  createSuggestedLotCode,
  downloadTextFile,
  escapeCsvCell,
  formatDate,
  normalizeSearchValue,
} from "@/lib/format";
import type { Delivery } from "@/types/domain";
import { Eyebrow, Field, Select, TextInput, Combobox } from "@/components/ui/kit";
import QrLabel from "@/components/delivery/QrLabel";

export default function DeliveryView({
  draft,
  lines,
  onAddLine,
  onLoadDelivery,
  onOpenLotScan,
  onRegenerateReference,
  onRemoveLine,
  onStartNewDelivery,
  onUpdateDraft,
  onUpdateLine,
  onValidate,
}: {
  draft: DeliveryDraft;
  lines: DeliveryLine[];
  onAddLine: () => void;
  onLoadDelivery: (delivery: Delivery) => void;
  onOpenLotScan: (lotCode: string) => void;
  onRegenerateReference: () => void;
  onRemoveLine: (id: number) => void;
  onStartNewDelivery: () => void;
  onUpdateDraft: (patch: Partial<DeliveryDraft>) => void;
  onUpdateLine: (id: number, patch: Partial<DeliveryLine>) => void;
  onValidate: () => Promise<DeliveryValidationResult>;
}) {
  const { t } = useI18n();
  const { categories, createSupplier, deliveries, isSyncing, lots, products, suppliers } =
    useAppData();

  const [labelCopies, setLabelCopies] = useState("1");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierMessage, setSupplierMessage] = useState("");
  const [isSupplierError, setIsSupplierError] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [isValidationError, setIsValidationError] = useState(false);
  const [lastValidatedDelivery, setLastValidatedDelivery] = useState<Delivery | null>(
    null,
  );

  const businessCategories = categories.filter((category) => category.id !== "all");
  const activeSuppliers = suppliers
    .filter((supplier) => supplier.active)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const printableLines = lines.filter((line) => line.product && line.lot);
  const validLines = printableLines.filter((line) => Number(line.quantity) > 0);
  const copiesPerLot = Math.min(3, Math.max(1, Math.round(Number(labelCopies) || 1)));
  const queuedLabels = printableLines.flatMap((line) =>
    Array.from({ length: copiesPerLot }, (_, copyIndex) => ({ copyIndex, line })),
  );
  const totalLabels = queuedLabels.length;

  const validatedLotCodes = useMemo(
    () =>
      new Set(
        deliveries.flatMap((delivery) => delivery.lines.map((line) => line.lotCode)),
      ),
    [deliveries],
  );
  const hasValidatedCurrentReceipt =
    printableLines.length > 0 &&
    printableLines.every((line) => validatedLotCodes.has(line.lot)) &&
    deliveries.some(
      (delivery) =>
        delivery.reference === draft.reference &&
        delivery.deliveredAt === draft.deliveredAt,
    );
  const canPrintLabels = totalLabels > 0 && hasValidatedCurrentReceipt;
  const currentValidatedDelivery =
    lastValidatedDelivery &&
    lastValidatedDelivery.reference === draft.reference &&
    lastValidatedDelivery.deliveredAt === draft.deliveredAt
      ? lastValidatedDelivery
      : null;
  const firstValidatedLotCode =
    currentValidatedDelivery?.lines[0]?.lotCode ??
    (hasValidatedCurrentReceipt ? printableLines[0]?.lot : "");

  const canValidate =
    Boolean(draft.supplier.trim() && draft.reference.trim() && draft.deliveredAt) &&
    validLines.length > 0 &&
    !hasValidatedCurrentReceipt;
  const validateHint = hasValidatedCurrentReceipt
    ? ""
    : !draft.supplier.trim()
      ? "Sélectionnez un fournisseur."
      : !draft.reference.trim() || !draft.deliveredAt
        ? "Référence et date requises."
        : validLines.length === 0
          ? "Complétez une ligne : produit, quantité, lot."
          : "";
  const canRegenerateFailedReference =
    isValidationError && normalizeSearchValue(validationMessage).includes("reference");

  function updateProduct(line: DeliveryLine, productName: string) {
    const nextProduct = products.find((item) => item.name === productName);
    const nextCategory = nextProduct
      ? categories.find((item) => item.id === nextProduct.categoryId)
      : categories.find((item) => item.id === line.categoryId);
    onUpdateLine(line.id, {
      product: productName,
      categoryId: nextProduct?.categoryId ?? line.categoryId,
      expiration: getDeliveryExpirationDate({
        category: nextCategory,
        deliveredAt: draft.deliveredAt,
        proposedExpiration: nextProduct ? "" : line.expiration,
      }),
      lot: createSuggestedLotCode({
        deliveredAt: draft.deliveredAt,
        lineId: line.id,
        productName: nextProduct?.name ?? productName,
      }),
      threshold: nextProduct
        ? String(nextProduct.threshold)
        : line.threshold || String(nextCategory?.defaultThreshold ?? ""),
      // Portion-based lots: ignore legacy product units (kg, litre, …).
      unit: "portion",
    });
  }

  function updateCategory(line: DeliveryLine, categoryId: string) {
    const nextCategory = categories.find((item) => item.id === categoryId);
    onUpdateLine(line.id, {
      categoryId,
      expiration: getDeliveryExpirationDate({
        category: nextCategory,
        deliveredAt: draft.deliveredAt,
        proposedExpiration: line.expiration,
      }),
      threshold: line.threshold || String(nextCategory?.defaultThreshold ?? ""),
    });
  }

  async function handleCreateSupplier() {
    setSupplierMessage("");
    setIsSupplierError(false);
    try {
      const supplier = await createSupplier({
        contact: supplierContact,
        name: supplierName,
      });
      const nextName = supplier?.name ?? supplierName.trim();
      onUpdateDraft({ supplier: nextName });
      setSupplierName("");
      setSupplierContact("");
      setAddingSupplier(false);
    } catch (error) {
      setIsSupplierError(true);
      setSupplierMessage(
        error instanceof Error ? error.message : t("Fournisseur non ajouté."),
      );
    }
  }

  async function handleValidate() {
    setValidationMessage("");
    setIsValidationError(false);
    try {
      const result = await onValidate();
      setLastValidatedDelivery(result.delivery);
      onLoadDelivery(result.delivery);
      setValidationMessage(
        `${result.count} ${result.count > 1 ? t("lots créés") : t("lot créé")}. ${t(
          "QR prêts pour impression et scan.",
        )}`,
      );
    } catch (error) {
      setIsValidationError(true);
      setValidationMessage(
        error instanceof Error ? error.message : t("Livraison non validée."),
      );
    }
  }

  function handleExportLabels() {
    if (queuedLabels.length === 0) return;
    const rows = [
      [
        "reference",
        "fournisseur",
        "date_livraison",
        "produit",
        "lot",
        "quantite",
        "unite",
        "expiration",
        "qr",
        "copie",
        "copies_total",
      ],
      ...queuedLabels.map(({ copyIndex, line }) => {
        const product = products.find((item) => item.name === line.product);
        const category = product
          ? categories.find((item) => item.id === product.categoryId)
          : undefined;
        const expirationDate = getDeliveryExpirationDate({
          category,
          deliveredAt: draft.deliveredAt,
          proposedExpiration: line.expiration,
        });
        return [
          draft.reference,
          draft.supplier,
          draft.deliveredAt,
          line.product,
          line.lot,
          line.quantity,
          line.unit,
          expirationDate || "",
          createLotQrValue(line.lot || `${line.id}`),
          copyIndex + 1,
          copiesPerLot,
        ];
      }),
    ];
    const csv = rows
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(";"))
      .join("\r\n");
    const fileKey =
      (draft.reference || "livraison")
        .replace(/[^a-z0-9-]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "livraison";
    downloadTextFile({
      content: `﻿${csv}`,
      fileName: `le-carre-qr-${fileKey}.csv`,
      type: "text/csv;charset=utf-8",
    });
  }

  function handleStartNew() {
    setValidationMessage("");
    setIsValidationError(false);
    setLastValidatedDelivery(null);
    onStartNewDelivery();
  }

  const summary = [
    { label: t("Lots"), value: String(validLines.length) },
    { label: "QR", value: String(totalLabels) },
    { label: t("Fournisseur"), value: draft.supplier || "—" },
    { label: t("Date"), value: formatDate(draft.deliveredAt) },
  ];

  return (
    <div className="flex flex-col gap-10">
      <header className="view-head">
        <div>
          <Eyebrow>{t("Réception")}</Eyebrow>
          <h1 className="view-title mt-3">{t("Livraison")}</h1>
        </div>
        <button type="button" className="btn btn-line btn-sm" onClick={handleStartNew}>
          {t("Nouvelle réception")}
        </button>
      </header>

      {/* Header band: supplier / reference / date */}
      <section>
        <Eyebrow>{t("Réception")}</Eyebrow>
        <div className="rule mb-5 mt-3" />
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <span className="field-label">{t("Fournisseur")}</span>
            {addingSupplier ? (
              <div className="flex flex-col gap-2">
                <TextInput
                  autoFocus
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder={t("Nom fournisseur")}
                />
                <TextInput
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  placeholder={t("Contact")}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={isSyncing || !supplierName.trim()}
                    onClick={() => void handleCreateSupplier()}
                  >
                    {t("Créer")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setAddingSupplier(false)}
                  >
                    {t("Annuler")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={draft.supplier}
                  onChange={(e) => onUpdateDraft({ supplier: e.target.value })}
                >
                  <option value="">{t("Choisir un fournisseur")}</option>
                  {activeSuppliers.every((s) => s.name !== draft.supplier) &&
                  draft.supplier ? (
                    <option value={draft.supplier}>{draft.supplier}</option>
                  ) : null}
                  {activeSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.name}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t("Nouveau fournisseur")}
                  title={t("Nouveau fournisseur")}
                  onClick={() => {
                    setSupplierName(draft.supplier);
                    setSupplierMessage("");
                    setIsSupplierError(false);
                    setAddingSupplier(true);
                  }}
                >
                  <Plus size={16} strokeWidth={1.5} />
                </button>
              </div>
            )}
            {supplierMessage ? (
              <p
                className={`mt-2 text-[0.76rem] ${
                  isSupplierError ? "text-[var(--critical)]" : "text-[var(--muted)]"
                }`}
              >
                {t(supplierMessage)}
              </p>
            ) : null}
          </div>

          <div>
            <span className="field-label">{t("Référence")}</span>
            <div className="flex gap-2">
              <TextInput
                value={draft.reference}
                onChange={(e) => onUpdateDraft({ reference: e.target.value })}
                className="tabular"
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={t("Régénérer la référence")}
                title={t("Régénérer la référence")}
                onClick={onRegenerateReference}
              >
                <RefreshCw size={15} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <Field label={t("Date de livraison")}>
            <TextInput
              type="date"
              value={draft.deliveredAt}
              onChange={(e) => onUpdateDraft({ deliveredAt: e.target.value })}
            />
          </Field>
        </div>
      </section>

      {/* Summary band */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-[var(--line)] bg-[var(--line)] md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="bg-[var(--bg-2)] px-5 py-5">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--muted)]">
              {item.label}
            </div>
            <div className="mt-2 truncate text-[1.05rem]">{item.value}</div>
          </div>
        ))}
      </section>

      {/* Lines (left) + QR (right) */}
      <div className="grid items-start gap-8 lg:grid-cols-[1.45fr_1fr]">
        <section>
          <Eyebrow>{t("Lignes")}</Eyebrow>
          <div className="rule mb-5 mt-3" />
          <div className="flex flex-col gap-4">
            {lines.map((line) => {
              const product = products.find((item) => item.name === line.product);
              const isNewProduct = Boolean(line.product.trim() && !product);
              return (
                <div key={line.id} className="card p-5">
                  <div className="flex items-center justify-between">
                    <span className="numeric text-sm text-[var(--muted)]">
                      {t("Lot")} {String(line.id).padStart(2, "0")}
                      {isNewProduct ? (
                        <span className="ml-2 text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink)]">
                          · {t("Nouveau")}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      aria-label={t("Supprimer")}
                      className="text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                      onClick={() => onRemoveLine(line.id)}
                    >
                      <Trash2 size={15} strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2">
                      <Field label={t("Produit")}>
                        <Combobox
                          value={line.product}
                          onChange={(next) => updateProduct(line, next)}
                          options={products.map((product) => product.name)}
                          placeholder={t("Choisir ou saisir")}
                          emptyLabel={t("Aucun produit visible")}
                          listLabel={t("Produit")}
                        />
                      </Field>
                    </div>
                    <Field label={t("Qté")}>
                      <TextInput
                        type="number"
                        min="0"
                        value={line.quantity}
                        onChange={(e) =>
                          onUpdateLine(line.id, { quantity: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t("Catégorie")}>
                      <Select
                        value={line.categoryId}
                        onChange={(e) => updateCategory(line, e.target.value)}
                      >
                        {businessCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t("Seuil")}>
                      <TextInput
                        type="number"
                        min="0"
                        value={line.threshold}
                        onChange={(e) =>
                          onUpdateLine(line.id, { threshold: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={t("Lot généré")}>
                      <TextInput
                        value={line.lot}
                        onChange={(e) => onUpdateLine(line.id, { lot: e.target.value })}
                        className="tabular"
                      />
                    </Field>
                    <Field label={t("Expiration")}>
                      <TextInput
                        type="date"
                        value={line.expiration}
                        onChange={(e) =>
                          onUpdateLine(line.id, { expiration: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <button type="button" className="btn btn-line btn-sm" onClick={onAddLine}>
              <Plus size={14} strokeWidth={1.5} />
              {t("Ajouter une ligne")}
            </button>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-line btn-sm"
              disabled={!canPrintLabels}
              onClick={() => window.print()}
            >
              <Printer size={14} strokeWidth={1.5} />
              {t("Imprimer")} {totalLabels} QR
            </button>
            <button
              type="button"
              className="btn btn-line btn-sm"
              disabled={!canPrintLabels}
              onClick={handleExportLabels}
            >
              <Download size={14} strokeWidth={1.5} />
              {t("Export CSV")}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm ml-auto"
              disabled={!canValidate || isSyncing}
              onClick={() => void handleValidate()}
            >
              <Check size={14} strokeWidth={1.5} />
              {isSyncing
                ? t("Validation...")
                : hasValidatedCurrentReceipt
                  ? t("Livraison validée")
                  : t("Valider et créer les lots")}
            </button>
          </div>

          {!canValidate && validateHint && !validationMessage ? (
            <p className="mt-3 text-[0.78rem] text-[var(--muted)]">{t(validateHint)}</p>
          ) : null}

          {validationMessage ? (
            <div
              className={`mt-4 card p-4 ${
                isValidationError ? "border-[var(--critical)]" : ""
              }`}
            >
              <p className="text-[0.85rem]">{t(validationMessage)}</p>
              {!isValidationError ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    disabled={!canPrintLabels}
                    onClick={() => window.print()}
                  >
                    {t("Imprimer QR")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    disabled={!firstValidatedLotCode}
                    onClick={() => firstValidatedLotCode && onOpenLotScan(firstValidatedLotCode)}
                  >
                    {t("Scanner 1er lot")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleStartNew}
                  >
                    {t("Nouvelle réception")}
                  </button>
                </div>
              ) : null}
              {canRegenerateFailedReference ? (
                <button
                  type="button"
                  className="btn btn-line btn-sm mt-3"
                  onClick={() => {
                    onRegenerateReference();
                    setValidationMessage("");
                    setIsValidationError(false);
                    setLastValidatedDelivery(null);
                  }}
                >
                  {t("Nouvelle référence")}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* QR labels + print controls */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-baseline justify-between">
            <Eyebrow>{t("Étiquettes QR")}</Eyebrow>
            <Eyebrow>
              {printableLines.length} {t("lots")}
            </Eyebrow>
          </div>
          <div className="rule mb-5 mt-3" />

          <div className="card mb-4 flex items-end justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("Copies par lot")}
              </div>
              <p className="mt-1 text-[0.72rem] text-[var(--muted)]">
                {t("Pas de QR par unité : uniquement des duplicatas d'étiquette.")}
              </p>
            </div>
            <input
              type="number"
              min="1"
              max="3"
              value={labelCopies}
              onChange={(e) => setLabelCopies(e.target.value)}
              className="input w-16 text-center"
            />
          </div>

          <div className="qr-label-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {queuedLabels.map(({ copyIndex, line }) => {
              const matchedLot = lots.find((lot) => lot.code === line.lot);
              const value = matchedLot
                ? createLotQrValue(matchedLot)
                : createLotQrValue(line.lot || "preview");
              const receivedAt =
                matchedLot?.receivedAt || draft.deliveredAt || "";
              return (
                <QrLabel
                  key={`${line.id}-${copyIndex}`}
                  productName={line.product}
                  lotCode={line.lot}
                  quantity={line.quantity}
                  unit={line.unit || "portion"}
                  expiration={line.expiration}
                  receivedAt={receivedAt}
                  value={value}
                  scannable={validatedLotCodes.has(line.lot)}
                  copyIndex={copyIndex}
                  totalCopies={copiesPerLot}
                  onScan={() => onOpenLotScan(line.lot)}
                />
              );
            })}
          </div>
        </aside>
      </div>

      {/* Recent deliveries */}
      {deliveries.length > 0 ? (
        <section>
          <Eyebrow>{t("Livraisons du jour")}</Eyebrow>
          <div className="rule mb-3 mt-3" />
          <ul className="flex flex-col">
            {deliveries.slice(0, 6).map((delivery) => (
              <li
                key={delivery.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-3 last:border-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.88rem]">{delivery.supplier}</span>
                  <span className="tabular block text-[0.72rem] text-[var(--muted)]">
                    {delivery.reference} · {delivery.lines.length} {t("lots")} ·{" "}
                    {formatDate(delivery.deliveredAt)}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onLoadDelivery(delivery)}
                >
                  {t("Charger")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
