const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 600, height: 700, deviceScaleFactor: 3 });

  const htmlPath = path.resolve(__dirname, 'html', 'document-preselection.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 500));

  const el = await page.$('#preselection');

  await el.screenshot({
    path: path.resolve(__dirname, 'png', 'document-preselection-transparent.png'),
    omitBackground: true,
  });
  console.log('Captured: document-preselection-transparent.png');

  await page.evaluate(() => {
    document.body.style.background = '#000000';
    document.querySelector('#preselection').style.background = '#000000';
    document.querySelector('#preselection').style.padding = '24px';
    document.querySelector('#preselection').style.borderRadius = '24px';
  });
  await el.screenshot({
    path: path.resolve(__dirname, 'png', 'document-preselection-black.png'),
    omitBackground: false,
  });
  console.log('Captured: document-preselection-black.png');

  await browser.close();
  console.log('\nDone!');
})();
