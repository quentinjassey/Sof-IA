const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 800, height: 500, deviceScaleFactor: 3 });

  const htmlPath = path.resolve(__dirname, 'html', 'confidence-score.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 500));

  const el = await page.$('#confidence');

  await el.screenshot({
    path: path.resolve(__dirname, 'png', 'confidence-score-transparent.png'),
    omitBackground: true,
  });
  console.log('Captured: confidence-score-transparent.png');

  await page.evaluate(() => {
    document.body.style.background = '#000000';
    document.querySelector('#confidence').style.background = '#000000';
    document.querySelector('#confidence').style.padding = '24px';
    document.querySelector('#confidence').style.borderRadius = '24px';
  });
  await el.screenshot({
    path: path.resolve(__dirname, 'png', 'confidence-score-black.png'),
    omitBackground: false,
  });
  console.log('Captured: confidence-score-black.png');

  await browser.close();
  console.log('\nDone!');
})();
