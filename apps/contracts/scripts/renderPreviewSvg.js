const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

function decodeDataUriBase64(uri) {
  const parts = uri.split(",");
  if (parts.length < 2) throw new Error("invalid data uri");
  return Buffer.from(parts[1], "base64").toString("utf8");
}

async function main() {
  const [admin, treasury, user] = await hre.ethers.getSigners();
  const now = Number((await hre.ethers.provider.getBlock("latest")).timestamp);

  const DailyBriefNFT = await hre.ethers.getContractFactory("DailyBriefNFT");
  const nft = await DailyBriefNFT.deploy(admin.address, treasury.address, now + 60);

  await nft.configureBrief(0, {
    id: "cw-preview-001",
    date: "2026-02-20",
    title: "Cuban Missile Crisis Address (1962)",
    lesson: "Crisis communication plus measured escalation can prevent catastrophic outcomes.",
    quote: "Our goal is not the victory of might, but the vindication of right.",
    source: "John F. Kennedy",
    tags: ["CUBA", "NUCLEAR", "DIPLOMACY", "CRISIS"]
  });

  await hre.ethers.provider.send("evm_setNextBlockTimestamp", [now + 61]);
  await hre.ethers.provider.send("evm_mine", []);

  await nft.connect(user).mintToday(1, { value: 10_000_000_000_000n });
  const tokenUri = await nft.tokenURI(1);

  const metadataJson = decodeDataUriBase64(tokenUri);
  const metadata = JSON.parse(metadataJson);
  const svg = decodeDataUriBase64(metadata.image);

  const outPath = path.resolve(__dirname, "../../../Resources/preview-daily-brief.svg");
  fs.writeFileSync(outPath, svg, "utf8");
  console.log(`wrote: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
