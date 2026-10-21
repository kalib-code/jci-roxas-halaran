// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import GooglePreview, { previewTitle, previewDescription } from "@/components/admin/GooglePreview.jsx";
import FileUpload from "@/components/admin/FileUpload.jsx";

afterEach(cleanup);

describe("GooglePreview", () => {
  it("truncates like a search result", () => {
    expect(previewTitle("x".repeat(70))).toBe(`${"x".repeat(59)}…`);
    expect(previewDescription("y".repeat(200))).toBe(`${"y".repeat(157)}…`);
  });

  it("shows the URL the article will have", () => {
    render(<GooglePreview title="Rizal Day" slug="rizal-day" description="d" basePath="/articles" />);
    expect(screen.getByText(/jciroxashalaran\.com › articles › rizal-day/)).toBeTruthy();
  });
});

describe("FileUpload", () => {
  it("keeps the upload button disabled until alt text is written", () => {
    render(<FileUpload accept="image/*" requireAlt label="Cover image" onUploaded={() => {}} />);
    const button = screen.getByRole("button", { name: "Upload" });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Alt text (describe the image)"), { target: { value: "Volunteers" } });
    expect(button.disabled).toBe(true); // still no file
  });

  it("shows the file-type message before uploading", () => {
    render(<FileUpload accept="image/*" requireAlt label="Cover image" onUploaded={() => {}} />);
    const file = new File(["x"], "IMG_0001.HEIC", { type: "image/heic" });
    fireEvent.change(screen.getByLabelText("Cover image"), { target: { files: [file] } });
    expect(screen.getByRole("alert").textContent).toContain("share as JPG first");
  });
});
