const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

async function main() {
  const nftAddress = process.env.DAILY_BRIEF_NFT_ADDRESS;
  if (!nftAddress) {
    throw new Error("DAILY_BRIEF_NFT_ADDRESS is required");
  }

  const filePath = process.env.BRIEF_FILE || path.resolve(__dirname, "../../../Resources/briefs.pilot125.json");
  const batchSize = Number(process.env.BRIEF_BATCH_SIZE || 10);

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (items.length === 0) {
    throw new Error("No items found in brief file");
  }

  const nft = await hre.ethers.getContractAt("DailyBriefNFT", nftAddress);

  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const dayIndices = slice.map((_, idx) => i + idx);
    const briefs = slice.map((item) => ({
      id: item.id,
      date: item.date,
      title: item.title,
      lesson: item.lesson,
      quote: item.quote || "",
      source: item.source || "",
      tags: [
        item.tags?.[0] || "",
        item.tags?.[1] || "",
        item.tags?.[2] || "",
        item.tags?.[3] || ""
      ]
    }));

    const tx = await nft.configureBriefBatch(dayIndices, briefs);
    await tx.wait();
    console.log(`configured ${dayIndices.length} briefs [${dayIndices[0]}..${dayIndices[dayIndices.length - 1]}]`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
