import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.on('pageerror', (error) => console.error('Browser error:', error.message))
await page.goto(process.env.CAPTURE_URL || 'http://127.0.0.1:5173/')
await page.waitForTimeout(2000)
await page.screenshot({
  path: process.env.CAPTURE_PATH || 'test-results/directory.png',
  fullPage: true,
})
console.log(await page.locator('body').innerText())
await browser.close()
