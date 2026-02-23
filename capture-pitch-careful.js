const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const baseUrl = 'http://localhost:8080';
  const screenshotDir = '/Users/quent/Documents/PGD 5/Sof-IA/pitch/test';

  const stages = [
    { num: 0, desc: 'Initial state (centered logo)' },
    { num: 1, desc: 'CAC paradox quote' },
    { num: 2, desc: 'Flow diagram (5 steps)' },
    { num: 3, desc: 'App screenshots (3 images)' },
    { num: 4, desc: 'Deliverables (4 cards)' },
    { num: 5, desc: 'Final tagline' }
  ];

  try {
    console.log('🚀 Starting pitch presentation capture...\n');

    // Navigate to pitch page
    console.log('📍 Navigating to http://localhost:8080...');
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    console.log('   ✅ Page loaded\n');

    // Capture each stage
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      
      console.log(`📸 Stage ${stage.num}: ${stage.desc}`);
      
      // Wait for animations to complete before screenshot
      await page.waitForTimeout(1000);
      
      // Take screenshot
      const filename = `test-stage-${stage.num}.png`;
      await page.screenshot({ 
        path: `${screenshotDir}/${filename}`,
        fullPage: false
      });
      
      console.log(`   ✅ Captured ${filename}`);
      
      // Analyze content for visual issues
      const analysis = await page.evaluate(() => {
        const body = document.body;
        const text = body.innerText;
        
        // Check for overlapping elements
        const elements = Array.from(document.querySelectorAll('*'));
        let hasOverlap = false;
        
        // Check text sizes
        const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div'));
        const fontSizes = textElements
          .map(el => window.getComputedStyle(el).fontSize)
          .filter(size => size && size !== '0px')
          .map(size => parseInt(size));
        
        const minFontSize = fontSizes.length > 0 ? Math.min(...fontSizes) : 0;
        
        // Check for images
        const images = document.querySelectorAll('img');
        
        // Check viewport overflow
        const bodyWidth = body.scrollWidth;
        const bodyHeight = body.scrollHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const hasHorizontalOverflow = bodyWidth > viewportWidth;
        const hasVerticalOverflow = bodyHeight > viewportHeight;
        
        return {
          text: text.substring(0, 200),
          imageCount: images.length,
          minFontSize,
          hasHorizontalOverflow,
          hasVerticalOverflow,
          bodyWidth,
          bodyHeight
        };
      });
      
      // Report issues
      let issues = [];
      if (analysis.minFontSize > 0 && analysis.minFontSize < 14) {
        issues.push(`⚠️  Small text detected (${analysis.minFontSize}px minimum)`);
      }
      if (analysis.hasHorizontalOverflow) {
        issues.push(`⚠️  Horizontal overflow (body: ${analysis.bodyWidth}px, viewport: 1920px)`);
      }
      if (analysis.hasVerticalOverflow) {
        issues.push(`⚠️  Vertical overflow (body: ${analysis.bodyHeight}px, viewport: 1080px)`);
      }
      
      if (issues.length > 0) {
        console.log('   Visual issues:');
        issues.forEach(issue => console.log(`   ${issue}`));
      } else {
        console.log('   ✓ No visual issues detected');
      }
      
      console.log('');
      
      // Press Space to advance to next stage (except on last stage)
      if (i < stages.length - 1) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(500); // Brief pause after keypress
      }
    }

    console.log('🎉 Pitch presentation capture complete!\n');
    
    // List all captured screenshots
    const fs = require('fs');
    const files = fs.readdirSync(screenshotDir)
      .filter(f => f.startsWith('test-stage-'))
      .sort();
    
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
