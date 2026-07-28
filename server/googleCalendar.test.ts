import { describe, expect, it } from "vitest";

describe("Google Calendar OAuth credentials", () => {
  it("GOOGLE_CLIENT_ID is set and has correct format", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
    expect(clientId).toBeTruthy();
    // Google OAuth Client IDs end with .apps.googleusercontent.com
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("GOOGLE_CLIENT_SECRET is set and has correct format", () => {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
    expect(clientSecret).toBeTruthy();
    // Google OAuth Client Secrets start with GOCSPX-
    expect(clientSecret).toMatch(/^GOCSPX-/);
  });

  it("credentials are not placeholder values", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
    expect(clientId).not.toBe("");
    expect(clientSecret).not.toBe("");
    expect(clientId).not.toContain("YOUR_");
    expect(clientSecret).not.toContain("YOUR_");
  });
});
