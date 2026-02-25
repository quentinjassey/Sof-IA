const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 1200, height: 400, deviceScaleFactor: 3 });

  const htmlPath = path.resolve(__dirname, 'html', 'kpis-signals.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 500));

  const el = await page.$('#kpis');

  // Transparent background
  await el.screenshot({
    path: path.resolve(__dirname, 'png', 'kpis-signals-transparent.png'),
    omitBackground: true,
  });
  console.log('Captured: kpis-signals-transparent.png');

  // Black background version
  await page.evaluate(() => {
    document.body.style.background = '#000000';
    document.querySelector('#kpis').style.background = '#000000';
    document.querySelector('#kpis').style.padding = '24px';
    document.querySelector('#kpis').style.borderRadius = '20px';
  });
  await el.screenshot({
    path: path.resolve(__dirname, 'png', 'kpis-signals-black.png'),
    omitBackground: false,
  });
  console.log('Captured: kpis-signals-black.png');

  await browser.close();
  console.log('\nDone! Files in pitch-assets/png/');
})();
