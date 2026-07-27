import { expect, test } from "@playwright/test";

test("interacts with the generator story", async ({ mount }) => {
  const component = await mount("extension-page-preview/Generator");

  await expect(
    component.getByRole("heading", { name: "Stem generator" }),
  ).toBeVisible();
  await component.getByText("Advanced settings", { exact: true }).click();
  await expect(component.getByLabel("Backing mix")).toHaveValue("minus");
});

test("mounts saved-video variants", async ({ mount }) => {
  let component = await mount("ui/extension-page-preview/SavedVideos");
  await expect(component.getByText("3 videos using 57.6 MB")).toBeVisible();

  component = await mount("ui/extension-page-preview/EmptySavedVideos");
  await expect(component.getByText("No saved videos yet")).toBeVisible();
});

test("updates story props without navigating", async ({ mount }) => {
  const component = await mount(
    "ui/extension-page-preview/ConfigurableSavedVideos",
  );
  await expect(component.getByText("3 videos using 57.6 MB")).toBeVisible();

  await component.update({ empty: true });
  await expect(component.getByText("No saved videos yet")).toBeVisible();
});
