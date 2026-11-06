import { expect, test } from "@playwright/test";

const localUrl = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    return null;
  }
})();
const localOnly = process.env.E2E_LOCAL_SUPABASE === "1" &&
  process.env.NEXT_PUBLIC_ALLOW_LOCAL_SUPABASE_E2E === "1" &&
  localUrl?.protocol === "http:" &&
  localUrl.hostname === "127.0.0.1" &&
  localUrl.port === "54321" &&
  process.env.NODE_ENV !== "production";

test("local Supabase redirects unauthenticated visitors to sign-in", async ({ page }) => {
  test.skip(
    !localOnly,
    "Runs only against the explicitly enabled loopback Supabase stack.",
  );
  await page.goto("/");
  await expect.poll(() => page.url(), { timeout: 15_000 }).toContain("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" }))
    .toBeVisible();
});

test("local Phase 9 export and deletion flow uses the app UI and a disposable account", async ({ page }) => {
  test.skip(
    !localOnly,
    "Runs only against the explicitly enabled loopback Supabase stack.",
  );
  const email = process.env.E2E_LOCAL_ACCOUNT_EMAIL;
  const password = process.env.E2E_LOCAL_ACCOUNT_PASSWORD;
  test.skip(
    !email || !password || process.env.E2E_LOCAL_ACCOUNT_CONFIRM_DELETE !== "1",
    "Requires a disposable local Auth account and explicit deletion-test opt-in.",
  );

  await page.goto("/login");
  await page.getByRole("button", { name: "Need an account? Create one" })
    .click();
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect.poll(() => page.url(), { timeout: 30_000 }).toMatch(/\/$/);
  await expect(page.getByRole("heading", { name: "Vendrith Chat" }))
    .toBeVisible();

  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { name: "Account & sessions" }))
    .toBeVisible();
  await page.getByLabel("Current password").fill(password!);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^vendrith-chat-export-\d{4}-\d{2}-\d{2}\.json$/,
  );
  await expect(
    page.getByText(/Your Chat-only personal data export was prepared/),
  ).toBeVisible();

  await page.getByLabel("Current password").fill(password!);
  await page.getByLabel("Type DELETE MY VENDRITH ACCOUNT to confirm").fill(
    "DELETE MY VENDRITH ACCOUNT",
  );
  const deleteButton = page.getByRole("button", { name: "Request permanent deletion" });
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel("Password to authorize deletion").fill(password!);
  await expect(deleteButton).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Request permanent deletion" })
    .click();
  await expect.poll(() => page.url(), { timeout: 30_000 }).toContain("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" }))
    .toBeVisible();
});
