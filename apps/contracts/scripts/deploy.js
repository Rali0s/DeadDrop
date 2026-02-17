const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const admin = process.env.ADMIN_ADDRESS || deployer.address;
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const initialSupply = hre.ethers.parseEther(process.env.REL_INITIAL_SUPPLY || "1000000");

  const RelToken = await hre.ethers.getContractFactory("RelToken");
  const relToken = await RelToken.deploy(admin, treasury, initialSupply);
  await relToken.waitForDeployment();

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdcToken = await MockUSDC.deploy();
  await usdcToken.waitForDeployment();

  const FeeModel = await hre.ethers.getContractFactory("FeeModel");
  const feeModel = await FeeModel.deploy(
    admin,
    1_000_000,
    100_000,
    100_000,
    hre.ethers.parseEther("100")
  );
  await feeModel.waitForDeployment();

  const StakingVault = await hre.ethers.getContractFactory("StakingVault");
  const stakingVault = await StakingVault.deploy(admin, await relToken.getAddress(), await usdcToken.getAddress(), await feeModel.getAddress());
  await stakingVault.waitForDeployment();

  console.log("RelToken:", await relToken.getAddress());
  console.log("MockUSDC:", await usdcToken.getAddress());
  console.log("FeeModel:", await feeModel.getAddress());
  console.log("StakingVault:", await stakingVault.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
