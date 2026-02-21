const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

async function nowTs() {
  return Number((await ethers.provider.getBlock("latest")).timestamp);
}

async function setNextTimestamp(ts) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [ts]);
  await ethers.provider.send("evm_mine", []);
}

describe("Security Audit Unit Tests", function () {
  async function deployFixture() {
    const [admin, treasury, devWallet, user, attacker, feeSink] = await ethers.getSigners();

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

    const startTs = (await nowTs()) + 120;
    const DailyBriefNFT = await ethers.getContractFactory("DailyBriefNFT");
    const nft = await upgrades.deployProxy(DailyBriefNFT, [admin.address, treasury.address, startTs], {
      initializer: "initialize",
      kind: "uups"
    });
    await nft.configureBrief(0, {
      id: "cw-sec-0",
      date: "2026-02-20",
      title: "Security Day 0",
      lesson: "Role guards and pause behavior are mandatory.",
      quote: "Trust, verify, and test.",
      source: "Security Suite",
      tags: ["SEC", "ROLE", "PAUSE", "E2E"]
    });

    const RelBoostOracle = await ethers.getContractFactory("RelBoostOracle");
    const oracle = await upgrades.deployProxy(RelBoostOracle, [admin.address, await nft.getAddress(), startTs], {
      initializer: "initialize",
      kind: "uups"
    });

    await rel.connect(treasury).transfer(user.address, ethers.parseEther("5000"));
    await usdc.mint(user.address, 50_000_000);
    await usdc.mint(attacker.address, 50_000_000);

    return { admin, treasury, devWallet, user, attacker, feeSink, rel, usdc, feeModel, vault, nft, oracle, startTs };
  }

  it("blocks unauthorized REL minting and admin role actions", async function () {
    const { user, rel } = await deployFixture();

    await expect(rel.connect(user).mintEmission(user.address, 1)).to.be.reverted;
    await expect(rel.connect(user).mintSpecialReserve(user.address, 1)).to.be.reverted;
    await expect(rel.connect(user).pause()).to.be.reverted;
    await expect(rel.connect(user).unpause()).to.be.reverted;
  });

  it("enforces REL max supply and bucket caps", async function () {
    const { admin, user, rel } = await deployFixture();

    await rel.connect(admin).mintEmission(user.address, await rel.EMISSIONS_POOL_SUPPLY());
    await rel.connect(admin).mintSpecialReserve(user.address, await rel.SPECIAL_RESERVE_SUPPLY());
    expect(await rel.totalSupply()).to.equal(await rel.MAX_SUPPLY());

    await expect(rel.connect(admin).mintEmission(user.address, 1)).to.be.revertedWith("emission cap");
    await expect(rel.connect(admin).mintSpecialReserve(user.address, 1)).to.be.revertedWith("special cap");
  });

  it("rejects direct ETH transfers to DailyBriefNFT", async function () {
    const { user, nft } = await deployFixture();
    await expect(user.sendTransaction({ to: await nft.getAddress(), value: 1n })).to.be.revertedWithCustomError(
      nft,
      "DirectEthNotAccepted"
    );
  });

  it("rejects fallback calls from non-owner wallets", async function () {
    const { attacker, nft } = await deployFixture();
    await expect(attacker.sendTransaction({ to: await nft.getAddress(), data: "0xdeadbeef" })).to.be.revertedWithCustomError(
      nft,
      "DirectEthNotAccepted"
    );
  });

  it("blocks unauthorized DailyBriefNFT admin methods", async function () {
    const { user, attacker, treasury, nft } = await deployFixture();

    await expect(
      nft.connect(attacker).configureBrief(1, {
        id: "x",
        date: "2026-02-21",
        title: "x",
        lesson: "x",
        quote: "",
        source: "",
        tags: ["", "", "", ""]
      })
    ).to.be.reverted;
    await expect(nft.connect(user).setDailyWalletMintLimit(1)).to.be.reverted;
    await expect(nft.connect(user).setBoostParams(10, 100)).to.be.reverted;
    await expect(nft.connect(user).setPause(true)).to.be.reverted;
    await expect(nft.connect(user).setTreasury(treasury.address)).to.be.reverted;
    await expect(nft.connect(user).withdraw(user.address, 1)).to.be.reverted;
  });

  it("enforces paused state across minting and staking flows", async function () {
    const { admin, user, rel, usdc, vault, nft, startTs } = await deployFixture();

    await rel.connect(user).approve(await vault.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(user).approve(await vault.getAddress(), 10_000_000);

    await vault.connect(admin).pause();
    await expect(vault.connect(user).stake(ethers.parseEther("100"))).to.be.revertedWithCustomError(vault, "EnforcedPause");
    await expect(vault.connect(user).chargeDmFee(user.address)).to.be.revertedWithCustomError(vault, "EnforcedPause");
    await vault.connect(admin).unpause();

    await vault.connect(user).stake(ethers.parseEther("100"));
    await nft.connect(admin).setPause(true);
    await setNextTimestamp(startTs + 1);
    await expect(nft.connect(user).mintToday(1, { value: 10_000_000_000_000n })).to.be.revertedWithCustomError(
      nft,
      "EnforcedPause"
    );
  });

  it("mints 3x in one call and assigns ownership/serial correctly", async function () {
    const { user, nft, startTs } = await deployFixture();
    await setNextTimestamp(startTs + 1);

    await expect(nft.connect(user).mintToday(3, { value: 30_000_000_000_000n })).to.emit(nft, "Minted");
    expect(await nft.balanceOf(user.address)).to.equal(3);
    expect(await nft.walletMintsByDay(user.address, 0)).to.equal(3);
    expect(await nft.tokenSerialInDay(1)).to.equal(1);
    expect(await nft.tokenSerialInDay(2)).to.equal(2);
    expect(await nft.tokenSerialInDay(3)).to.equal(3);
  });

  it("allows owner wallet to execute NFT fee payout withdraw", async function () {
    const { admin, user, feeSink, nft, startTs } = await deployFixture();
    await setNextTimestamp(startTs + 1);

    await nft.connect(user).mintToday(3, { value: 30_000_000_000_000n });
    const pre = await ethers.provider.getBalance(feeSink.address);
    const tx = await nft.connect(admin).withdraw(feeSink.address, 10_000_000_000_000n);
    const rc = await tx.wait();

    expect(await nft.totalEthWithdrawn()).to.equal(10_000_000_000_000n);
    const post = await ethers.provider.getBalance(feeSink.address);
    expect(post - pre).to.equal(10_000_000_000_000n);
    expect(rc.status).to.equal(1);
  });

  it("blocks random minter wallet from executing NFT payout withdraw", async function () {
    const { user, attacker, nft, startTs } = await deployFixture();
    await setNextTimestamp(startTs + 1);

    await nft.connect(user).mintToday(1, { value: 10_000_000_000_000n });
    await expect(nft.connect(user).withdraw(user.address, 1)).to.be.revertedWithCustomError(nft, "InvalidAddress");
    await expect(nft.connect(attacker).withdraw(attacker.address, 1)).to.be.revertedWithCustomError(nft, "InvalidAddress");
  });

  it("blocks unauthorized vault fee withdrawal and protects fee accounting", async function () {
    const { admin, user, attacker, feeSink, rel, usdc, vault } = await deployFixture();

    await rel.connect(user).approve(await vault.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(user).approve(await vault.getAddress(), 10_000_000);
    await vault.connect(user).stake(ethers.parseEther("200"));
    await vault.connect(user).chargeDmFee(user.address);

    await expect(vault.connect(attacker).withdrawFees(attacker.address, 100_000)).to.be.reverted;
    await expect(vault.connect(admin).withdrawFees(feeSink.address, 1_000_000_000)).to.be.revertedWith("insufficient fees");

    const pre = await usdc.balanceOf(feeSink.address);
    await vault.connect(admin).withdrawFees(feeSink.address, 800_000);
    const post = await usdc.balanceOf(feeSink.address);
    expect(post - pre).to.equal(800_000n);
    expect(await vault.collectedUsdcFees()).to.equal(0);
  });

  it("clamps oracle boost in vault to configured maximum", async function () {
    const { admin, user, rel, vault, nft, oracle, startTs } = await deployFixture();

    await rel.connect(user).approve(await vault.getAddress(), ethers.parseEther("2000"));
    await vault.connect(user).stake(ethers.parseEther("100"));
    await setNextTimestamp(startTs + 1);
    await nft.connect(user).mintToday(3, { value: 30_000_000_000_000n });

    await oracle.connect(admin).setParams(5_000, 100, 10_000, 10_000, 10_000, 10_000);
    await vault.connect(admin).setNftWeightOracle(await oracle.getAddress());
    await vault.connect(admin).setMaxOracleBoostBps(2_000);

    // Max 2000 bps = 20% => 120 effective REL from raw 100.
    expect(await vault.effectiveStake(user.address)).to.equal(ethers.parseEther("120"));
  });
});
