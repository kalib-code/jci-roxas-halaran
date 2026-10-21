import { describe, it, expect, afterEach } from "vitest";
import { t, hilEnabled, languageAlternates, pathFor, STRINGS } from "@/lib/i18n.js";

afterEach(() => { delete process.env.NEXT_PUBLIC_HILIGAYNON; });

describe("i18n", () => {
  it("translates and falls back to English", () => {
    expect(t("hil", "join.title")).toBe("Mangin miyembro");
    expect(t("en", "join.title")).toBe("Become a member");
    expect(t("hil", "no.such.key")).toBe("no.such.key");
  });

  it("has an English string for every Hiligaynon key", () => {
    for (const key of Object.keys(STRINGS.hil)) expect(STRINGS.en[key], key).toBeTypeOf("string");
  });

  it("keeps the English form labels the site already uses", () => {
    expect(["form.fullName", "form.email", "form.birthdate", "form.apply", "form.amount", "form.reference", "form.submitPayment"].map((k) => t("en", k))).toEqual([
      "Full name", "Email", "Birthdate", "Apply", "Amount (₱)", "Reference number", "Submit payment details",
    ]);
  });

  it("is off unless the flag is on", () => {
    expect(hilEnabled()).toBe(false);
    expect(languageAlternates("/join")).toBeUndefined();
    process.env.NEXT_PUBLIC_HILIGAYNON = "on";
    expect(hilEnabled()).toBe(true);
    expect(languageAlternates("/join")).toEqual({ en: "/join", hil: "/hil/join" });
  });

  it("maps paths between languages", () => {
    expect(pathFor("hil", "/")).toBe("/hil");
    expect(pathFor("en", "/support")).toBe("/support");
  });
});
