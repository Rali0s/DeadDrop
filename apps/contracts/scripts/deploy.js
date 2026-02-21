const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const { upgrades } = hre;

  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const devWallet = process.env.DEV_WALLET_ADDRESS || deployer.address;
  const liveUsdcAddress = (process.env.USDC_TOKEN_ADDRESS || "").trim();

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
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const usdcToken = await MockUSDC.deploy();
    await usdcToken.waitForDeployment();
    usdcTokenAddress = await usdcToken.getAddress();
    usdcType = "mock";
  }

  const FeeModel = await hre.ethers.getContractFactory("FeeModel");
  const feeModel = await upgrades.deployProxy(FeeModel, [admin, 1_000_000, 100_000, 100_000, hre.ethers.parseEther("100")], {
    initializer: "initialize",
    kind: "uups"
  });
  await feeModel.waitForDeployment();

  const StakingVault = await hre.ethers.getContractFactory("StakingVault");
  const stakingVault = await upgrades.deployProxy(
    StakingVault,
    [admin, await relToken.getAddress(), usdcTokenAddress, await feeModel.getAddress()],
    { initializer: "initialize", kind: "uups" }
  );
  await stakingVault.waitForDeployment();

  console.log("RelToken:", await relToken.getAddress());
  console.log("USDC:", usdcTokenAddress, `(${usdcType})`);
  console.log("FeeModel:", await feeModel.getAddress());
  console.log("StakingVault:", await stakingVault.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
