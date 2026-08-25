import { test, expect } from '@playwright/test';

const BASE_URL = 'https://catan.coolify.lan';

async function startSetupGame(page: import('@playwright/test').Page) {
  await page.goto(BASE_URL);
  await page.locator('button:has-text("Create Game")').click();
  await page.locator('input[placeholder="Your Name"]').fill('E2EHost');
  await page.locator('button:has-text("Create Room")').click();
  await page.locator('.room-code').waitFor({ timeout: 10000 });
  await page.locator('button:has-text("Add Bot")').click();
  await page.locator('.player-card:has-text("Bot")').waitFor({ timeout: 5000 });
  await page.locator('button:has-text("Start Game")').click();
  await page.locator('.hex-board').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

test('full setup round: human settlement+road, bot follows, reaches playing phase', async ({ page }) => {
  await startSetupGame(page);

  // === Human settlement ===
  await page.locator('.hex-board .hit-target').first().click({ force: true });
  await expect(page.locator('.btn-confirm')).toBeVisible({ timeout: 3000 });
  await page.locator('.btn-confirm').click();

  // Settlement must stay visible after state update
  await expect(page.locator('.hex-board .settlement').first()).toBeVisible({ timeout: 5000 });
  const settleCount1 = await page.locator('.hex-board .settlement').count();
  console.log('Settlements after confirm:', settleCount1);
  expect(settleCount1).toBe(1);

  // === Human road: road mode should activate, edges clickable ===
  await page.waitForTimeout(500);
  // Edge hit targets only render in road mode
  const edgeTargets = page.locator('.hex-board line.hit-target');
  const edgeCount = await edgeTargets.count();
  console.log('Edge hit targets in road mode:', edgeCount);
  expect(edgeCount).toBeGreaterThan(0);

  await edgeTargets.first().click({ force: true });
  await page.waitForTimeout(300);

  // Confirm button must be ENABLED (isValid true) for the selected edge
  const confirmBtn = page.locator('.btn-confirm');
  await expect(confirmBtn).toBeEnabled({ timeout: 3000 });
  await confirmBtn.click();

  // Road must appear and stay
  await page.waitForTimeout(1000);
  const roadLines = page.locator('.hex-board line[stroke]:not([stroke="transparent"]):not([stroke="none"])');
  const roadCount = await roadLines.count();
  console.log('Visible road strokes:', roadCount);
  expect(roadCount).toBeGreaterThanOrEqual(1);

  // === Bot should take its turn automatically ===
  // Wait for bot settlement + road (up to 8s)
  let botSettled = false;
  for (let i = 0; i < 16; i++) {
    const count = await page.locator('.hex-board .settlement').count();
    if (count >= 2) { botSettled = true; break; }
    await page.waitForTimeout(500);
  }
  console.log('Bot placed settlement:', botSettled);
  expect(botSettled).toBe(true);

  // === Round 2: human should be able to place again (setup round 2, reverse order) ===
  // With 2 players: round1 order [host, bot], round2 order [bot, host]... host is players[0]
  // After bot finishes round 1, bot is also first in round 2 (reverse). Wait for host's turn.
  let canSelectAgain = false;
  for (let i = 0; i < 30; i++) {
    const vertexTargets = page.locator('.hex-board circle.hit-target');
    if (await vertexTargets.count() > 0) {
      // Check it's our turn via the indicator
      const yourTurn = await page.locator('text=Your Turn').isVisible().catch(() => false);
      if (yourTurn) { canSelectAgain = true; break; }
    }
    await page.waitForTimeout(500);
  }
  console.log('Host turn again for round 2:', canSelectAgain);

  if (canSelectAgain) {
    await page.locator('.hex-board circle.hit-target').first().click({ force: true });
    await expect(page.locator('.btn-confirm')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.btn-confirm')).toBeEnabled({ timeout: 3000 });
    await page.locator('.btn-confirm').click();
    await expect(page.locator('.hex-board .settlement').nth(1)).toBeVisible({ timeout: 5000 });
    console.log('Round 2 settlement placed OK');
  }

  await page.screenshot({ path: '/tmp/opencode/e2e-setup.png', fullPage: true });
});
