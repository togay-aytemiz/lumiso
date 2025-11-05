import { useMemo } from "react";
import { usePackageCreationContext } from "./usePackageCreationContext";
import {
  createPackageSnapshot,
  preparePackagePersistence,
  PackageSnapshot,
  PackagePersistencePayload,
  CreatePackageSnapshotOptions,
} from "../services/packageCreationSnapshot";
import { usePackageDeliveryMethods } from "@/hooks/useOrganizationData";

export const usePackageCreationSnapshot = () => {
  const { state } = usePackageCreationContext();
  const deliveryMethodsQuery = usePackageDeliveryMethods();

  const catalog = useMemo(() => {
    const raw = deliveryMethodsQuery.data ?? [];
    return raw.map((entry) => ({
      id: entry.id,
      name: entry.name ?? null,
    }));
  }, [deliveryMethodsQuery.data]);

  const options: CreatePackageSnapshotOptions = useMemo(
    () => ({ deliveryMethodsCatalog: catalog }),
    [catalog]
  );

  const snapshot = useMemo<PackageSnapshot>(() => createPackageSnapshot(state, options), [state, options]);

  const buildPersistencePayload = (context: { userId: string; organizationId: string }): PackagePersistencePayload => {
    return preparePackagePersistence(state, context, options);
  };

  return {
    snapshot,
    buildPersistencePayload,
    deliveryMethodsQuery,
  };
};

export type { PackageSnapshot } from "../services/packageCreationSnapshot";
