import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaceholderPage } from "../placeholder-page";

describe("PlaceholderPage", () => {
  it("renders title and phase badge", () => {
    render(
      <PlaceholderPage
        title="Drugs"
        phase="Studio 4.2"
        description="Structural placeholder for the drug editor route."
      />,
    );

    expect(screen.getByRole("heading", { name: "Drugs" })).toBeInTheDocument();
    expect(screen.getByText("Studio 4.2")).toBeInTheDocument();
    expect(screen.getByText(/Structural placeholder/)).toBeInTheDocument();
  });
});
