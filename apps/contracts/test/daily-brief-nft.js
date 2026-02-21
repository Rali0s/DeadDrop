const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

async function nowTs() {
  return Number((await ethers.provider.getBlock("latest")).timestamp);
}

async function setNextTimestamp(ts) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [ts]);
  await ethers.provider.send("evm_mine", []);
}

describe("DailyBriefNFT", function () {
  async function deployFixture() {
    const [admin, treasury, user, other] = await ethers.getSigners();
    const start = (await nowTs()) + 120;

    const DailyBriefNFT = await ethers.getContractFactory("DailyBriefNFT");
    const nft = await upgrades.deployProxy(DailyBriefNFT, [admin.address, treasury.address, start], {
      initializer: "initialize",
      kind: "uups"
    });

    const brief = {
      id: "cw-1962-10-22-cuban-missile",
      date: "2026-02-20",
      title: "Cuban Missile Crisis Address (1962)",
      lesson: "Crisis communication plus measured escalation can prevent catastrophic outcomes.",
      quote: "Our goal is not the victory of might, but the vindication of right.",
      source: "John F. Kennedy",
      tags: ["Cuba", "Nuclear", "Diplomacy", "Crisis"]
    };

    await nft.connect(admin).configureBrief(0, brief);
    await nft.connect(admin).configureBrief(1, { ...brief, id: "cw-berlin-airlift", date: "2026-02-21", title: "Berlin Airlift" });

    return { admin, treasury, user, other, nft, start, brief };
  }

  it("mints with exact payment and tracks day serial", async function () {
    const { nft, user, start } = await deployFixture();
    await setNextTimestamp(start + 10);

    await expect(nft.connect(user).mintToday(1, { value: 10_000_000_000_000n })).to.emit(nft, "Minted");

    expect(await nft.ownerOf(1)).to.equal(user.address);
    expect(await nft.tokenDay(1)).to.equal(0);
    expect(await nft.tokenSerialInDay(1)).to.equal(1);
    expect(await nft.totalEthReceived()).to.equal(10_000_000_000_000n);
  });

  it("enforces payment and wallet/day cap", async function () {
    const { nft, user, start } = await deployFixture();
    await setNextTimestamp(start + 1);

    await expect(nft.connect(user).mintToday(1, { value: 1n })).to.be.revertedWithCustomError(nft, "WrongPayment");

    await nft.connect(user).mintToday(3, { value: 30_000_000_000_000n });
    await expect(nft.connect(user).mintToday(1, { value: 10_000_000_000_000n })).to.be.revertedWithCustomError(
      nft,
      "ExceedsWalletDailyLimit"
    );
  });

  it("enforces mint windows and one-year limit", async function () {
    const { nft, user, start } = await deployFixture();

    await expect(nft.connect(user).mintToday(1, { value: 10_000_000_000_000n })).to.be.revertedWithCustomError(nft, "MintClosed");

    await setNextTimestamp(start + 1);
    await nft.connect(user).mintToday(1, { value: 10_000_000_000_000n });

    await setNextTimestamp(start + 366 * 24 * 3600);
    await expect(nft.connect(user).mintToday(1, { value: 10_000_000_000_000n })).to.be.revertedWithCustomError(nft, "WindowExpired");
  });

  it("returns on-chain tokenURI data URI", async function () {
    const { nft, user, start } = await deployFixture();
    await setNextTimestamp(start + 5);

    await nft.connect(user).mintToday(1, { value: 10_000_000_000_000n });
    const uri = await nft.tokenURI(1);

    expect(uri.startsWith("data:application/json;base64,")).to.equal(true);
  });

  it("renders [ REDACTED ] flag when optional SVG data is missing", async function () {
    const { nft, admin, user, start, brief } = await deployFixture();

    await nft.connect(admin).configureBrief(0, {
      ...brief,
      quote: "",
      source: "",
      tags: ["", "", "", ""]
    });

    await setNextTimestamp(start + 5);
    await nft.connect(user).mintToday(1, { value: 10_000_000_000_000n });

    const uri = await nft.tokenURI(1);
    const jsonB64 = uri.replace("data:application/json;base64,", "");
    const metadata = JSON.parse(Buffer.from(jsonB64, "base64").toString("utf8"));
    const svg = Buffer.from(metadata.image.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf8");

    expect(svg.includes("[ REDACTED ]")).to.equal(true);
  });

  it("applies capped boost from NFT balance", async function () {
    const { nft, user, start } = await deployFixture();
    await setNextTimestamp(start + 1);

    await nft.connect(user).mintToday(3, { value: 30_000_000_000_000n });
    expect(await nft.boostBps(user.address)).to.equal(75);

    await nft.setBoostParams(1_000, 2_000);
    await setNextTimestamp(start + 24 * 3600 + 1);
    await nft.connect(user).mintForDay(1, 3, { value: 30_000_000_000_000n });
    expect(await nft.boostBps(user.address)).to.equal(2_000);
  });

  it("supports treasury withdrawal accounting", async function () {
    const { nft, user, treasury, start } = await deployFixture();
    await setNextTimestamp(start + 1);

    await nft.connect(user).mintToday(2, { value: 20_000_000_000_000n });
    await expect(nft.withdraw(treasury.address, 10_000_000_000_000n)).to.emit(nft, "Withdrawn");

    expect(await nft.totalEthWithdrawn()).to.equal(10_000_000_000_000n);
    expect(await ethers.provider.getBalance(await nft.getAddress())).to.equal(10_000_000_000_000n);
  });
});
