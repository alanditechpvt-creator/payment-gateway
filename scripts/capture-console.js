const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const outDir = path.resolve(__dirname, '..', 'logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'repro-console.txt');
  const write = (line) => fs.appendFileSync(outFile, line + '\n');

  write(`Run at: ${new Date().toISOString()}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const location = msg.location();
    const text = `[console] ${msg.type().toUpperCase()}: ${msg.text()} -- ${location.url || 'unknown'}:${location.line || 0}:${location.column || 0}`;
    console.log(text);
    write(text);
  });

  page.on('pageerror', err => {
    const text = `[pageerror] ${err.message}\n${err.stack}`;
    console.error(text);
    write(text);
  });

  page.on('requestfailed', req => {
    const text = `[requestfailed] ${req.method()} ${req.url()} ${req.failure() ? req.failure().errorText : ''}`;
    console.log(text);
    write(text);
  });

  try {
    const url = process.argv[2] || 'http://localhost:5000';
    write(`Navigating to ${url}`);

    // Retry loop: sometimes dev server is still compiling / binding
    const maxAttempts = 4;
    let attempt = 0;
    let lastError = null;
    while (attempt < maxAttempts) {
      attempt += 1;
      write(`Attempt ${attempt} -> ${url}`);
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        write(`[goto error] attempt ${attempt}: ${err.message}`);
        // wait before retrying
        await page.waitForTimeout(3000);
      }
    }
    if (lastError) throw lastError;

    // Wait a bit for async errors (websocket, dynamic scripts)
    await page.waitForTimeout(20000);

    // Capture page content title and snapshot
    const title = await page.title();
    write(`Page title: ${title}`);
    const screenshotPath = path.join(outDir, 'repro-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    write(`Screenshot saved: ${screenshotPath}`);

    // Save page HTML
    const html = await page.content();
    fs.writeFileSync(path.join(outDir, 'repro-page.html'), html);
    write('Saved page HTML');

  } catch (err) {
    write(`[script error] ${err.message}\n${err.stack}`);
  } finally {
    await browser.close();
    write('Finished');
    console.log('Done. Logs in', outFile);
  }
})();
