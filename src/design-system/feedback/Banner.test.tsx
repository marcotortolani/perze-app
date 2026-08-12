// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { Banner } from "./Banner";

afterEach(cleanup);

const messages = {
  ds: { banner: { offline: "Sin conexión — seguís operando normalmente.", pending: "{count} pendiente(s)" } },
};

function renderBanner(props: Partial<React.ComponentProps<typeof Banner>> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <Banner {...props} />
    </NextIntlClientProvider>
  );
}

describe("Banner — layout a prueba de mobile angosto", () => {
  it("el mensaje puede encoger y hacer wrap (flex:1, minWidth:0) en vez de desbordar", () => {
    renderBanner({ message: "Un mensaje bastante largo para forzar el wrap en pantallas angostas" });
    const message = screen.getByText(/mensaje bastante largo/);
    expect(message.style.flex).toBe("1 1 0%"); // shorthand normalizado del navegador para `flex: 1`
    expect(message.style.minWidth).toBe("0");
  });

  it("el contador de pendientes nunca se parte en dos líneas ni se achica", () => {
    renderBanner({ pending: 3 });
    const pending = screen.getByText("3 pendiente(s)");
    expect(pending.style.whiteSpace).toBe("nowrap");
    expect(pending.style.flexShrink).toBe("0");
  });

  it("el botón de acción nunca se parte en dos líneas ni se achica", () => {
    renderBanner({ status: "error", message: "Hay un conflicto", action: { label: "Revisar", onClick: () => {} } });
    const button = screen.getByRole("button", { name: "Revisar" });
    expect(button.style.whiteSpace).toBe("nowrap");
    expect(button.style.flexShrink).toBe("0");
  });

  it("con pending Y action a la vez, el pending no compite por el marginLeft:auto — solo lo usa la acción", () => {
    renderBanner({ status: "error", message: "Hay un conflicto", pending: 2, action: { label: "Revisar", onClick: () => {} } });
    const pending = screen.getByText("2 pendiente(s)");
    const button = screen.getByRole("button", { name: "Revisar" });
    expect(pending.style.marginLeft).toBe("");
    expect(button.style.marginLeft).toBe("auto");
  });
});
