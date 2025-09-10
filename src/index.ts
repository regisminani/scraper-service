import express from "express";
import dotenv from "dotenv";
import { scrapeFacebookGroup } from "./scraper";
import cors from "cors";


dotenv.config();

const app = express();
app.use(cors());

const SCRAPER_SECRET = process.env.SCRAPER_SECRET;

app.get("/scrape", async (req, res) => {
  const url = req.query.url as string;
  const type = (req.query.type as string) || "all";
  const providedSecret = req.query.secret;

  if (!SCRAPER_SECRET || providedSecret !== SCRAPER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!url) {
    return res.status(400).json({ error: "Missing ?url" });
  }

  try {
    const posts = await scrapeFacebookGroup(url, type);
    res.json({ posts });
  } catch (error: any) {
    console.error("Scraper error:", error);
    res.status(500).json({ error: error.message || "Scraping failed" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Scraper service running on port ${PORT}`);
});
