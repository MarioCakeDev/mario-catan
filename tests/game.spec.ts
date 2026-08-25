import { test, expect } from '@playwright/test';

const BASE_URL = 'https://catan.coolify.lan';

test.describe('Catan Game', () => {

  test('full setup flow: settlement + road placement', async ({ page }) => {
    // 1. Go to home page and create room
    await page.goto(BASE_URL);
    await page.locator('button:has-text("Create Game")').click();
    await page.locator('input[placeholder="Your Name"]').fill('TestHost');
    await page.locator('button:has-text("Create Room")').click();

    // 2. Lobby
    await expect(page.locator('.room-code')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Add Bot")').click();
    await expect(page.locator('.player-card:has-text("Bot")')).toBeVisible({ timeout: 5000 });

    // 3. Start game
    await page.locator('button:has-text("Start Game")').click();
    await expect(page.locator('.hex-board')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // 4. Log board info
    const boardInfo = await page.evaluate(() => {
      const hitTargets = document.querySelectorAll('.hit-target');
      const validSpots = document.querySelectorAll('.valid-spot-indicator');
      const vertexGroups = document.querySelectorAll('.vertex-group');
      return {
        hitTargetCount: hitTargets.length,
        validSpotCount: validSpots.length,
        vertexGroupCount: vertexGroups.length,
      };
    });
    console.log('Board:', JSON.stringify(boardInfo));

    // 5. Click a valid vertex (one with the pulsing dot indicator)
    // The hit-target circles have r=24 and are transparent
    const hitTargets = page.locator('.hex-board .hit-target');
    const hitCount = await hitTargets.count();
    console.log('Hit targets:', hitCount);
    expect(hitCount).toBeGreaterThan(0);

    // Click the first hit target
    await hitTargets.first().click({ force: true });
    await page.waitForTimeout(750);

    // 6. Screenshot after click
    await page.screenshot({ path: '/tmp/mario-catan/test-after-click.png' });

    // 7. Check what happened
    const afterClick = await page.evaluate(() => {
      const ghostSettlement = document.querySelector('.ghost-settlement');
      const confirmBtn = document.querySelector('.btn-confirm');
      const mobileControls = document.querySelector('.mobile-placement-controls');
      const selectedVertex = document.querySelector('.vertex-group.selected');
      return {
        hasGhost: !!ghostSettlement,
        hasConfirmBtn: !!confirmBtn,
        hasMobileControls: !!mobileControls,
        hasSelectedVertex: !!selectedVertex,
        bodyClasses: document.body.className,
        allText: document.body.innerText.substring(0, 500),
      };
    });
    console.log('After click:', JSON.stringify(afterClick));

    // 8. If confirm button exists, click it
    if (afterClick.hasConfirmBtn) {
      await page.locator('.btn-confirm').click();
      await page.waitForTimeout(1500);

      const afterConfirm = await page.evaluate(() => {
        return {
          bodyText: document.body.innerText.substring(0, 500),
          hasRoadMode: document.body.innerText.includes('road') || document.body.innerText.includes('Road'),
          settlementCount: document.querySelectorAll('.settlement').length,
        };
      });
      console.log('After confirm:', JSON.stringify(afterConfirm));
      await page.screenshot({ path: '/tmp/mario-catan/test-after-confirm.png' });
    }

    // 9. Try clicking "Settlement" button in action bar first, then vertex
    const settlementBtn = page.locator('button:has-text("Settlement")');
    const hasSettlementBtn = await settlementBtn.isVisible().catch(() => false);
    console.log('Settlement action bar button visible:', hasSettlementBtn);

    if (hasSettlementBtn && !afterClick.hasConfirmBtn) {
      // Click settlement button to enter build mode
      await settlementBtn.click();
      await page.waitForTimeout(500);

      // Now try clicking a vertex
      const targetsAfterMode = page.locator('.hex-board .hit-target');
      const targetCount = await targetsAfterMode.count();
      console.log('Targets after entering settlement mode:', targetCount);

      if (targetCount > 0) {
        await targetsAfterMode.first().click({ force: true });
        await page.waitForTimeout(750);

        const afterModeClick = await page.evaluate(() => {
          return {
            hasConfirmBtn: !!document.querySelector('.btn-confirm'),
            hasGhost: !!document.querySelector('.ghost-settlement'),
            selectedVertex: !!document.querySelector('.vertex-group.selected'),
          };
        });
        console.log('After mode click:', JSON.stringify(afterModeClick));

        if (afterModeClick.hasConfirmBtn) {
          await page.locator('.btn-confirm').click();
          await page.waitForTimeout(1500);
        }
      }
    }

    await page.screenshot({ path: '/tmp/mario-catan/test-final-state.png', fullPage: true });
  });
});
