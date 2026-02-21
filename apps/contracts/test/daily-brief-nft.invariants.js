const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

async function ts() {
  return Number((await ethers.provider.getBlock("latest")).timestamp);
}

async function setTs(next) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [next]);
  await ethers.provider.send("evm_mine", []);
}

describe("DailyBriefNFT invariants/adversarial", function () {
  async function fixture() {
    const [admin, treasury, alice, bob] = await ethers.getSigners();
    const start = (await ts()) + 120;

    const DailyBriefNFT = await ethers.getContractFactory("DailyBriefNFT");
    const nft = await upgrades.deployProxy(DailyBriefNFT, [admin.address, treasury.address, start], {
      initializer: "initialize",
      kind: "uups"
    });

    const mkBrief = (idx) => ({
      id: `cw-${idx}`,
      date: `2026-02-${String((idx % 28) + 1).padStart(2, "0")}`,
      title: `Title ${idx}`,
      lesson: `Lesson ${idx} `.repeat(30),
      quote: `Quote ${idx} `.repeat(20),
      source: `Source ${idx}`,
      tags: ["A", "B", "C", "D"]
    });

    await nft.configureBrief(0, mkBrief(0));
    await nft.configureBrief(1, mkBrief(1));

    return { nft, admin, treasury, alice, bob, start };
  }

  it("enforces wallet/day cap invariant under repeated attempts", async function () {
    const { nft, alice, start } = await fixture();
    await setTs(start + 1);

    await nft.connect(alice).mintToday(2, { value: 20_000_000_000_000n });
    await nft.connect(alice).mintToday(1, { value: 10_000_000_000_000n });

    expect(await nft.walletMintsByDay(alice.address, 0)).to.equal(3);

    await expect(nft.connect(alice).mintToday(1, { value: 10_000_000_000_000n })).to.be.revertedWithCustomError(
      nft,
      "ExceedsWalletDailyLimit"
    );
  });

  it("respects UTC day rollover for cap reset", async function () {
    const { nft, alice, start } = await fixture();

    await setTs(start + 24 * 3600 - 2);
    await nft.connect(alice).mintToday(3, { value: 30_000_000_000_000n });

    await setTs(start + 24 * 3600 + 2);
    await nft.connect(alice).mintToday(3, { value: 30_000_000_000_000n });

    expect(await nft.walletMintsByDay(alice.address, 0)).to.equal(3);
    expect(await nft.walletMintsByDay(alice.address, 1)).to.equal(3);
  });

  it("keeps withdrawal conservation accounting", async function () {
    const { nft, alice, treasury, start } = await fixture();
    await setTs(start + 1);

    await nft.connect(alice).mintToday(3, { value: 30_000_000_000_000n });
    await nft.withdraw(treasury.address, 10_000_000_000_000n);

    const received = await nft.totalEthReceived();
    const withdrawn = await nft.totalEthWithdrawn();
    const bal = await ethers.provider.getBalance(await nft.getAddress());

    expect(received - withdrawn).to.equal(bal);
  });

  it("sanitizes long text and keeps tokenURI available", async function () {
    const { nft, admin, bob, start } = await fixture();
    const long = "<script>alert(1)</script>".repeat(40);

    await nft.connect(admin).configureBrief(0, {
      id: "cw-long",
      date: "2026-02-20",
      title: long,
      lesson: long,
      quote: long,
      source: long,
      tags: [long, long, long, long]
    });

    await setTs(start + 1);
    await nft.connect(bob).mintToday(1, { value: 10_000_000_000_000n });

    const uri = await nft.tokenURI(1);
    expect(uri.startsWith("data:application/json;base64,")).to.equal(true);
  });
});
