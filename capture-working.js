const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const baseUrl = 'http://localhost:3000';
  const screenshotDir = '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots';

  try {
    console.log('🚀 Starting screenshot capture...\n');

    // 1. Capture activate page
    console.log('📸 1/6: Activate page...');
    await page.goto(`${baseUrl}/activate`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${screenshotDir}/01-activate.png` });
    console.log('   ✅ Saved\n');

    // Fill and submit license
    const licenseInput = await page.$('#license-key');
    if (licenseInput) {
      await licenseInput.fill('DEMO-SOFI-2026-0001');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000); // Wait for redirect
      console.log(`   📍 Redirected to: ${page.url()}\n`);
    }

    // 2. Capture projects/missions page (wherever we end up)
    console.log('📸 2/6: Projects page...');
    await page.goto(`${baseUrl}/projects`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${screenshotDir}/02-projects.png` });
    console.log('   ✅ Saved\n');

    // Check if we have projects
    let projectLinks = await page.$$('a[href*="/projects/"]:not([href="/projects"])');
    console.log(`   Found ${projectLinks.length} project links`);
    
    // If no projects, try missions page directly
    if (projectLinks.length === 0) {
      console.log('   Trying missions page instead...');
      await page.goto(`${baseUrl}/missions`);
      await page.waitForTimeout(3000);
      
      const missionLinks = await page.$$('a[href*="/missions/"]:not([href="/missions"])');
      console.log(`   Found ${missionLinks.length} mission links`);
      
      if (missionLinks.length > 0) {
        // Use first mission
        console.log('\n📸 3/6: Mission detail (no projects, using missions directly)...');
        await missionLinks[0].click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${screenshotDir}/03-project-detail.png` });
        console.log('   ✅ Saved (mission detail)\n');

        // Continue from mission
        console.log('📸 4/6: Signals page...');
        const signalsLink = await page.$('a[href*="/signals"]');
        if (signalsLink) {
          await signalsLink.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `${screenshotDir}/04-signals.png` });
          console.log('   ✅ Saved\n');

          console.log('📸 5/6: Signal detail...');
          const signalLinks = await page.$$('a[href*="/signals/"]:not([href$="/signals"])');
          if (signalLinks.length > 0) {
            await signalLinks[0].click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: `${screenshotDir}/05-signal-detail.png` });
            console.log('   ✅ Saved\n');
            await page.goBack();
            await page.waitForTimeout(1000);
          }

          console.log('📸 6/6: Deliverables page...');
          const deliverablesLink = await page.$('a[href*="/deliverables"]');
          if (deliverablesLink) {
            await deliverablesLink.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: `${screenshotDir}/06-deliverables.png` });
            console.log('   ✅ Saved\n');
          }
        }
      }
    } else {
      // Use projects flow
      console.log('\n📸 3/6: Project detail...');
      await projectLinks[0].click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${screenshotDir}/03-project-detail.png` });
      console.log('   ✅ Saved\n');

      // Find missions in project
      const missionLinks = await page.$$('a[href*="/missions/"]');
      if (missionLinks.length > 0) {
        await missionLinks[0].click();
        await page.waitForTimeout(2000);
        
        console.log('📸 4/6: Signals page...');
        const signalsLink = await page.$('a[href*="/signals"]');
        if (signalsLink) {
          await signalsLink.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `${screenshotDir}/04-signals.png` });
          console.log('   ✅ Saved\n');

          console.log('📸 5/6: Signal detail...');
          const signalLinks = await page.$$('a[href*="/signals/"]:not([href$="/signals"])');
          if (signalLinks.length > 0) {
            await signalLinks[0].click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: `${screenshotDir}/05-signal-detail.png` });
            console.log('   ✅ Saved\n');
            await page.goBack();
            await page.waitForTimeout(1000);
          }

          console.log('📸 6/6: Deliverables page...');
          const deliverablesLink = await page.$('a[href*="/deliverables"]');
          if (deliverablesLink) {
            await deliverablesLink.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: `${screenshotDir}/06-deliverables.png` });
            console.log('   ✅ Saved\n');
          }
        }
      }
    }

    console.log('🎉 Complete!\n');
    
    const fs = require('fs');
    const files = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png')).sort();
    console.log('📋 Screenshots:');
    files.forEach(f => {
      const stats = fs.statSync(`${screenshotDir}/${f}`);
      console.log(`   ✓ ${f} (${Math.round(stats.size / 1024)}KB)`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
