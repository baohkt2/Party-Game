import puppeteer from 'puppeteer';
import * as path from 'path';

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: true });
  const hostPage = await browser.newPage();
  const guestPage = await browser.newPage();

  const ARTIFACT_DIR = path.resolve('C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\5a871d08-d944-42aa-9787-0b864cbe952c');

  try {
    console.log('Host navigating to home...');
    await hostPage.goto('http://127.0.0.1:3000');
    
    // Create room
    await hostPage.waitForSelector('input[placeholder="Nhập tên của bạn..."]');
    await hostPage.type('input[placeholder="Nhập tên của bạn..."]', 'Host User');
    await hostPage.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.innerText.includes('Tạo Phòng Mới'))?.click();
    });
    
    console.log('Waiting for Lobby...');
    await hostPage.waitForNavigation();
    const lobbyUrl = hostPage.url();
    const roomId = lobbyUrl.split('/').pop();
    console.log(`Room created: ${roomId}`);

    // Join Guest
    console.log('Guest joining...');
    await guestPage.goto(lobbyUrl);
    await guestPage.waitForSelector('input[placeholder="Nhập tên của bạn..."]');
    await guestPage.type('input[placeholder="Nhập tên của bạn..."]', 'Guest User');
    await guestPage.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.innerText.includes('Vào Phòng'))?.click();
    });

    console.log('Waiting for guest to join lobby...');
    await hostPage.waitForSelector(`text/Guest User`);

    // Start Game
    console.log('Starting Game...');
    await hostPage.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.innerText.includes('Bắt đầu Game'))?.click();
    });
    
    await hostPage.waitForNavigation();
    console.log('Game started, capturing Round 1...');
    await hostPage.waitForSelector(`text/Vòng 1`);
    await hostPage.screenshot({ path: path.join(ARTIFACT_DIR, 'round1_reflex.png') });

    // Next Round 2
    console.log('Moving to Round 2...');
    await hostPage.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.innerText.includes('Next Game'))?.click();
    });
    await hostPage.waitForSelector(`text/Vòng 2: Hại Người - Hại Mình`, { timeout: 10000 });
    await hostPage.screenshot({ path: path.join(ARTIFACT_DIR, 'round2_roulette.png') });

    // Next Round 3
    console.log('Moving to Round 3...');
    await hostPage.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.innerText.includes('Next Game'))?.click();
    });
    await hostPage.waitForSelector(`text/Vòng 3: Ai Là Kẻ Tội Đồ?`, { timeout: 10000 });
    await hostPage.screenshot({ path: path.join(ARTIFACT_DIR, 'round3_whoisit.png') });

    // Next Round 4
    console.log('Moving to Round 4...');
    await hostPage.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.innerText.includes('Next Game'))?.click();
    });
    await hostPage.waitForSelector(`text/Vòng 4: Thật Hay Thách`, { timeout: 10000 });
    await hostPage.screenshot({ path: path.join(ARTIFACT_DIR, 'round4_truthordare.png') });

    // Next Round 5
    console.log('Moving to Round 5...');
    await hostPage.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.innerText.includes('Next Game'))?.click();
    });
    await hostPage.waitForSelector(`text/Vòng 5: Cào Tố Tam Khúc`, { timeout: 10000 });
    await hostPage.screenshot({ path: path.join(ARTIFACT_DIR, 'round5_poker.png') });

    // End Game
    console.log('Moving to End screen...');
    await hostPage.evaluate(() => {
      [...document.querySelectorAll('button')].find(b => b.innerText.includes('Next Game'))?.click();
    });
    await hostPage.waitForSelector(`text/Tổng Kết`, { timeout: 10000 });
    await hostPage.screenshot({ path: path.join(ARTIFACT_DIR, 'round6_end.png') });

    console.log('Test completed successfully!');

  } catch (err) {
    console.error('Test failed:', err);
    await hostPage.screenshot({ path: path.join(ARTIFACT_DIR, 'error_state.png') });
  } finally {
    await browser.close();
  }
})();
