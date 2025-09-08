import puppeteer, { Browser } from "puppeteer";
import fs from "fs";
import path from "path";

// Save cookies to reuse sessions
const COOKIE_PATH = path.join(process.cwd(), "cookies.json");

async function loadCookies(page: puppeteer.Page) {
  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
    await page.setCookie(...cookies);
  }
}

async function saveCookies(page: puppeteer.Page) {
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
}

export async function scrapeFacebookGroup(groupUrl: string) {
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await loadCookies(page);

    await page.goto(groupUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // If not logged in, login once and save session
    if (page.url().includes("login")) {
      await page.type("#email", process.env.FB_EMAIL || "", { delay: 40 });
      await page.type("#pass", process.env.FB_PASSWORD || "", { delay: 40 });
      await Promise.all([
        page.click("button[name=login]"),
        page.waitForNavigation({ waitUntil: "networkidle2" }),
      ]);
      await saveCookies(page);
      await page.goto(groupUrl, { waitUntil: "networkidle2" });
    }

    // Scroll multiple times to load posts
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(2000);
    }

    // Extract posts
    const posts = await page.$$eval("div[role=article]", (elements) =>
      elements.slice(0, 20).map((el) => {
        const text = el.textContent || "";
        const time =
          el.querySelector("abbr")?.getAttribute("title") ||
          el.querySelector("time")?.textContent ||
          "";
        return { text, time };
      })
    );

    return posts;
  } finally {
    if (browser) await browser.close();
  }
}
