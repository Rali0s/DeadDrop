const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("RelToken + FeeModel + StakingVault", function () {
  async function nowTs() {
    return Number((await ethers.provider.getBlock("latest")).timestamp);
  }

  async function setNextTimestamp(ts) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [ts]);
    await ethers.provider.send("evm_mine", []);
  }

  async function deployFixture() {
    const [admin, treasury, devWallet, user, feeSink] = await ethers.getSigners();

    const RelToken = await ethers.getContractFactory("RelToken");
    const rel = await upgrades.deployProxy(RelToken, [admin.address, treasury.address, devWallet.address], {
      initializer: "initialize",
      kind: "uups"
    });

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const FeeModel = await ethers.getContractFactory("FeeModel");
    const feeModel = await upgrades.deployProxy(
      FeeModel,
      [admin.address, 1_000_000, 100_000, 100_000, ethers.parseEther("100")],
      {
        initializer: "initialize",
        kind: "uups"
      }
    );

    const StakingVault = await ethers.getContractFactory("StakingVault");
    const vault = await upgrades.deployProxy(
      StakingVault,
      [admin.address, await rel.getAddress(), await usdc.getAddress(), await feeModel.getAddress()],
      {
        initializer: "initialize",
        kind: "uups"
      }
    );
    const DailyBriefNFT = await ethers.getContractFactory("DailyBriefNFT");
    const startTs = (await nowTs()) + 60;
    const nft = await upgrades.deployProxy(DailyBriefNFT, [admin.address, treasury.address, startTs], {
      initializer: "initialize",
      kind: "uups"
    });
    const RelBoostOracle = await ethers.getContractFactory("RelBoostOracle");
    const boostOracle = await upgrades.deployProxy(RelBoostOracle, [admin.address, await nft.getAddress(), startTs], {
      initializer: "initialize",
      kind: "uups"
    });
    await nft.configureBrief(0, {
      id: "cw-boost-day0",
      date: "2026-02-20",
      title: "Boost Test Day 0",
      lesson: "Mint ownership should increase effective stake via boost bps.",
      quote: "Trust but verify.",
      source: "Test Fixture",
      tags: ["BOOST", "NFT", "REL", "TEST"]
    });
    await nft.configureBrief(1, {
      id: "cw-boost-day1",
      date: "2026-02-21",
      title: "Boost Test Day 1",
      lesson: "Second-day mint path for cap tests.",
      quote: "Timing is everything.",
      source: "Test Fixture",
      tags: ["BOOST", "DAY2", "REL", "TEST"]
    });

    await rel.connect(treasury).transfer(user.address, ethers.parseEther("1000"));
    await usdc.mint(user.address, 10_000_000);

    return { admin, treasury, devWallet, user, feeSink, rel, usdc, feeModel, vault, nft, boostOracle, startTs };
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

  it("applies live oracle boost to effective stake for dm pricing", async function () {
    const { admin, user, rel, usdc, vault, nft, boostOracle, startTs } = await deployFixture();

    await rel.connect(user).approve(await vault.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(user).approve(await vault.getAddress(), 10_000_000);
    await vault.connect(user).stake(ethers.parseEther("200"));

    expect(await vault.quoteDmFee(user.address)).to.equal(800_000);

    await setNextTimestamp(startTs + 1);
    await nft.connect(user).mintToday(3, { value: 30_000_000_000_000n });
    await vault.connect(admin).setNftWeightOracle(await boostOracle.getAddress());

    // dayIndex=0 so time bps=0. 3 NFTs * 25 bps = 75 bps => effective 200 * 1.0075 = 201.5 REL
    expect(await boostOracle.boostBps(user.address)).to.equal(75);
    expect(await vault.effectiveStake(user.address)).to.equal(ethers.parseEther("201.5"));
    expect(await vault.quoteDmFee(user.address)).to.equal(800_000);

    await rel.connect(user).approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.connect(user).stake(ethers.parseEther("100"));
    // raw 300, effective 302.25 => tier 3 => 0.70 USDC
    expect(await vault.effectiveStake(user.address)).to.equal(ethers.parseEther("302.25"));
    expect(await vault.quoteDmFee(user.address)).to.equal(700_000);
  });

  it("falls back to raw stake when oracle is removed", async function () {
    const { admin, user, rel, usdc, vault, nft, boostOracle, startTs } = await deployFixture();

    await rel.connect(user).approve(await vault.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(user).approve(await vault.getAddress(), 10_000_000);
    await vault.connect(user).stake(ethers.parseEther("300"));

    await setNextTimestamp(startTs + 1);
    await nft.connect(user).mintToday(3, { value: 30_000_000_000_000n });
    await vault.connect(admin).setNftWeightOracle(await boostOracle.getAddress());
    expect(await vault.effectiveStake(user.address)).to.equal(ethers.parseEther("302.25"));
    expect(await vault.quoteDmFee(user.address)).to.equal(700_000);

    await vault.connect(admin).setNftWeightOracle(ethers.ZeroAddress);
    expect(await vault.effectiveStake(user.address)).to.equal(ethers.parseEther("300"));
    expect(await vault.quoteDmFee(user.address)).to.equal(700_000);
  });

  it("clamps extreme oracle boost with vault-side max", async function () {
    const { admin, user, rel, vault, nft, boostOracle, startTs } = await deployFixture();

    await rel.connect(user).approve(await vault.getAddress(), ethers.parseEther("1000"));
    await setNextTimestamp(startTs + 1);
    await nft.connect(user).mintToday(3, { value: 30_000_000_000_000n });
    await boostOracle.connect(admin).setParams(0, 3, 10_000, 10_000, 10_000, 10_000);

    await vault.connect(user).stake(ethers.parseEther("100"));
    await vault.connect(admin).setNftWeightOracle(await boostOracle.getAddress());

    // 100 REL with capped 3000 bps => 130 REL effective.
    expect(await vault.effectiveStake(user.address)).to.equal(ethers.parseEther("130"));
  });
});
