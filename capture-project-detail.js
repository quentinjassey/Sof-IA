const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const baseUrl = 'http://localhost:3000';
  const screenshotPath = '/Users/quent/Documents/PGD 5/Sof-IA/pitch/screenshots/03-project-detail.png';

  try {
    console.log('🚀 Navigating to capture project detail page...\n');

    // First activate license
    console.log('🔑 Activating license...');
    await page.goto(`${baseUrl}/activate`);
    await page.waitForTimeout(2000);
    
    const licenseInput = await page.$('#license-key');
    if (licenseInput) {
      await licenseInput.fill('DEMO-SOFI-2026-0001');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      console.log('   ✅ License activated\n');
    }

    // Navigate to projects page
    console.log('📁 Navigating to projects page...');
    await page.goto(`${baseUrl}/projects`);
    await page.waitForTimeout(3000);
    
    // Find and click first project
    const projectLinks = await page.$$('a[href*="/projects/"]:not([href="/projects"])');
    console.log(`   Found ${projectLinks.length} project links`);
    
    if (projectLinks.length > 0) {
      console.log('   🖱️  Clicking first project...');
      await projectLinks[0].click();
      await page.waitForTimeout(3000);
      
      const currentUrl = page.url();
      console.log(`   📍 Current URL: ${currentUrl}\n`);
      
      // Wait a bit more for content to load
      await page.waitForTimeout(2000);
      
      // Check what's on the page
      const pageText = await page.textContent('body');
      let pageDescription = '';
      
      if (pageText.includes('sondage_ca') || pageText.includes('cutoff') || pageText.includes('pointage')) {
        pageDescription = 'Shows analysis scenarios (sondage_ca, cutoff, pointage)';
      } else if (pageText.includes('mission')) {
        pageDescription = 'Shows missions list';
      } else if (pageText.includes('document')) {
        pageDescription = 'Shows documents';
      } else {
        pageDescription = 'Project detail page';
      }
      
      console.log(`   📄 Page content: ${pageDescription}\n`);
      
      // Take screenshot
      console.log('📸 Taking screenshot...');
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: false
      });
      
      const fs = require('fs');
      const stats = fs.statSync(screenshotPath);
      console.log(`   ✅ Screenshot saved: ${Math.round(stats.size / 1024)}KB\n`);
      
      console.log('🎉 Complete!');
      console.log(`   URL: ${currentUrl}`);
      console.log(`   Content: ${pageDescription}`);
      
    } else {
      console.log('   ⚠️  No project links found on projects page');
      
      // Try going directly to a known project ID
      const { createClient } = require('@supabase/supabase-js');
      require('dotenv').config({ path: '.env.local' });
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('license_id', 'aa685129-dc86-49e6-9fa8-dc792efd5ade')
        .limit(1);
      
      if (projects && projects.length > 0) {
        console.log(`\n   📁 Found project in DB: ${projects[0].name} (${projects[0].id})`);
        console.log('   🖱️  Navigating directly...');
        
        await page.goto(`${baseUrl}/projects/${projects[0].id}`);
        await page.waitForTimeout(3000);
        
        const currentUrl = page.url();
        console.log(`   📍 Current URL: ${currentUrl}\n`);
        
        console.log('📸 Taking screenshot...');
        await page.screenshot({ 
          path: screenshotPath,
          fullPage: false
        });
        
        const fs = require('fs');
        const stats = fs.statSync(screenshotPath);
        console.log(`   ✅ Screenshot saved: ${Math.round(stats.size / 1024)}KB\n`);
        
        console.log('🎉 Complete!');
        console.log(`   URL: ${currentUrl}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
