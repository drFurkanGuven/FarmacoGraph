import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError } from "@/lib/api/errors";
import { LanguageProvider } from "@/lib/i18n/context";
import { ApiErrorPanel } from "../api-error-panel";

function render(error: unknown): string {
  // No document in SSR: provider falls back to the default (Turkish) dictionary.
  return renderToStaticMarkup(
    <LanguageProvider>
      <ApiErrorPanel error={error} />
    </LanguageProvider>
  );
}

describe("ApiErrorPanel", () => {
  it("shows an explicit sign-in call for 401 without faking access", () => {
    const html = render(new ApiError("Missing authentication", 401));
    expect(html).toContain("Giriş gerekli");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Giriş yap");
  });

  it("shows an explicit sign-in call for 403", () => {
    const html = render(new ApiError("Forbidden", 403));
    expect(html).toContain('href="/login"');
  });

  it("never shows a login prompt or sample data for transport errors", () => {
    const html = render(new ApiError("Connection refused", 0));
    expect(html).toContain("Bilgi API");
    expect(html).not.toContain('href="/login"');
    expect(html).toContain("örnek veri");
  });
});
