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
    { num: 0, name: 's0.png', desc: 'Hero logo', wait: 2000 },
    { num: 1, name: 's1.png', desc: 'Pain quote', wait: 1500 },
    { num: 2, name: 's2.png', desc: 'Flow diagram', wait: 1500 },
    { num: 3, name: 's3.png', desc: 'Screenshots', wait: 1500 },
    { num: 4, name: 's4.png', desc: 'Deliverables', wait: 1500 },
    { num: 5, name: 's5.png', desc: 'Tagline', wait: 1500 }
  ];

  try {
    console.log('🎬 Starting pitch presentation capture...\n');
    console.log('=' .repeat(70));

    // Step 1: Navigate and wait
    console.log('\n📍 Step 1: Navigating to http://localhost:8080...');
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('   ✅ Page loaded\n');

    // Capture each stage
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      
      console.log('=' .repeat(70));
      console.log(`\n📸 STAGE ${stage.num}: ${stage.desc.toUpperCase()}`);
      console.log('-' .repeat(70));
      
      // Wait for specified time
      console.log(`   ⏱️  Waiting ${stage.wait}ms for animations...`);
      await page.waitForTimeout(stage.wait);
      
      // Analyze content before screenshot
      const analysis = await page.evaluate(() => {
        const getVisibleText = () => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                  return NodeFilter.FILTER_REJECT;
                }
                return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
              }
            }
          );
          
          const texts = [];
          let node;
          while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (text && text.length > 3) {
              texts.push(text);
            }
          }
          return texts;
        };

        const texts = getVisibleText();
        const images = Array.from(document.querySelectorAll('img'));
        const visibleImages = images.filter(img => {
          const style = window.getComputedStyle(img);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });

        // Check for layout issues
        const elements = Array.from(document.querySelectorAll('*'));
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let elementsOutOfBounds = [];
        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > viewportWidth || rect.bottom > viewportHeight) {
            const tag = el.tagName.toLowerCase();
            const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
            elementsOutOfBounds.push(`${tag}${classes}`);
          }
        });

        // Check font sizes
        const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div'));
        const fontSizes = textElements
          .map(el => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none') return null;
            return parseInt(style.fontSize);
          })
          .filter(size => size && size > 0);
        
        const minFont = fontSizes.length > 0 ? Math.min(...fontSizes) : 0;
        const maxFont = fontSizes.length > 0 ? Math.max(...fontSizes) : 0;

        return {
          texts: texts.slice(0, 5), // First 5 text snippets
          imageCount: visibleImages.length,
          minFont,
          maxFont,
          elementsOutOfBounds: elementsOutOfBounds.slice(0, 3),
          bodyWidth: document.body.scrollWidth,
          bodyHeight: document.body.scrollHeight,
          viewportWidth,
          viewportHeight
        };
      });
      
      // Take screenshot
      await page.screenshot({ 
        path: `${screenshotDir}/${stage.name}`,
        fullPage: false
      });
      console.log(`   ✅ Captured ${stage.name}`);
      
      // Report what's visible
      console.log(`\n   📄 VISIBLE CONTENT:`);
      if (analysis.texts.length > 0) {
        analysis.texts.forEach((text, idx) => {
          const truncated = text.length > 60 ? text.substring(0, 57) + '...' : text;
          console.log(`      ${idx + 1}. "${truncated}"`);
        });
      } else {
        console.log(`      (No text visible - likely logo-only)`);
      }
      
      if (analysis.imageCount > 0) {
        console.log(`      📷 ${analysis.imageCount} image${analysis.imageCount > 1 ? 's' : ''} visible`);
      }
      
      // Report visual issues
      console.log(`\n   🔍 VISUAL ANALYSIS:`);
      let issueCount = 0;
      
      if (analysis.minFont > 0 && analysis.minFont < 12) {
        console.log(`      ⚠️  Small text: ${analysis.minFont}px minimum font size`);
        issueCount++;
      } else if (analysis.minFont > 0) {
        console.log(`      ✓ Font sizes OK (min: ${analysis.minFont}px, max: ${analysis.maxFont}px)`);
      }
      
      if (analysis.bodyWidth > analysis.viewportWidth) {
        console.log(`      ⚠️  Horizontal overflow: body ${analysis.bodyWidth}px > viewport ${analysis.viewportWidth}px`);
        issueCount++;
      } else {
        console.log(`      ✓ No horizontal overflow`);
      }
      
      if (analysis.bodyHeight > analysis.viewportHeight + 50) {
        console.log(`      ⚠️  Vertical overflow: body ${analysis.bodyHeight}px > viewport ${analysis.viewportHeight}px`);
        issueCount++;
      } else {
        console.log(`      ✓ No vertical overflow`);
      }
      
      if (analysis.elementsOutOfBounds.length > 0) {
        console.log(`      ⚠️  Elements out of bounds: ${analysis.elementsOutOfBounds.join(', ')}`);
        issueCount++;
      } else {
        console.log(`      ✓ All elements within bounds`);
      }
      
      if (issueCount === 0) {
        console.log(`\n      ✨ NO VISUAL ISSUES DETECTED`);
      } else {
        console.log(`\n      🔧 ${issueCount} issue${issueCount > 1 ? 's' : ''} detected`);
      }
      
      // Press Space for next stage (except on last)
      if (i < stages.length - 1) {
        console.log(`\n   ⌨️  Pressing Space to advance...`);
        await page.keyboard.press('Space');
      }
      
      console.log('');
    }

    console.log('=' .repeat(70));
    console.log('\n🎉 Pitch presentation capture complete!\n');
    
    // Summary
    const fs = require('fs');
    const files = ['s0.png', 's1.png', 's2.png', 's3.png', 's4.png', 's5.png'];
    
    console.log('📋 CAPTURED SCREENSHOTS:');
    files.forEach(f => {
      const path = `${screenshotDir}/${f}`;
      if (fs.existsSync(path)) {
        const stats = fs.statSync(path);
        console.log(`   ✓ ${f} (${Math.round(stats.size / 1024)}KB)`);
      }
    });
    console.log('');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
