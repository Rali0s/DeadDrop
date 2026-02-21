const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("RelToken tokenomics", function () {
  async function deployFixture() {
    const [admin, treasury, devWallet, user] = await ethers.getSigners();
    const RelToken = await ethers.getContractFactory("RelToken");
    const rel = await upgrades.deployProxy(RelToken, [admin.address, treasury.address, devWallet.address], {
      initializer: "initialize",
      kind: "uups"
    });
    return { admin, treasury, devWallet, user, rel };
  }

  it("mints fixed genesis split at deploy", async function () {
    const { treasury, devWallet, rel } = await deployFixture();

    expect(await rel.totalSupply()).to.equal(await rel.GENESIS_SUPPLY());
    expect(await rel.balanceOf(treasury.address)).to.equal(await rel.TREASURY_GENESIS_SUPPLY());
    expect(await rel.balanceOf(devWallet.address)).to.equal(await rel.DEV_WALLET_RESERVE());
  });

  it("enforces emissions and special reserve caps independently", async function () {
    const { admin, user, rel } = await deployFixture();

    const emissionCap = await rel.EMISSIONS_POOL_SUPPLY();
    const specialCap = await rel.SPECIAL_RESERVE_SUPPLY();

    await rel.connect(admin).mintEmission(user.address, emissionCap);
    await rel.connect(admin).mintSpecialReserve(user.address, specialCap);
    expect(await rel.totalSupply()).to.equal(await rel.MAX_SUPPLY());

    await expect(rel.connect(admin).mintEmission(user.address, 1)).to.be.revertedWith("emission cap");
    await expect(rel.connect(admin).mintSpecialReserve(user.address, 1)).to.be.revertedWith("special cap");
  });
});
