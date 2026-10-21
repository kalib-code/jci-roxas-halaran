// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/app/admin/evidence/actions.js", () => ({ saveSnapshotAction: async () => ({ ok: true }) }));
const { default: SnapshotForm } = await import("@/components/admin/SnapshotForm.jsx");

afterEach(cleanup);

describe("SnapshotForm", () => {
  it("loads the chosen month's saved numbers instead of carrying the current month's over", () => {
    const snapshots = [{ month: "2026-11", organicClicks: 150, impressions: 4500, visitors: 900, note: "Nov" }];
    render(<SnapshotForm months={["2026-10", "2026-11"]} month="2026-11" snapshots={snapshots} />);
    expect(screen.getByLabelText("Organic clicks (Search Console)").value).toBe("150");
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-10" } });
    expect(screen.getByLabelText("Organic clicks (Search Console)").value).toBe("");
    expect(screen.getByLabelText("Note").value).toBe("");
  });
});
