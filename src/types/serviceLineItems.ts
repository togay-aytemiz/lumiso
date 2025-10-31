export type ServiceLineItemRole = "base" | "addon";

export interface ServiceLineItem {
  serviceId: string;
  role: ServiceLineItemRole;
  quantity: number;
  unitPrice?: number | null;
}

export const createLineItem = (
  serviceId: string,
  role: ServiceLineItemRole,
  quantity = 1,
  unitPrice: number | null = null
): ServiceLineItem => ({
  serviceId,
  role,
  quantity,
  unitPrice,
});

export const isServiceLineItem = (value: unknown): value is ServiceLineItem => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.serviceId === "string" &&
    (record.role === "base" || record.role === "addon") &&
    typeof record.quantity === "number"
  );
};
