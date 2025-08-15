import { ReactNode } from "react";

interface SettingsPageWrapperProps {
  children: ReactNode;
}

export default function SettingsPageWrapper({ children }: SettingsPageWrapperProps) {
  return (
    <div className="p-6 sm:p-8 w-full">
      {children}
    </div>
  );
}