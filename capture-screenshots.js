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
    const projectLinks = await page.$$('a[href*="/projects/"]');
    if (projectLinks.length > 0) {
      console.log(`✅ Found ${projectLinks.length} project links, clicking first one...`);
      await projectLinks[0].click();
      await page.waitForTimeout(2000);
      
      console.log('📸 Capturing 03-project-detail.png...');
      await page.screenshot({ 
        path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/03-project-detail.png',
        fullPage: false
      });

      // 4. Look for missions/signals links
      console.log('🔍 Looking for missions...');
      const missionLinks = await page.$$('a[href*="/missions/"]');
      if (missionLinks.length > 0) {
        console.log(`✅ Found ${missionLinks.length} mission links, looking for signals...`);
        
        // Try to navigate to signals page
        const signalsLink = await page.$('a[href*="/signals"]');
        if (signalsLink) {
          console.log('✅ Found signals link, clicking...');
          await signalsLink.click();
          await page.waitForTimeout(2000);
          
          console.log('📸 Capturing 04-signals.png...');
          await page.screenshot({ 
            path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/04-signals.png',
            fullPage: false
          });

          // 5. Try to click a signal for detail view
          console.log('🔍 Looking for signal details...');
          const signalLinks = await page.$$('a[href*="/signals/"]');
          if (signalLinks.length > 0) {
            console.log(`✅ Found ${signalLinks.length} signal links, clicking first one...`);
            await signalLinks[0].click();
            await page.waitForTimeout(2000);
            
            console.log('📸 Capturing 05-signal-detail.png...');
            await page.screenshot({ 
              path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/05-signal-detail.png',
              fullPage: false
            });
          } else {
            console.log('⚠️  No signal detail links found');
          }

          // 6. Navigate to deliverables
          console.log('🔍 Looking for deliverables...');
          const deliverablesLink = await page.$('a[href*="/deliverables"]');
          if (deliverablesLink) {
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
        console.log('⚠️  No mission links found');
      }
    } else {
      console.log('⚠️  No project links found - may need to seed database');
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
