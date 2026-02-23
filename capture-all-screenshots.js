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
    console.log('📸 1/6: Capturing activate page...');
    await page.goto(`${baseUrl}/activate`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: `${screenshotDir}/01-activate.png`,
      fullPage: false
    });
    console.log('   ✅ Saved 01-activate.png\n');

    // Activate license if not already done
    const licenseInput = await page.$('input[placeholder*="clé"], input[type="text"]');
    if (licenseInput) {
      console.log('   🔑 Activating license...');
      await licenseInput.fill('DEMO-SOFI-2026-0001');
      await page.waitForTimeout(500);
      
      const submitButton = await page.$('button[type="submit"], button:has-text("Activer")');
      if (submitButton) {
        await submitButton.click();
        await page.waitForTimeout(2000);
        
        // Fill profile if needed
        const currentUrl = page.url();
        if (currentUrl.includes('/setup')) {
          console.log('   👤 Setting up profile...');
          const nameInput = await page.$('input[name="name"]');
          if (nameInput) {
            await nameInput.fill('Jean Dupont');
            const cnccInput = await page.$('input[name="cncc_number"]');
            if (cnccInput) await cnccInput.fill('12345');
            const cabinetInput = await page.$('input[name="cabinet"]');
            if (cabinetInput) await cabinetInput.fill('Cabinet Test');
            
            const setupButton = await page.$('button[type="submit"]');
            if (setupButton) {
              await setupButton.click();
              await page.waitForTimeout(2000);
            }
          }
        }
      }
    }

    // 2. Capture projects page
    console.log('📸 2/6: Capturing projects page...');
    await page.goto(`${baseUrl}/projects`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: `${screenshotDir}/02-projects.png`,
      fullPage: false
    });
    console.log('   ✅ Saved 02-projects.png\n');

    // 3. Find and click on a project
    console.log('📸 3/6: Navigating to project detail...');
    const projectLinks = await page.$$('a[href*="/projects/"]');
    console.log(`   Found ${projectLinks.length} project links`);
    
    if (projectLinks.length > 0) {
      await projectLinks[0].click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: `${screenshotDir}/03-project-detail.png`,
        fullPage: false
      });
      console.log('   ✅ Saved 03-project-detail.png\n');

      // 4. Navigate to a mission and then to signals
      console.log('📸 4/6: Looking for signals page...');
      
      // Try to find missions first
      let signalsLink = await page.$('a[href*="/signals"]');
      
      // If no signals link at project level, try to go to a mission first
      if (!signalsLink) {
        const missionLinks = await page.$$('a[href*="/missions/"]');
        console.log(`   Found ${missionLinks.length} mission links`);
        if (missionLinks.length > 0) {
          await missionLinks[0].click();
          await page.waitForTimeout(2000);
          signalsLink = await page.$('a[href*="/signals"]');
        }
      }
      
      if (signalsLink) {
        await signalsLink.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ 
          path: `${screenshotDir}/04-signals.png`,
          fullPage: false
        });
        console.log('   ✅ Saved 04-signals.png\n');

        // 5. Navigate to signal detail
        console.log('📸 5/6: Looking for signal detail...');
        const signalDetailLinks = await page.$$('a[href*="/signals/"]:not([href$="/signals"])');
        console.log(`   Found ${signalDetailLinks.length} signal detail links`);
        
        if (signalDetailLinks.length > 0) {
          await signalDetailLinks[0].click();
          await page.waitForTimeout(2000);
          await page.screenshot({ 
            path: `${screenshotDir}/05-signal-detail.png`,
            fullPage: false
          });
          console.log('   ✅ Saved 05-signal-detail.png\n');
          
          // Go back to find deliverables
          await page.goBack();
          await page.waitForTimeout(1000);
        } else {
          console.log('   ⚠️  No signal detail links found\n');
        }

        // 6. Navigate to deliverables
        console.log('📸 6/6: Looking for deliverables page...');
        const deliverablesLink = await page.$('a[href*="/deliverables"]');
        
        if (deliverablesLink) {
          await deliverablesLink.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ 
            path: `${screenshotDir}/06-deliverables.png`,
            fullPage: false
          });
          console.log('   ✅ Saved 06-deliverables.png\n');
        } else {
          console.log('   ⚠️  No deliverables link found\n');
        }
      } else {
        console.log('   ⚠️  No signals link found\n');
      }
    } else {
      console.log('   ⚠️  No project links found\n');
    }

    console.log('\n🎉 Screenshot capture complete!');
    console.log(`📁 Screenshots saved to: ${screenshotDir}/`);
    
    // List all captured screenshots
    const fs = require('fs');
    const files = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png')).sort();
    console.log('\n📋 Captured screenshots:');
    files.forEach(f => console.log(`   - ${f}`));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
