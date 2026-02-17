const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RelToken + FeeModel + StakingVault", function () {
  async function deployFixture() {
    const [admin, treasury, user, feeSink] = await ethers.getSigners();

    const RelToken = await ethers.getContractFactory("RelToken");
    const rel = await RelToken.deploy(admin.address, treasury.address, ethers.parseEther("1000000"));

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const FeeModel = await ethers.getContractFactory("FeeModel");
    const feeModel = await FeeModel.deploy(
      admin.address,
      1_000_000,
      100_000,
      100_000,
      ethers.parseEther("100")
    );

    const StakingVault = await ethers.getContractFactory("StakingVault");
    const vault = await StakingVault.deploy(admin.address, await rel.getAddress(), await usdc.getAddress(), await feeModel.getAddress());

    await rel.connect(treasury).transfer(user.address, ethers.parseEther("1000"));
    await usdc.mint(user.address, 10_000_000);

    return { admin, treasury, user, feeSink, rel, usdc, feeModel, vault };
  }

  it("quotes fees down by 0.10 USDC per 100 REL with floor at 0.10", async function () {
    const { feeModel } = await deployFixture();

    expect(await feeModel.quoteDmFeeByStake(0)).to.equal(1_000_000);
    expect(await feeModel.quoteDmFeeByStake(ethers.parseEther("100"))).to.equal(900_000);
    expect(await feeModel.quoteDmFeeByStake(ethers.parseEther("200"))).to.equal(800_000);
    expect(await feeModel.quoteDmFeeByStake(ethers.parseEther("900"))).to.equal(100_000);
    expect(await feeModel.quoteDmFeeByStake(ethers.parseEther("1500"))).to.equal(100_000);
  });

  it("stakes REL and charges discounted DM fee in USDC", async function () {
    const { user, rel, usdc, vault } = await deployFixture();

    await rel.connect(user).approve(await vault.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(user).approve(await vault.getAddress(), 10_000_000);

    await vault.connect(user).stake(ethers.parseEther("200"));

    const quoted = await vault.quoteDmFee(user.address);
    expect(quoted).to.equal(800_000);

    await expect(vault.connect(user).chargeDmFee(user.address)).to.emit(vault, "DmFeeCharged");

    expect(await vault.collectedUsdcFees()).to.equal(800_000);
  });

  it("allows role-based fee withdrawal", async function () {
    const { admin, user, feeSink, rel, usdc, vault } = await deployFixture();

    await rel.connect(user).approve(await vault.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(user).approve(await vault.getAddress(), 10_000_000);

    await vault.connect(user).stake(ethers.parseEther("100"));
    await vault.connect(user).chargeDmFee(user.address);

    await expect(vault.connect(admin).withdrawFees(feeSink.address, 900_000)).to.emit(vault, "FeesWithdrawn");
  });
});
