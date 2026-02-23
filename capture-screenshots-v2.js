const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('📸 1/6: Capturing activate page...');
    await page.goto('http://localhost:3000/activate', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/01-activate.png'
    });

    console.log('📸 2/6: Capturing projects page...');
    await page.goto('http://localhost:3000/projects', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/02-projects.png'
    });

    console.log('🔍 3/6: Looking for project details...');
    const projectLinks = await page.$$('a[href*="/projects/"]');
    if (projectLinks.length > 0) {
      await projectLinks[0].click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/03-project-detail.png'
      });

      console.log('🔍 4/6: Looking for signals page...');
      const missionLinks = await page.$$('a[href*="/missions/"]');
      if (missionLinks.length > 0) {
        const signalsLink = await page.$('a[href*="/signals"]');
        if (signalsLink) {
          await signalsLink.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ 
            path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/04-signals.png'
          });

          console.log('🔍 5/6: Looking for signal details...');
          const signalDetailLinks = await page.$$('a[href*="/signals/"][href$!="/signals"]');
          if (signalDetailLinks.length > 0) {
            await signalDetailLinks[0].click();
            await page.waitForTimeout(2000);
            await page.screenshot({ 
              path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/05-signal-detail.png'
            });
          }

          console.log('🔍 6/6: Looking for deliverables page...');
          const deliverablesLink = await page.$('a[href*="/deliverables"]');
          if (deliverablesLink) {
            await deliverablesLink.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ 
              path: '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/06-deliverables.png'
            });
          }
        }
      }
    }

    console.log('\n✅ Screenshot capture complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
})();
