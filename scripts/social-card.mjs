import { chromium } from '@playwright/test'

// Render the real wordmark and room-sleeve motif as a crawler-friendly bitmap.
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
})
await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://css.deltavdevs.com/fonts.css"><style>
  *{box-sizing:border-box}body{margin:0;background:#101212;color:#ebece5;font-family:'Exo 2',Arial,sans-serif;padding:54px 64px;width:1200px;height:630px;overflow:hidden}
  header{display:flex;gap:16px;align-items:center;font-family:Gugi,Arial,sans-serif;font-size:27px}svg{width:48px;height:48px}small{font:12px 'DM Mono',monospace;letter-spacing:3px;color:#899b8f;margin-left:12px}
  main{margin-top:88px;position:relative}h1{font-size:64px;font-weight:500;margin:0;letter-spacing:-2px;line-height:1.12}h1 span{color:#14b8a6}p{font-size:23px;color:#a4ada7;margin-top:20px}footer{position:absolute;bottom:52px;left:64px;right:64px;border-top:1px solid #303634;padding-top:21px;color:#a4ada7;font:13px 'DM Mono',monospace;display:flex;justify-content:space-between}
  .sleeve{position:absolute;width:305px;height:305px;right:0;top:-35px;background:#26372f;border:1px solid #4b554b;border-radius:8px;overflow:hidden}.record{position:absolute;width:320px;height:320px;top:25px;left:55px;border-radius:50%;background:#141b16;box-shadow:inset 0 0 0 15px #26322b,inset 0 0 0 32px #202d25,inset 0 0 0 48px #1c281f}.label{position:absolute;inset:106px;border-radius:50%;background:#445748;border:1px solid #788b7655;display:grid;place-items:center;color:#b6c8b9;font-size:24px}.stamp{position:absolute;left:20px;top:18px;font:12px 'DM Mono',monospace;letter-spacing:3px;color:#b6c8b9}
  </style></head><body><header><svg viewBox="0 0 40 40"><rect x="1" y="1" width="38" height="38" rx="10" fill="#101212" stroke="#416a60"/><path d="M9 17v6m5-12v18m6-22v26m6-21v16m5-12v8" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round"/></svg>spectralis <small>PLAYER</small></header><main><h1>Find your<br>frequency<span>.</span></h1><p>Public channels &amp; streamer queues.</p><div class="sleeve"><div class="record"><div class="label">♪</div></div><span class="stamp">S / P</span></div></main><footer><span>player.deltavdevs.com</span><span>built by deltavdevs</span></footer></body></html>`)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: 'public/og-default.png' })
await browser.close()
