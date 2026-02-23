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
    // 1. Capture activate page
    console.log('📸 1/6: Capturing activate page...');
    await page.goto(`${baseUrl}/activate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: `${screenshotDir}/01-activate.png`,
      fullPage: false
    });

    // Try to activate if there's an input field
    const licenseInput = await page.$('input[type="text"]');
    if (licenseInput) {
      console.log('🔑 Activating license...');
      await licenseInput.fill('DEMO-SOFI-2026-0001');
      await page.waitForTimeout(500);
      
      const activateButton = await page.$('button[type="submit"]');
      if (activateButton) {
        await activateButton.click();
        await page.waitForTimeout(2000);
        
        // Check if we're redirected to setup
        const currentUrl = page.url();
        if (currentUrl.includes('/setup')) {
          console.log('✅ License activated, filling profile...');
          
          // Fill in profile form
          const nameInput = await page.$('input[name="name"]');
          const cnccInput = await page.$('input[name="cncc_number"]');
          const cabinetInput = await page.$('input[name="cabinet"]');
          
          if (nameInput && cnccInput && cabinetInput) {
            await nameInput.fill('Jean Dupont');
            await cnccInput.fill('12345');
            await cabinetInput.fill('Cabinet Test');
            
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
    await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: `${screenshotDir}/02-projects.png`,
      fullPage: false
    });

    // Check if we have any projects, if not try to create one
    const projectLinks = await page.$$('a[href*="/projects/"]');
    console.log(`Found ${projectLinks.length} project links`);
    
    if (projectLinks.length === 0) {
      console.log('⚠️  No projects found. Need to seed database or create a project.');
      
      // Try to find a "new project" button
      const newProjectButton = await page.$('button:has-text("Nouveau"), button:has-text("Créer"), a:has-text("Nouveau")');
      if (newProjectButton) {
        console.log('✅ Found new project button, clicking...');
        await newProjectButton.click();
        await page.waitForTimeout(2000);
      }
    } else {
      // 3. Navigate to project detail
      console.log('📸 3/6: Navigating to project detail...');
      await projectLinks[0].click();
      await page.waitForTimeout(1500);
      await page.screenshot({ 
        path: `${screenshotDir}/03-project-detail.png`,
        fullPage: false
      });

      // 4. Try to navigate to signals page
      console.log('📸 4/6: Looking for signals page...');
      const signalsLink = await page.$('a[href*="/signals"]');
      if (signalsLink) {
        await signalsLink.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ 
          path: `${screenshotDir}/04-signals.png`,
          fullPage: false
        });

        // 5. Try to navigate to signal detail
        console.log('📸 5/6: Looking for signal detail...');
        const signalLinks = await page.$$('a[href*="/signals/"]:not([href$="/signals"])');
        if (signalLinks.length > 0) {
          await signalLinks[0].click();
          await page.waitForTimeout(1500);
          await page.screenshot({ 
            path: `${screenshotDir}/05-signal-detail.png`,
            fullPage: false
          });
          
          // Go back to navigate to deliverables
          await page.goBack();
          await page.waitForTimeout(1000);
        } else {
          console.log('⚠️  No signal detail links found');
        }

        // 6. Navigate to deliverables page
        console.log('📸 6/6: Looking for deliverables page...');
        const deliverablesLink = await page.$('a[href*="/deliverables"]');
        if (deliverablesLink) {
          await deliverablesLink.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ 
            path: `${screenshotDir}/06-deliverables.png`,
            fullPage: false
          });
        } else {
          console.log('⚠️  No deliverables link found');
        }
      } else {
        console.log('⚠️  No signals link found');
      }
    }

    console.log('\n✅ Screenshot capture complete!');
    console.log(`📁 Screenshots saved to: ${screenshotDir}/`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
