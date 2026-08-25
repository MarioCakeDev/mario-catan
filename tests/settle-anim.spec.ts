import { test, expect } from '@playwright/test';

test('settlement stays at clicked position after animation', async ({ page }) => {
  await page.goto('https://catan.coolify.lan');
  await page.locator('button:has-text("Create Game")').click();
  await page.locator('input[placeholder="Your Name"]').fill('AnimTest');
  await page.locator('button:has-text("Create Room")').click();
  await page.locator('button:has-text("Add Bot")').click();
  await page.locator('button:has-text("Start Game")').click();
  await page.locator('.hex-board').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);

  // Record the ghost position when clicked
  await page.locator('.hex-board .hit-target').first().click({ force: true });
  await page.waitForTimeout(100);

  const ghostBox = await page.locator('.ghost-settlement').boundingBox();
  console.log('Ghost box:', JSON.stringify(ghostBox));

  // Confirm placement
  await page.locator('.btn-confirm').click();
  await page.waitForTimeout(1000); // let popIn finish + state update

  const settleBox = await page.locator('.settlement').first().boundingBox();
  console.log('Settlement box:', JSON.stringify(settleBox));

  // Settlement should be within ~15px of where the ghost was
  expect(settleBox).not.toBeNull();
  expect(ghostBox).not.toBeNull();
  const dx = Math.abs(settleBox!.x - ghostBox!.x);
  const dy = Math.abs(settleBox!.y - ghostBox!.y);
  console.log(`Delta: dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}`);
  expect(dx).toBeLessThan(15);
  expect(dy).toBeLessThan(15);

  await page.locator('.board-container').screenshot({ path: '/tmp/opencode/settle-placed.png' });
});
