import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2 } from "lucide-react";
import { ServicePicker, PickerService } from "@/components/ServicePicker";
import { useServices } from "@/hooks/useOrganizationData";
import { usePackageCreationContext } from "../hooks/usePackageCreationContext";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import type { PackageCreationLineItem } from "../types";
import { IconActionButton } from "@/components/ui/icon-action-button";

interface ServiceRecord {
  id: string;
  name: string;
  category?: string | null;
  cost_price?: number | null;
  selling_price?: number | null;
  price?: number | null;
  vendor_name?: string | null;
  is_active?: boolean | null;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(amount);

export const ServicesStep = () => {
  const { t } = useTranslation("packageCreation");
  const { state } = usePackageCreationContext();
  const { updateServices } = usePackageCreationActions();

  const servicesQuery = useServices();
  const services = useMemo(
    () => ((servicesQuery.data as ServiceRecord[] | undefined) ?? []),
    [servicesQuery.data]
  );

  const [customName, setCustomName] = useState("");
  const [customCost, setCustomCost] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  const serviceMap = useMemo(
    () =>
      new Map(
        services.map((service) => [
          service.id,
          {
            ...service,
            unitCost: service.cost_price ?? 0,
            unitPrice: service.selling_price ?? service.price ?? 0,
          },
        ])
      ),
    [services]
  );

  const pickerServices = useMemo<PickerService[]>(
    () =>
      services
        .filter((service) => service.is_active !== false)
        .map((service) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          cost_price: service.cost_price ?? undefined,
          selling_price: service.selling_price ?? service.price ?? undefined,
          price: service.price ?? undefined,
          isActive: service.is_active !== false,
        })),
    [services]
  );

  const existingItems = state.services.items.filter((item) => item.type === "existing");
  const customItems = state.services.items.filter((item) => item.type === "custom");

  const existingServiceIds = useMemo(
    () =>
      existingItems
        .map((item) => item.serviceId)
        .filter(Boolean) as string[],
    [existingItems]
  );

  const totals = useMemo(() => {
    return state.services.items.reduce(
      (acc, item) => {
        const quantity = Math.max(1, item.quantity ?? 1);
        const unitCost = Number(item.unitCost ?? 0);
        const unitPrice = Number(item.unitPrice ?? 0);
        acc.cost += unitCost * quantity;
        acc.price += unitPrice * quantity;
        return acc;
      },
      { cost: 0, price: 0 }
    );
  }, [state.services.items]);

  const margin = totals.price - totals.cost;

  const parseQuantityInput = (value: string) => {
    const numeric = value.replace(/[^0-9]/g, "");
    const parsed = parseInt(numeric, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const syncExistingServiceIds = (ids: string[]) => {
    const nextItems: PackageCreationLineItem[] = [];
    const previous = new Map(existingItems.map((item) => [item.serviceId!, item]));

    ids.forEach((id) => {
      const prior = previous.get(id);
      const service = serviceMap.get(id);
      if (prior && service) {
        nextItems.push({
          ...prior,
          name: service.name,
          unitCost: service.unitCost,
          unitPrice: service.unitPrice,
          vendorName: service.vendor_name ?? null,
        });
      } else if (service) {
        nextItems.push({
          id,
          type: "existing",
          serviceId: id,
          name: service.name,
          quantity: 1,
          unitCost: service.unitCost,
          unitPrice: service.unitPrice,
          vendorName: service.vendor_name ?? null,
          source: "catalog",
        });
      }
    });

    updateServices({
      items: [...nextItems, ...customItems],
      showQuickAdd: state.services.showQuickAdd,
    });
  };

  const updateItem = (itemId: string, updates: Partial<PackageCreationLineItem>) => {
    const nextItems = state.services.items.map((item) =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    updateServices({ items: nextItems });
  };

  const removeItem = (itemId: string) => {
    updateServices({
      items: state.services.items.filter((item) => item.id !== itemId),
    });
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    updateItem(itemId, { quantity: parseQuantityInput(value) });
  };

  const adjustQuantity = (itemId: string, delta: number) => {
    const target = state.services.items.find((item) => item.id === itemId);
    const next = Math.max(1, (target?.quantity ?? 1) + delta);
    updateItem(itemId, { quantity: next });
  };

  const toggleQuickAdd = () => {
    updateServices({ showQuickAdd: !state.services.showQuickAdd });
    setCustomError(null);
    setCustomName("");
    setCustomCost("");
    setCustomPrice("");
  };

  const handleAddCustomService = () => {
    setCustomError(null);
    const trimmedName = customName.trim();
    const parsedPrice = Number(customPrice);
    const parsedCost = customCost.trim() === "" ? 0 : Number(customCost);

    if (!trimmedName) {
      setCustomError(t("steps.services.custom.errors.name", { defaultValue: "Name is required." }));
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setCustomError(t("steps.services.custom.errors.price", { defaultValue: "Enter a valid price." }));
      return;
    }

    if (customCost.trim() !== "" && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      setCustomError(t("steps.services.custom.errors.cost", { defaultValue: "Enter a valid cost." }));
      return;
    }

    const newItem: PackageCreationLineItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "custom",
      name: trimmedName,
      quantity: 1,
      unitCost: Number.isFinite(parsedCost) ? parsedCost : 0,
      unitPrice: parsedPrice,
      vendorName: null,
      source: "adhoc",
    };

    updateServices({
      items: [...state.services.items, newItem],
      showQuickAdd: true,
    });

    setCustomName("");
    setCustomCost("");
    setCustomPrice("");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("steps.services.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("steps.services.description")}
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label>{t("steps.services.picker.label")}</Label>
          {servicesQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 rounded-md" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 rounded-full" />
                ))}
              </div>
            </div>
          ) : servicesQuery.error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <div className="flex items-center justify-between">
                <span>{t("steps.services.picker.error")}</span>
                <Button variant="outline" size="sm" onClick={() => servicesQuery.refetch()}>
                  {t("common:actions.retry", { defaultValue: "Retry" })}
                </Button>
              </div>
            </div>
          ) : pickerServices.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-md border border-dashed px-4 py-4">
              <p className="text-sm text-muted-foreground">
                {t("steps.services.picker.empty")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/settings/services", "_blank")}
              >
                {t("steps.services.picker.emptyCta")}
              </Button>
            </div>
          ) : (
            <ServicePicker
              services={pickerServices}
              value={existingServiceIds}
              onChange={syncExistingServiceIds}
            />
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("steps.services.summary.title")}
            </h3>
            <Button variant="ghost" size="sm" onClick={toggleQuickAdd}>
              {t("steps.services.custom.toggle")}
            </Button>
          </div>

          {state.services.items.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {t("steps.services.summary.empty")}
            </div>
          ) : (
            <div className="space-y-3">
              {existingItems.map((item) => {
                const service = item.serviceId ? serviceMap.get(item.serviceId) : null;
                const quantityValue = item.quantity ?? 1;
                const showInlineDelete = quantityValue <= 1;

                return (
                  <div key={item.id} className="rounded-lg border bg-muted/10 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900">{service?.name ?? item.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {service?.vendor_name ? (
                          <Badge variant="outline" className="text-[11px]">
                            {t("steps.services.list.vendor")}: {service.vendor_name}
                          </Badge>
                        ) : null}
                        <span>
                          {t("steps.services.list.unitCost")}: {formatCurrency(Number(item.unitCost ?? 0))}
                        </span>
                        <span>
                          {t("steps.services.list.unitPrice")}: {formatCurrency(Number(item.unitPrice ?? 0))}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          {t("steps.services.list.quantity")}
                        </span>
                        <div className="flex items-center gap-1 rounded-full border px-1 py-1">
                          {showInlineDelete ? (
                            <IconActionButton
                              onClick={() => removeItem(item.id)}
                              aria-label={t("steps.services.list.remove")}
                              variant="danger"
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconActionButton>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => adjustQuantity(item.id, -1)}
                              aria-label={t("common:actions.decrease", { defaultValue: "Decrease" })}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={String(quantityValue)}
                            onChange={(event) => handleQuantityChange(item.id, event.target.value)}
                            className="h-8 w-14 border-0 bg-transparent text-center text-sm font-medium focus-visible:ring-0"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => adjustQuantity(item.id, 1)}
                            aria-label={t("common:actions.increase", { defaultValue: "Increase" })}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {!showInlineDelete ? (
                        <IconActionButton
                          onClick={() => removeItem(item.id)}
                          aria-label={t("steps.services.list.remove")}
                          variant="danger"
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconActionButton>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {customItems.map((item) => (
                <div key={item.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <Label htmlFor={`custom-name-${item.id}`} className="text-xs text-muted-foreground">
                        {t("steps.services.custom.nameLabel")}
                      </Label>
                      <Input
                        id={`custom-name-${item.id}`}
                        value={item.name}
                        onChange={(event) => updateItem(item.id, { name: event.target.value })}
                      />
                    </div>
                    <IconActionButton
                      onClick={() => removeItem(item.id)}
                      aria-label={t("steps.services.list.remove")}
                      variant="danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconActionButton>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor={`custom-quantity-${item.id}`} className="text-xs text-muted-foreground">
                        {t("steps.services.list.quantity")}
                      </Label>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-full border px-1 py-1">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => adjustQuantity(item.id, -1)}
                            aria-label={t("common:actions.decrease", { defaultValue: "Decrease" })}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            id={`custom-quantity-${item.id}`}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={String(item.quantity ?? 1)}
                            onChange={(event) => handleQuantityChange(item.id, event.target.value)}
                            className="h-8 w-14 border-0 bg-transparent text-center text-sm font-medium focus-visible:ring-0"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => adjustQuantity(item.id, 1)}
                            aria-label={t("common:actions.increase", { defaultValue: "Increase" })}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`custom-cost-${item.id}`} className="text-xs text-muted-foreground">
                        {t("steps.services.list.unitCost")}
                      </Label>
                      <Input
                        id={`custom-cost-${item.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitCost ?? ""}
                        onChange={(event) =>
                          updateItem(item.id, {
                            unitCost: event.target.value === "" ? null : Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`custom-price-${item.id}`} className="text-xs text-muted-foreground">
                        {t("steps.services.list.unitPrice")}
                      </Label>
                      <Input
                        id={`custom-price-${item.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice ?? ""}
                        onChange={(event) =>
                          updateItem(item.id, {
                            unitPrice: event.target.value === "" ? null : Number(event.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {state.services.showQuickAdd && (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">
              {t("steps.services.custom.title")}
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Label htmlFor="custom-name">{t("steps.services.custom.nameLabel")}</Label>
                <Input
                  id="custom-name"
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  placeholder={t("steps.services.custom.namePlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="custom-cost">{t("steps.services.custom.costLabel")}</Label>
                <Input
                  id="custom-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={customCost}
                  onChange={(event) => setCustomCost(event.target.value)}
                  placeholder={t("steps.services.custom.costPlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="custom-price">{t("steps.services.custom.priceLabel")}</Label>
                <Input
                  id="custom-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={customPrice}
                  onChange={(event) => setCustomPrice(event.target.value)}
                  placeholder={t("steps.services.custom.pricePlaceholder")}
                />
              </div>
            </div>
            {customError ? (
              <p className="text-xs text-destructive">{customError}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={handleAddCustomService}>
                {t("steps.services.custom.add")}
              </Button>
              <Button size="sm" variant="ghost" onClick={toggleQuickAdd}>
                {t("steps.services.custom.cancel")}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-muted/10 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">
              {t("steps.services.summary.cost")}
            </span>
            <span>{formatCurrency(totals.cost)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">
              {t("steps.services.summary.price")}
            </span>
            <span>{formatCurrency(totals.price)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">
              {t("steps.services.summary.margin")}
            </span>
            <span className={margin >= 0 ? "text-emerald-600" : "text-destructive"}>
              {formatCurrency(margin)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
