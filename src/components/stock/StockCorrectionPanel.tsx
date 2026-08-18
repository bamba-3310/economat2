"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  useAppData,
  hasClientPermission,
  type StockCorrectionInput,
} from "@/lib/app-data";
import type { Lot, LotStatus, Product } from "@/types/domain";
import { Eyebrow, Field, Select, TextInput } from "@/components/ui/kit";

const lotStatusOptions: LotStatus[] = [
  "En réserve",
  "En service",
  "Bientôt épuisé",
  "Épuisé",
  "Expiré",
];

// Parent remounts this panel per product via key={product.id}, so initial
// state can be seeded directly from props.
export default function StockCorrectionPanel({
  product,
  lots: productLots,
}: {
  product: Product;
  lots: Lot[];
}) {
  const { t } = useI18n();
  const { correctStock, currentUser, deleteLot, deleteProduct, isSyncing } =
    useAppData();

  const firstLot = productLots[0];
  const [selectedLotId, setSelectedLotId] = useState(firstLot?.id ?? "");
  const selectedLot =
    productLots.find((lot) => lot.id === selectedLotId) ?? firstLot;
  const [threshold, setThreshold] = useState(String(product.threshold));
  const [remainingQuantity, setRemainingQuantity] = useState(
    selectedLot ? String(selectedLot.remainingQuantity) : "0",
  );
  const [expirationDate, setExpirationDate] = useState(
    selectedLot?.expirationDate ?? "",
  );
  const [lotStatus, setLotStatus] = useState<LotStatus>(
    selectedLot?.status ?? "En réserve",
  );
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const canEditStock = hasClientPermission(currentUser, ["edit_stock"]);
  const canEditThresholds = hasClientPermission(currentUser, ["edit_thresholds"]);
  const canEditLots = hasClientPermission(currentUser, ["edit_lots"]);
  const canEditExpiration = hasClientPermission(currentUser, [
    "edit_expiration_dates",
  ]);

  function selectCorrectionLot(lotId: string) {
    const nextLot = productLots.find((lot) => lot.id === lotId);
    setSelectedLotId(lotId);
    setRemainingQuantity(nextLot ? String(nextLot.remainingQuantity) : "0");
    setExpirationDate(nextLot?.expirationDate ?? "");
    setLotStatus(nextLot?.status ?? "En réserve");
    setMessage("");
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    const nextThreshold = Number(threshold);
    const nextRemainingQuantity = Number(remainingQuantity);
    const correction: StockCorrectionInput = { productId: product.id };

    if (
      canEditThresholds &&
      Number.isFinite(nextThreshold) &&
      nextThreshold !== product.threshold
    ) {
      correction.threshold = Math.max(0, Math.round(nextThreshold));
    }

    if (selectedLot) {
      correction.lotId = selectedLot.id;
      if (
        canEditStock &&
        Number.isFinite(nextRemainingQuantity) &&
        nextRemainingQuantity !== selectedLot.remainingQuantity
      ) {
        correction.remainingQuantity = Math.max(0, Math.round(nextRemainingQuantity));
      }
      if (canEditExpiration && expirationDate !== selectedLot.expirationDate) {
        correction.expirationDate = expirationDate;
      }
      if (canEditLots && lotStatus !== selectedLot.status) {
        correction.status = lotStatus;
      }
    }

    const hasChange =
      correction.threshold !== undefined ||
      correction.remainingQuantity !== undefined ||
      correction.expirationDate !== undefined ||
      correction.status !== undefined;

    if (!hasChange) {
      setIsError(true);
      setMessage("Aucune modification à appliquer.");
      return;
    }

    try {
      await correctStock(correction);
      setMessage("Correction enregistrée et tracée.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : t("Correction impossible."));
    }
  }

  return (
    <form className="card p-6" onSubmit={submitCorrection}>
      <div className="flex items-center justify-between">
        <Eyebrow>{t("Correction stock")}</Eyebrow>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {canEditThresholds ? (
          <Field label={t("Seuil produit")}>
            <TextInput
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </Field>
        ) : null}

        {productLots.length > 0 ? (
          <Field label={t("Lot")}>
            <Select
              value={selectedLot?.id ?? ""}
              onChange={(e) => selectCorrectionLot(e.target.value)}
            >
              {productLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.code}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {selectedLot && canEditStock ? (
          <Field label={t("Quantité restante")}>
            <TextInput
              type="number"
              min="0"
              value={remainingQuantity}
              onChange={(e) => setRemainingQuantity(e.target.value)}
            />
          </Field>
        ) : null}

        {selectedLot && canEditExpiration ? (
          <Field label={t("Expiration")}>
            <TextInput
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
          </Field>
        ) : null}

        {selectedLot && canEditLots ? (
          <Field label={t("État du lot")}>
            <Select
              value={lotStatus}
              onChange={(e) => setLotStatus(e.target.value as LotStatus)}
            >
              {lotStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {t(status)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSyncing}
        className="btn btn-primary btn-sm btn-block mt-5"
      >
        {isSyncing ? t("Enregistrement...") : t("Enregistrer correction")}
      </button>

      {/* Delete actions — remove an expired lot, or the whole product. */}
      {canEditLots || canEditStock ? (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selectedLot && canEditLots ? (
            <button
              type="button"
              disabled={isSyncing}
              className="btn btn-danger btn-sm"
              onClick={async () => {
                if (!window.confirm(t("Supprimer ce lot ?"))) return;
                const result = await deleteLot({ lotId: selectedLot.id });
                setIsError(!result.ok);
                setMessage(result.ok ? "Lot supprimé." : "Suppression impossible.");
              }}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              {t("Supprimer le lot")}
            </button>
          ) : null}
          {canEditStock ? (
            <button
              type="button"
              disabled={isSyncing}
              className="btn btn-line btn-sm text-center"
              onClick={async () => {
                if (!window.confirm(t("Supprimer ce produit ?"))) return;
                const result = await deleteProduct({ productId: product.id });
                setIsError(!result.ok);
                setMessage(
                  result.ok
                    ? "Produit supprimé."
                    : result.message ?? "Suppression impossible.",
                );
              }}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              {t("Supprimer le produit")}
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p
          className={`mt-3 border px-3 py-2 text-[0.8rem] ${
            isError
              ? "border-[var(--critical)] text-[var(--critical)]"
              : "border-[var(--line-strong)] text-[var(--ink-soft)]"
          }`}
        >
          {t(message)}
        </p>
      ) : null}
    </form>
  );
}
