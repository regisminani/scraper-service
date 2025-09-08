import express from "express";
import dotenv from "dotenv";
import { scrapeFacebookGroup } from "./scraper";

dotenv.config();

const app = express();

app.get("/scrape", async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).json({ error: "Missing ?url" });
  }

  try {
    const posts = await scrapeFacebookGroup(url);
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
