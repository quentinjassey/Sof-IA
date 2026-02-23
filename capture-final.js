const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  // Enable console logging from the page
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`   ⚠️  Browser console error: ${msg.text()}`);
    }
  });
  
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
    console.log('   ✅ Saved 01-activate.png');

    // Activate license
    const licenseInput = await page.$('input');
    if (licenseInput) {
      console.log('   🔑 Filling license key...');
      await licenseInput.fill('DEMO-SOFI-2026-0001');
      await page.waitForTimeout(500);
      
      const submitButton = await page.$('button[type="submit"]');
      if (submitButton) {
        console.log('   🔑 Submitting license...');
        await submitButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        // Check if we're on setup page
        const currentUrl = page.url();
        console.log(`   📍 Current URL: ${currentUrl}`);
        
        if (currentUrl.includes('/setup')) {
          console.log('   👤 On setup page, filling profile...');
          await page.waitForTimeout(1000);
          
          const inputs = await page.$$('input[type="text"]');
          if (inputs.length >= 3) {
            await inputs[0].fill('Jean Dupont');
            await inputs[1].fill('12345');
            await inputs[2].fill('Cabinet Test');
            
            const setupButton = await page.$('button[type="submit"]');
            if (setupButton) {
              console.log('   👤 Submitting profile...');
              await setupButton.click();
              await page.waitForLoadState('networkidle');
              await page.waitForTimeout(2000);
              console.log(`   📍 After setup URL: ${page.url()}`);
            }
          }
        }
      }
    }
    
    // Verify cookies
    const cookies = await context.cookies();
    console.log(`   🍪 Cookies set: ${cookies.length}`);
    console.log('\n');

    // 2. Capture projects page
    console.log('📸 2/6: Capturing projects page...');
    await page.goto(`${baseUrl}/projects`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // Wait longer for API call
    
    // Check page content
    const pageText = await page.textContent('body');
    if (pageText.includes('Aucun projet') || pageText.includes('No projects')) {
      console.log('   ℹ️  Page shows no projects');
    }
    
    await page.screenshot({ 
      path: `${screenshotDir}/02-projects.png`,
      fullPage: false
    });
    console.log('   ✅ Saved 02-projects.png');
    
    // Try to find project links
    const projectLinks = await page.$$('a[href*="/projects/"]:not([href="/projects"])');
    console.log(`   📊 Found ${projectLinks.length} project links\n`);

    if (projectLinks.length > 0) {
      // 3. Project detail
      console.log('📸 3/6: Navigating to project detail...');
      await projectLinks[0].click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: `${screenshotDir}/03-project-detail.png`,
        fullPage: false
      });
      console.log('   ✅ Saved 03-project-detail.png\n');

      // 4. Signals page
      console.log('📸 4/6: Looking for signals page...');
      
      // First check if we need to go to a mission
      let signalsLink = await page.$('a[href*="/signals"]');
      
      if (!signalsLink) {
        // Try to find a mission link first
        const missionLinks = await page.$$('a[href*="/missions/"]');
        console.log(`   📊 Found ${missionLinks.length} mission links`);
        if (missionLinks.length > 0) {
          await missionLinks[0].click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          signalsLink = await page.$('a[href*="/signals"]');
        }
      }
      
      if (signalsLink) {
        await signalsLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        await page.screenshot({ 
          path: `${screenshotDir}/04-signals.png`,
          fullPage: false
        });
        console.log('   ✅ Saved 04-signals.png\n');

        // 5. Signal detail
        console.log('📸 5/6: Looking for signal detail...');
        const signalLinks = await page.$$('a[href*="/signals/"]:not([href$="/signals"])');
        console.log(`   📊 Found ${signalLinks.length} signal detail links`);
        
        if (signalLinks.length > 0) {
          await signalLinks[0].click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          await page.screenshot({ 
            path: `${screenshotDir}/05-signal-detail.png`,
            fullPage: false
          });
          console.log('   ✅ Saved 05-signal-detail.png\n');
          
          await page.goBack();
          await page.waitForTimeout(1000);
        } else {
          console.log('   ⚠️  No signal details found\n');
        }

        // 6. Deliverables
        console.log('📸 6/6: Looking for deliverables page...');
        const deliverablesLink = await page.$('a[href*="/deliverables"]');
        
        if (deliverablesLink) {
          await deliverablesLink.click();
          await page.waitForLoadState('networkidle');
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
      console.log('⚠️  Could not navigate further - no projects available\n');
    }

    console.log('🎉 Screenshot capture complete!\n');
    
    // List captured files
    const fs = require('fs');
    const files = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png')).sort();
    console.log('📋 Captured screenshots:');
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
