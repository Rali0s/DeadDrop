const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");
const { execSync } = require("node:child_process");

function requiredEnv(name) {
  const v = (process.env[name] || "").trim();
  if (!v) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const { upgrades } = hre;
  const network = await hre.ethers.provider.getNetwork();
  const networkName = hre.network.name;

  const admin = requiredEnv("ADMIN_ADDRESS");
  const treasury = requiredEnv("TREASURY_ADDRESS");
  const devWallet = requiredEnv("DEV_WALLET_ADDRESS");
  const briefTreasury = process.env.BRIEF_TREASURY || treasury;
  const startTs = Number(process.env.BRIEF_START_TS_UTC || Math.floor(Date.now() / 1000) + 3600);
  const strict = (process.env.STRICT_ADMIN_DEPLOYER ?? "true").toLowerCase() !== "false";
  const requireLiveUsdc = (process.env.REQUIRE_LIVE_USDC ?? "false").toLowerCase() === "true";
  const liveUsdcAddress = (process.env.USDC_TOKEN_ADDRESS || "").trim();

  if (strict && deployer.address.toLowerCase() !== admin.toLowerCase()) {
    throw new Error(`Deployer (${deployer.address}) must match ADMIN_ADDRESS (${admin})`);
  }

  console.log("== Deploying Admin Bundle ==");
  console.log("network:", networkName, "chainId:", network.chainId.toString());
  console.log("deployer:", deployer.address);
  console.log("admin:", admin);
  console.log("treasury:", treasury);
  console.log("devWallet:", devWallet);
  console.log("briefTreasury:", briefTreasury);
  console.log("briefStartTs:", startTs);
  console.log("requireLiveUsdc:", requireLiveUsdc);

  const RelToken = await hre.ethers.getContractFactory("RelToken");
  const relToken = await upgrades.deployProxy(RelToken, [admin, treasury, devWallet], {
    initializer: "initialize",
    kind: "uups"
  });
  await relToken.waitForDeployment();

  let usdcTokenAddress = "";
  let usdcType = "";
  if (liveUsdcAddress) {
    usdcTokenAddress = liveUsdcAddress;
    usdcType = "live";
  } else {
    if (requireLiveUsdc) {
      throw new Error("REQUIRE_LIVE_USDC=true but USDC_TOKEN_ADDRESS is not set");
    }
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const usdcToken = await MockUSDC.deploy();
    await usdcToken.waitForDeployment();
    usdcTokenAddress = await usdcToken.getAddress();
    usdcType = "mock";
  }

  const baseFeeUsdc6 = Number(process.env.FEE_BASE_USDC6 || 1_000_000);
  const floorFeeUsdc6 = Number(process.env.FEE_FLOOR_USDC6 || 100_000);
  const discountStepUsdc6 = Number(process.env.FEE_DISCOUNT_STEP_USDC6 || 100_000);
  const relPerTier = hre.ethers.parseEther(process.env.FEE_REL_PER_TIER || "100");

  const FeeModel = await hre.ethers.getContractFactory("FeeModel");
  const feeModel = await upgrades.deployProxy(FeeModel, [admin, baseFeeUsdc6, floorFeeUsdc6, discountStepUsdc6, relPerTier], {
    initializer: "initialize",
    kind: "uups"
  });
  await feeModel.waitForDeployment();

  const StakingVault = await hre.ethers.getContractFactory("StakingVault");
  const stakingVault = await upgrades.deployProxy(
    StakingVault,
    [admin, await relToken.getAddress(), usdcTokenAddress, await feeModel.getAddress()],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );
  await stakingVault.waitForDeployment();

  const maxOracleBoostBps = Number(process.env.STAKING_VAULT_MAX_ORACLE_BPS || 3000);
  if (maxOracleBoostBps !== 3000) {
    const tx = await stakingVault.setMaxOracleBoostBps(maxOracleBoostBps);
    await tx.wait();
  }

  const DailyBriefNFT = await hre.ethers.getContractFactory("DailyBriefNFT");
  const nft = await upgrades.deployProxy(DailyBriefNFT, [admin, briefTreasury, startTs], {
    initializer: "initialize",
    kind: "uups"
  });
  await nft.waitForDeployment();

  const RelBoostOracle = await hre.ethers.getContractFactory("RelBoostOracle");
  const oracle = await upgrades.deployProxy(RelBoostOracle, [admin, await nft.getAddress(), startTs], {
    initializer: "initialize",
    kind: "uups"
  });
  await oracle.waitForDeployment();

  const wireTx = await stakingVault.setNftWeightOracle(await oracle.getAddress());
  await wireTx.wait();

  const output = {
    network: networkName,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    admin,
    treasury,
    devWallet,
    briefTreasury,
    briefStartTs: startTs,
    contracts: {
      relToken: await relToken.getAddress(),
      usdcToken: usdcTokenAddress,
      usdcType,
      feeModel: await feeModel.getAddress(),
      stakingVault: await stakingVault.getAddress(),
      dailyBriefNft: await nft.getAddress(),
      relBoostOracle: await oracle.getAddress()
    },
    implementations: {
      relToken: await upgrades.erc1967.getImplementationAddress(await relToken.getAddress()),
      feeModel: await upgrades.erc1967.getImplementationAddress(await feeModel.getAddress()),
      stakingVault: await upgrades.erc1967.getImplementationAddress(await stakingVault.getAddress()),
      dailyBriefNft: await upgrades.erc1967.getImplementationAddress(await nft.getAddress()),
      relBoostOracle: await upgrades.erc1967.getImplementationAddress(await oracle.getAddress())
    }
  };

  const deploymentsDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(deploymentsDir, `${networkName}-${stamp}.json`);
  const latestPath = path.join(deploymentsDir, `${networkName}.latest.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  fs.writeFileSync(latestPath, JSON.stringify(output, null, 2));

  console.log("RelToken:", output.contracts.relToken);
  console.log("USDC:", output.contracts.usdcToken, `(${usdcType})`);
  console.log("FeeModel:", output.contracts.feeModel);
  console.log("StakingVault:", output.contracts.stakingVault);
  console.log("DailyBriefNFT:", output.contracts.dailyBriefNft);
  console.log("RelBoostOracle:", output.contracts.relBoostOracle);
  console.log("Deployment artifact:", outPath);
  console.log("Latest artifact:", latestPath);

  try {
    execSync("node scripts/exportContractManifest.js", {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, MANIFEST_NETWORK: networkName },
      stdio: "inherit"
    });
  } catch (error) {
    console.warn("Manifest export failed:", error instanceof Error ? error.message : String(error));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
