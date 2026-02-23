const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // 1. Activate page
    console.log('📸 Capturing 01-activate.png...');
    await page.goto('http://localhost:3000/activate', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/01-activate.png',
      fullPage: false
    });

    // 2. Projects page
    console.log('📸 Capturing 02-projects.png...');
    await page.goto('http://localhost:3000/projects', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/02-projects.png',
      fullPage: false
    });

    // 3. Try to find and click a project link
    console.log('🔍 Looking for project links...');
    const projectLink = await page.locator('a[href*="/projects/"]').first();
    if (await projectLink.count() > 0) {
      console.log('✅ Found project link, clicking...');
      await projectLink.click();
      await page.waitForTimeout(2000);
      
      console.log('📸 Capturing 03-project-detail.png...');
      await page.screenshot({ 
        path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/03-project-detail.png',
        fullPage: false
      });

      // 4. Look for missions link
      console.log('🔍 Looking for missions...');
      const missionLink = await page.locator('a[href*="/missions/"]').first();
      if (await missionLink.count() > 0) {
        console.log('✅ Found mission, navigating...');
        await missionLink.click();
        await page.waitForTimeout(2000);
        
        // Try to navigate to signals page
        const signalsLink = await page.locator('a[href*="/signals"]').first();
        if (await signalsLink.count() > 0) {
          console.log('✅ Found signals link, clicking...');
          await signalsLink.click();
          await page.waitForTimeout(2000);
          
          console.log('📸 Capturing 04-signals.png...');
          await page.screenshot({ 
            path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/04-signals.png',
            fullPage: false
          });

          // 5. Try to click a signal
          console.log('🔍 Looking for signal details...');
          const signalDetailLink = await page.locator('a[href*="/signals/"]').first();
          if (await signalDetailLink.count() > 0) {
            console.log('✅ Found signal detail, clicking...');
            await signalDetailLink.click();
            await page.waitForTimeout(2000);
            
            console.log('📸 Capturing 05-signal-detail.png...');
            await page.screenshot({ 
              path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/05-signal-detail.png',
              fullPage: false
            });
          } else {
            console.log('⚠️  No signal details found');
          }

          // 6. Navigate to deliverables
          console.log('🔍 Looking for deliverables...');
          const deliverablesLink = await page.locator('a[href*="/deliverables"]').first();
          if (await deliverablesLink.count() > 0) {
            console.log('✅ Found deliverables link, clicking...');
            await deliverablesLink.click();
            await page.waitForTimeout(2000);
            
            console.log('📸 Capturing 06-deliverables.png...');
            await page.screenshot({ 
              path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/06-deliverables.png',
              fullPage: false
            });
          } else {
            console.log('⚠️  No deliverables link found');
          }
        } else {
          console.log('⚠️  No signals link found');
        }
      } else {
        console.log('⚠️  No missions found');
      }
    } else {
      console.log('⚠️  No project links found - checking if we need to seed data');
    }

    console.log('\n✅ Screenshot capture complete!');
    console.log('📁 Screenshots saved to: /Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/');
    
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
})();
