// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("@/app/members/actions.js", () => ({ updateProfileAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/components/admin/FileUpload.jsx", () => ({ default: () => <div>upload</div> }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: ProfileForm } = await import("@/components/members/ProfileForm.jsx");

afterEach(cleanup);

const member = {
  id: 1, slug: "judy-daliva", name: "Judy Daliva", email: "judy@x.ph", status: "active", photoUrl: null,
  profession: null, business: null, skills: null, bio: null, inDirectory: false, joinedAt: "2024-01-01",
  phone: null, websiteUrl: null, facebookUrl: null, linkedinUrl: null, instagramUrl: null,
  cardPublished: false, cardShowPhone: false, cardShowEmail: true,
};

describe("ProfileForm live preview", () => {
  it("updates the card as the member types and switches details on and off", () => {
    render(<ProfileForm member={member} positions={[]} />);
    const preview = () => within(screen.getByRole("complementary", { name: "Card preview" }));
    fireEvent.change(screen.getByLabelText("Profession"), { target: { value: "Engineer" } });
    expect(preview().getByText("Engineer")).toBeTruthy();
    expect(preview().getByRole("link", { name: "Email" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Mobile or phone"), { target: { value: "0917 123 4567" } });
    expect(preview().queryByRole("link", { name: "Call" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Show my phone on my card"));
    expect(preview().getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+639171234567");
    fireEvent.click(screen.getByLabelText("Show my email on my card"));
    expect(preview().queryByRole("link", { name: "Email" })).toBeNull();
  });

  it("asks for consent only when publishing", () => {
    render(<ProfileForm member={member} positions={[]} />);
    expect(screen.queryByLabelText(/I agree to show the details/)).toBeNull();
    fireEvent.click(screen.getByLabelText("Publish my e-calling card"));
    expect(screen.getByLabelText(/I agree to show the details/)).toBeTruthy();
  });
});
