const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const baseUrl = 'http://localhost:3000';
  const screenshotDir = '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots';
  
  // Known mission and signal IDs from database
  const missionId = '76326e20-e4b7-48e1-a267-c67630f689ea';
  const signalId = '1f93b3eb-a4a3-4085-b9e9-24b5967a1a4d';

  try {
    console.log('🚀 Starting screenshot capture with direct URLs...\n');

    // 1. Activate page
    console.log('📸 1/6: Activate page...');
    await page.goto(`${baseUrl}/activate`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotDir}/01-activate.png` });
    console.log('   ✅ Saved 01-activate.png\n');

    // Submit license
    const licenseInput = await page.$('#license-key');
    if (licenseInput) {
      console.log('   🔑 Activating license...');
      await licenseInput.fill('DEMO-SOFI-2026-0001');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    // 2. Projects page
    console.log('📸 2/6: Projects page...');
    await page.goto(`${baseUrl}/projects`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${screenshotDir}/02-projects.png` });
    console.log('   ✅ Saved 02-projects.png\n');

    // 3. Mission detail (as project detail since missions are top-level)
    console.log('📸 3/6: Mission detail (using as project detail)...');
    await page.goto(`${baseUrl}/missions/${missionId}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${screenshotDir}/03-project-detail.png` });
    console.log('   ✅ Saved 03-project-detail.png\n');

    // 4. Signals page
    console.log('📸 4/6: Signals page...');
    await page.goto(`${baseUrl}/missions/${missionId}/signals`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${screenshotDir}/04-signals.png` });
    console.log('   ✅ Saved 04-signals.png\n');

    // 5. Signal detail
    console.log('📸 5/6: Signal detail...');
    await page.goto(`${baseUrl}/missions/${missionId}/signals/${signalId}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${screenshotDir}/05-signal-detail.png` });
    console.log('   ✅ Saved 05-signal-detail.png\n');

    // 6. Deliverables page
    console.log('📸 6/6: Deliverables page...');
    await page.goto(`${baseUrl}/missions/${missionId}/deliverables`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${screenshotDir}/06-deliverables.png` });
    console.log('   ✅ Saved 06-deliverables.png\n');

    console.log('🎉 Screenshot capture complete!\n');
    
    // List all screenshots
    const fs = require('fs');
    const files = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png')).sort();
    console.log('📋 All screenshots:');
    files.forEach(f => {
      const stats = fs.statSync(`${screenshotDir}/${f}`);
      console.log(`   ✓ ${f} (${Math.round(stats.size / 1024)}KB)`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
