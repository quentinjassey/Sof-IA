const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 600, height: 600, deviceScaleFactor: 3 });

  const htmlPath = path.resolve(__dirname, 'html', 'analysis-steps.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 500));

  const el = await page.$('#steps');

  await el.screenshot({
    path: path.resolve(__dirname, 'png', 'analysis-steps-transparent.png'),
    omitBackground: true,
  });
  console.log('Captured: analysis-steps-transparent.png');

  await page.evaluate(() => {
    document.body.style.background = '#000000';
    document.querySelector('#steps').style.background = '#000000';
    document.querySelector('#steps').style.padding = '24px';
    document.querySelector('#steps').style.borderRadius = '24px';
  });
  await el.screenshot({
    path: path.resolve(__dirname, 'png', 'analysis-steps-black.png'),
    omitBackground: false,
  });
  console.log('Captured: analysis-steps-black.png');

  await browser.close();
  console.log('\nDone!');
})();
