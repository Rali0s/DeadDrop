const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const startTs = Number(process.env.BRIEF_START_TS_UTC || Math.floor(Date.now() / 1000) + 3600);
  const treasury = process.env.BRIEF_TREASURY || deployer.address;
  const stakingVaultAddress = process.env.STAKING_VAULT_ADDRESS || "";

  const DailyBriefNFT = await hre.ethers.getContractFactory("DailyBriefNFT");
  const nft = await DailyBriefNFT.deploy(deployer.address, treasury, startTs);
  await nft.waitForDeployment();

  const RelBoostOracle = await hre.ethers.getContractFactory("RelBoostOracle");
  const oracle = await RelBoostOracle.deploy(deployer.address, await nft.getAddress(), startTs);
  await oracle.waitForDeployment();

  if (stakingVaultAddress) {
    const vault = await hre.ethers.getContractAt("StakingVault", stakingVaultAddress);
    const tx = await vault.setNftWeightOracle(await oracle.getAddress());
    await tx.wait();
    console.log("StakingVault wired:", stakingVaultAddress);
  }

  console.log("DailyBriefNFT:", await nft.getAddress());
  console.log("RelBoostOracle:", await oracle.getAddress());
  console.log("treasury:", treasury);
  console.log("startTs:", startTs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
