import { Outlet } from "react-router-dom";
import SettingsLayout from "@/components/settings/SettingsLayout";

export default function Settings() {
  return (
    <SettingsLayout>
      <Outlet />
    </SettingsLayout>
  );
}