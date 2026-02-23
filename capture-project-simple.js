const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const baseUrl = 'http://localhost:3000';
  const screenshotPath = '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/03-project-detail.png';
  const projectId = '5e4017aa-b4ca-4432-9aea-ef9966b1ce73'; // Airfrance

  try {
    console.log('🚀 Capturing project detail page...\n');

    // Activate license first
    console.log('🔑 Activating license...');
    await page.goto(`${baseUrl}/activate`, { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const licenseInput = await page.$('#license-key');
    if (licenseInput) {
      await licenseInput.fill('DEMO-SOFI-2026-0001');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }
    console.log('   ✅ License activated\n');

    // Navigate directly to project detail
    console.log(`📁 Navigating to project ${projectId}...`);
    await page.goto(`${baseUrl}/projects/${projectId}`, { 
      timeout: 30000,
      waitUntil: 'networkidle' 
    });
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`   📍 URL: ${currentUrl}`);
    
    // Check page content
    const h1Text = await page.$eval('h1', el => el.textContent).catch(() => 'No h1 found');
    console.log(`   📄 Page title: ${h1Text}`);
    
    const bodyText = await page.textContent('body');
    const hasAnalysisCards = bodyText.includes('sondage_ca') || bodyText.includes('cutoff') || bodyText.includes('pointage');
    const hasMissions = bodyText.includes('mission') || bodyText.includes('Mission');
    
    console.log(`   📊 Has analysis cards: ${hasAnalysisCards}`);
    console.log(`   📋 Has missions: ${hasMissions}\n`);
    
    // Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: false
    });
    
    const fs = require('fs');
    const stats = fs.statSync(screenshotPath);
    console.log(`   ✅ Saved: ${Math.round(stats.size / 1024)}KB\n`);
    
    console.log('🎉 Complete!');
    console.log(`\n📋 Summary:`);
    console.log(`   URL: ${currentUrl}`);
    console.log(`   Title: ${h1Text}`);
    console.log(`   Content: ${hasAnalysisCards ? 'Analysis scenarios visible' : hasMissions ? 'Missions list' : 'Project detail'}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
