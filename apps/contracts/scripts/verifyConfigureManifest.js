const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const hre = require("hardhat");

function boolEnv(name, defaultValue = true) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes";
}

function loadDeployment() {
  const network = hre.network.name;
  const deploymentFile = process.env.DEPLOYMENT_FILE || path.resolve(__dirname, `../deployments/${network}.latest.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }
  return { deploymentFile, deployment: JSON.parse(fs.readFileSync(deploymentFile, "utf8")) };
}

async function verifyOne(address, constructorArguments) {
  try {
    await hre.run("verify:verify", { address, constructorArguments });
    console.log("verified:", address);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log("already verified:", address);
      return;
    }
    throw error;
  }
}

async function verifyContracts(deployment) {
  const { upgrades } = hre;
  const c = deployment.contracts || {};
  const usdcAddress = c.usdcToken || c.mockUsdc;
  const usdcType = c.usdcType || (c.mockUsdc ? "mock" : "live");
  if (!c.relToken || !usdcAddress || !c.feeModel || !c.stakingVault || !c.dailyBriefNft || !c.relBoostOracle) {
    throw new Error("Deployment artifact missing required contract addresses");
  }

  const admin = deployment.admin;
  const treasury = deployment.treasury;
  const devWallet = deployment.devWallet;
  const briefTreasury = deployment.briefTreasury || treasury;
  const briefStartTs = Number(deployment.briefStartTs);

  const feeBaseUsdc6 = Number(process.env.FEE_BASE_USDC6 || 1_000_000);
  const feeFloorUsdc6 = Number(process.env.FEE_FLOOR_USDC6 || 100_000);
  const feeDiscountStepUsdc6 = Number(process.env.FEE_DISCOUNT_STEP_USDC6 || 100_000);
  const feeRelPerTier = hre.ethers.parseEther(process.env.FEE_REL_PER_TIER || "100");
  const impl = deployment.implementations || {};

  const relImpl = impl.relToken || (await upgrades.erc1967.getImplementationAddress(c.relToken));
  const feeImpl = impl.feeModel || (await upgrades.erc1967.getImplementationAddress(c.feeModel));
  const vaultImpl = impl.stakingVault || (await upgrades.erc1967.getImplementationAddress(c.stakingVault));
  const nftImpl = impl.dailyBriefNft || (await upgrades.erc1967.getImplementationAddress(c.dailyBriefNft));
  const oracleImpl = impl.relBoostOracle || (await upgrades.erc1967.getImplementationAddress(c.relBoostOracle));

  console.log("== Verifying Contracts ==");
  await verifyOne(relImpl, []);
  if (usdcType === "mock") {
    await verifyOne(usdcAddress, []);
  } else {
    console.log("skip verify external USDC:", usdcAddress);
  }
  await verifyOne(feeImpl, []);
  await verifyOne(vaultImpl, []);
  await verifyOne(nftImpl, []);
  await verifyOne(oracleImpl, []);

  // Also verify proxy addresses (ERC1967Proxy bytecode constructor args).
  await verifyOne(c.relToken, [relImpl, "0x"]);
  await verifyOne(c.feeModel, [feeImpl, "0x"]);
  await verifyOne(c.stakingVault, [vaultImpl, "0x"]);
  await verifyOne(c.dailyBriefNft, [nftImpl, "0x"]);
  await verifyOne(c.relBoostOracle, [oracleImpl, "0x"]);
}

async function configureBriefs(deployment) {
  const filePath = process.env.BRIEF_FILE || path.resolve(__dirname, "../../../Resources/briefs.pilot125.json");
  const batchSize = Number(process.env.BRIEF_BATCH_SIZE || 10);
  const address = deployment.contracts.dailyBriefNft;

  if (!address) {
    throw new Error("dailyBriefNft address missing in deployment artifact");
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Brief file not found: ${filePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (items.length === 0) {
    throw new Error(`No brief items found in ${filePath}`);
  }

  const nft = await hre.ethers.getContractAt("DailyBriefNFT", address);
  console.log("== Configuring Briefs ==");
  console.log("nft:", address);
  console.log("file:", filePath);
  console.log("count:", items.length);
  console.log("batchSize:", batchSize);

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
      tags: [item.tags?.[0] || "", item.tags?.[1] || "", item.tags?.[2] || "", item.tags?.[3] || ""]
    }));
    const tx = await nft.configureBriefBatch(dayIndices, briefs);
    await tx.wait();
    console.log(`configured ${dayIndices.length} briefs [${dayIndices[0]}..${dayIndices[dayIndices.length - 1]}]`);
  }
}

function exportManifest() {
  console.log("== Exporting Manifest ==");
  execSync("node scripts/exportContractManifest.js", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, MANIFEST_NETWORK: hre.network.name },
    stdio: "inherit"
  });
}

async function main() {
  const doVerify = boolEnv("DO_VERIFY", true);
  const doConfigure = boolEnv("DO_CONFIGURE_BRIEFS", true);
  const doManifest = boolEnv("DO_EXPORT_MANIFEST", true);

  const { deploymentFile, deployment } = loadDeployment();
  console.log("network:", hre.network.name);
  console.log("deployment:", deploymentFile);
  console.log("stages:", { verify: doVerify, configureBriefs: doConfigure, exportManifest: doManifest });

  if (doVerify) {
    await verifyContracts(deployment);
  }
  if (doConfigure) {
    await configureBriefs(deployment);
  }
  if (doManifest) {
    exportManifest();
  }

  console.log("Done");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
