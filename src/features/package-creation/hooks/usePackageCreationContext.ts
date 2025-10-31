import { useContext } from "react";
import { PackageCreationContext } from "../context/PackageCreationProvider";

export const usePackageCreationContext = () => {
  const context = useContext(PackageCreationContext);
  if (!context) {
    throw new Error("usePackageCreationContext must be used within a PackageCreationProvider");
  }
  return context;
};
