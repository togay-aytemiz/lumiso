import { ReactNode } from "react";

interface SettingsPageWrapperProps {
  children: ReactNode;
}

export default function SettingsPageWrapper({ children }: SettingsPageWrapperProps) {
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full">
      {children}
    </div>
  );
}