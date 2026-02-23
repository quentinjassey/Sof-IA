const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const baseUrl = 'http://localhost:8080';
  const screenshotDir = '/Users/quent/Documents/PGD 5/Sof-IA/pitch/test';

  try {
    console.log('🚀 Starting pitch presentation capture...\n');

    // Navigate to pitch page
    console.log('📍 Navigating to pitch presentation...');
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('   ✅ Page loaded\n');

    // Stage 0: Initial state with centered logo
    console.log('📸 Stage 0: Initial state (centered logo)');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: `${screenshotDir}/test-stage-0.png`,
      fullPage: false
    });
    
    // Check for logo
    const hasLogo = await page.evaluate(() => {
      return document.body.innerText.includes('Sof') || 
             document.querySelector('img') !== null ||
             document.querySelector('[class*="logo"]') !== null;
    });
    console.log(`   Logo visible: ${hasLogo ? '✓' : '✗'}`);
    console.log('   ✅ Captured test-stage-0.png\n');

    // Stage 1: Press Space - Quote about "le paradoxe du CAC"
    console.log('📸 Stage 1: Press Space (quote about CAC paradox)');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: `${screenshotDir}/test-stage-1.png`,
      fullPage: false
    });
    
    const stage1Text = await page.evaluate(() => document.body.innerText);
    const hasParadoxe = stage1Text.toLowerCase().includes('paradoxe');
    const hasCAC = stage1Text.toUpperCase().includes('CAC');
    console.log(`   Has "paradoxe": ${hasParadoxe ? '✓' : '✗'}`);
    console.log(`   Has "CAC": ${hasCAC ? '✓' : '✗'}`);
    console.log('   ✅ Captured test-stage-1.png\n');

    // Stage 2: Press Space - Flow diagram with 5 steps
    console.log('📸 Stage 2: Press Space (flow diagram with 5 steps)');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: `${screenshotDir}/test-stage-2.png`,
      fullPage: false
    });
    
    const stage2Text = await page.evaluate(() => document.body.innerText);
    const hasFlow = stage2Text.toLowerCase().includes('analyse') || 
                    stage2Text.toLowerCase().includes('étape') ||
                    stage2Text.toLowerCase().includes('flow');
    console.log(`   Has flow/analysis content: ${hasFlow ? '✓' : '✗'}`);
    console.log('   ✅ Captured test-stage-2.png\n');

    // Stage 3: Press Space - 3 app screenshots side by side
    console.log('📸 Stage 3: Press Space (3 app screenshots)');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: `${screenshotDir}/test-stage-3.png`,
      fullPage: false
    });
    
    const stage3Images = await page.evaluate(() => {
      return document.querySelectorAll('img').length;
    });
    console.log(`   Images found: ${stage3Images}`);
    console.log('   ✅ Captured test-stage-3.png\n');

    // Stage 4: Press Space - 4 deliverable cards
    console.log('📸 Stage 4: Press Space (4 deliverable cards)');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: `${screenshotDir}/test-stage-4.png`,
      fullPage: false
    });
    
    const stage4Text = await page.evaluate(() => document.body.innerText);
    const hasDeliverables = stage4Text.toLowerCase().includes('deliverable') ||
                           stage4Text.toLowerCase().includes('livrables') ||
                           stage4Text.toLowerCase().includes('check') ||
                           stage4Text.toLowerCase().includes('signaux');
    console.log(`   Has deliverables content: ${hasDeliverables ? '✓' : '✗'}`);
    console.log('   ✅ Captured test-stage-4.png\n');

    // Stage 5: Press Space - Final tagline
    console.log('📸 Stage 5: Press Space (final tagline)');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: `${screenshotDir}/test-stage-5.png`,
      fullPage: false
    });
    
    const stage5Text = await page.evaluate(() => document.body.innerText);
    const hasTagline = stage5Text.includes('outil') && stage5Text.includes('jugement');
    console.log(`   Has tagline "L'outil éclaire. Le jugement reste humain.": ${hasTagline ? '✓' : '✗'}`);
    console.log('   ✅ Captured test-stage-5.png\n');

    console.log('🎉 Pitch presentation capture complete!\n');
    
    // List all captured screenshots
    const fs = require('fs');
    const files = fs.readdirSync(screenshotDir).filter(f => f.startsWith('test-stage-')).sort();
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
