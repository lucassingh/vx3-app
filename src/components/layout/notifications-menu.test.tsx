import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "@/lib/api/types";
import { NotificationsMenu } from "./notifications-menu";

const { markAllRead, toast } = vi.hoisted(() => ({
  markAllRead: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Los componentes de cliente usan la API del navegador y los avisos: se mockean.
vi.mock("@/lib/api/browser", () => ({ api: { notifications: { markAllRead } } }));
vi.mock("@/lib/toast", () => ({ toast }));

const now = new Date().toISOString();
const items: Notification[] = [
  { id: "1", title: "Nuevo registro", description: "Detalle", createdAt: now, read: false },
  { id: "2", title: "Invitación aceptada", description: "Detalle", createdAt: now, read: false },
  { id: "3", title: "Exportación lista", description: "Detalle", createdAt: now, read: true },
];

async function openAndMarkAllRead() {
  const user = userEvent.setup();
  render(<NotificationsMenu initialItems={items} />);
  await user.click(screen.getByRole("button", { name: "Notificaciones, 2 sin leer" }));
  await user.click(await screen.findByRole("menuitem", { name: /Marcar todo como leído/ }));
}

// Con el menú abierto, Radix oculta el resto de la página a lectores de pantalla.
const bell = (name: string) => screen.getByRole("button", { name, hidden: true });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotificationsMenu", () => {
  it("indica cuántas notificaciones hay sin leer", () => {
    render(<NotificationsMenu initialItems={items} />);
    expect(screen.getByRole("button", { name: "Notificaciones, 2 sin leer" })).toBeInTheDocument();
  });

  it("marca todo como leído contra la API y lo confirma con un aviso", async () => {
    markAllRead.mockResolvedValue({ updated: 2 });

    await openAndMarkAllRead();

    expect(markAllRead).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(bell("Notificaciones")).toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Notificaciones marcadas como leídas");
  });

  it("si la API falla, revierte el cambio optimista y ofrece reintentar", async () => {
    markAllRead.mockRejectedValue(new Error("Servicio no disponible"));

    await openAndMarkAllRead();

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [, options] = toast.error.mock.calls[0];
    expect(options.action.label).toBe("Reintentar");
    await waitFor(() => expect(bell("Notificaciones, 2 sin leer")).toBeInTheDocument());
  });
});
