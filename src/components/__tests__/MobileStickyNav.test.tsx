import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileStickyNav } from "../MobileStickyNav";
import { MemoryRouter, useLocation } from "react-router-dom";

describe("MobileStickyNav", () => {
  it("highlights the active navigation item", () => {
    render(
      <MemoryRouter initialEntries={["/projects"]}>
        <MobileStickyNav />
      </MemoryRouter>
    );

    const projectsLink = screen.getByRole("link", { name: "Projects" });
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });

    expect(projectsLink).toHaveClass("bg-primary-foreground/20");
    expect(dashboardLink).not.toHaveClass("bg-primary-foreground/20");
  });

  it("toggles the bookings menu and closes on outside click", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <MobileStickyNav />
      </MemoryRouter>
    );

    const bookingsButton = screen.getByRole("button", { name: "Bookings" });
    expect(bookingsButton).toHaveAttribute("aria-expanded", "false");

    await user.click(bookingsButton);
    expect(bookingsButton).toHaveAttribute("aria-expanded", "true");

    expect(await screen.findByRole("link", { name: "Sessions" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Sessions" })).not.toBeInTheDocument();
    });
    expect(bookingsButton).toHaveAttribute("aria-expanded", "false");
  });

  it("navigates via bookings menu and collapses after selection", async () => {
    const user = userEvent.setup();
    let currentPath = "";

    const LocationObserver = () => {
      const location = useLocation();
      currentPath = location.pathname;
      return null;
    };

    render(
      <MemoryRouter initialEntries={["/calendar"]}>
        <LocationObserver />
        <MobileStickyNav />
      </MemoryRouter>
    );

    const bookingsButton = screen.getByRole("button", { name: "Bookings" });

    await user.click(bookingsButton);
    const remindersLink = await screen.findByRole("link", { name: "Reminders" });
    await user.click(remindersLink);

    await waitFor(() => {
      expect(currentPath).toBe("/reminders");
    });

    expect(screen.queryByRole("link", { name: "Reminders" })).not.toBeInTheDocument();
    expect(bookingsButton).toHaveAttribute("aria-expanded", "false");
  });
});
