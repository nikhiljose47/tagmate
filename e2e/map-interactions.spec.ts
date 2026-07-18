import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth.helpers';
import { testUsers } from './helpers/test-users';

test.describe('E2E Map Suite: Controls & Metadata Inspector', () => {
  test('Should load hood map, display metadata inspector, and toggle layer settings', async ({ page }) => {
    // 1. Log in
    await loginAs(page, testUsers[0]);
    await expect(page).toHaveURL(/\/feed/);

    // 2. Navigate to Map page (/hood)
    await page.goto('/hood');

    // Verify map container element is rendered
    const mapElement = page.locator('#map');
    await expect(mapElement).toBeVisible();

    // Verify Map Inspector is present
    const mapInspector = page.locator('aside.map-inspector');
    await expect(mapInspector).toBeVisible();

    // Verify default inspector header displays visible posts summary
    await expect(mapInspector.locator('h2')).toContainText(/visible posts|posts/i);

    // Verify presence of layer toggle controls (e.g. Heatmap & Boundary)
    const heatmapToggleLabel = page.locator('label:has-text("Heatmap")');
    const boundaryToggleLabel = page.locator('label:has-text("Boundary")');
    await expect(heatmapToggleLabel).toBeVisible();
    await expect(boundaryToggleLabel).toBeVisible();

    // 3. Toggle Heatmap layer checkbox
    const heatmapInput = heatmapToggleLabel.locator('input[type="checkbox"]');
    const initialHeatmapChecked = await heatmapInput.isChecked();

    // Toggle the switch
    await heatmapToggleLabel.click();

    // Verify checked state is toggled
    const updatedHeatmapChecked = await heatmapInput.isChecked();
    expect(updatedHeatmapChecked).not.toBe(initialHeatmapChecked);

    // Toggle Boundary layer
    const boundaryInput = boundaryToggleLabel.locator('input[type="checkbox"]');
    const initialBoundaryChecked = await boundaryInput.isChecked();
    await boundaryToggleLabel.click();
    const updatedBoundaryChecked = await boundaryInput.isChecked();
    expect(updatedBoundaryChecked).not.toBe(initialBoundaryChecked);
  });
});
