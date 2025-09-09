import puppeteer, { Browser, Page, Protocol, Cookie } from "puppeteer";
import fs from "fs";
import path from "path";

const COOKIE_PATH = path.join(process.cwd(), "cookies.json");

export interface Listing {
  title: string;
  price?: string;
  description: string;
  time: string;
  images: string[];
  contact?: string;
}

async function loadCookies(page: Page) {
  if (fs.existsSync(COOKIE_PATH)) {
    const cookies: Cookie[] = JSON.parse(
      fs.readFileSync(COOKIE_PATH, "utf-8")
    );
    await page.setCookie(...cookies);
  }
}


async function saveCookies(page: Page) {
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
}

export async function scrapeFacebookGroup(
  groupUrl: string,
  type: string = "all"
): Promise<Listing[]> {
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await loadCookies(page);

    await page.goto(groupUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // login if required
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

    // scroll
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const posts = await page.$$eval("div[role=article]", (elements, typeFilter: string) => {
      return elements
        .slice(0, 20)
        .map((el): Listing | null => {
          const text = el.textContent ?? "";
          if (typeFilter !== "all" && !text.toLowerCase().includes(typeFilter.toLowerCase())) {
            return null;
          }
          const time =
            el.querySelector("abbr")?.getAttribute("title") ??
            el.querySelector("time")?.textContent ??
            "";
          const price =
            el.querySelector("span:has(₣), span:has($), span:has(RWF)")?.textContent ??
            "";
          const title =
            el.querySelector("strong, h1, h2, h3")?.textContent ?? text.slice(0, 50);
          const images = Array.from(el.querySelectorAll("img"))
            .map((img) => (img as HTMLImageElement).src)
            .filter((src) => !src.includes("emoji"));
          const contactMatch = text.match(/\+?25[0-9]{8,9}/);
          const contact = contactMatch ? contactMatch[0] : "";

          return { title, price, description: text, time, images, contact };
        })
        .filter((item): item is Listing => item !== null);
    }, type);

    return posts;
  } finally {
    if (browser) await browser.close();
  }
}
