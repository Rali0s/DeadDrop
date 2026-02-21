const hre = require("hardhat");

function requiredEnv(name) {
  const v = (process.env[name] || "").trim();
  if (!v) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  const admin = requiredEnv("ADMIN_ADDRESS").toLowerCase();
  const treasury = requiredEnv("TREASURY_ADDRESS");
  const devWallet = requiredEnv("DEV_WALLET_ADDRESS");
  const deployerAddr = deployer.address.toLowerCase();
  const strict = (process.env.STRICT_ADMIN_DEPLOYER ?? "true").toLowerCase() !== "false";
  const rpcUrl = requiredEnv("SEPOLIA_RPC_URL");

  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("== Sepolia Admin Preflight ==");
  console.log("chainId:", network.chainId.toString());
  console.log("deployer:", deployer.address);
  console.log("deployerBalanceEth:", hre.ethers.formatEther(balance));
  console.log("rpcUrl:", rpcUrl.replace(/\/\/.*@/, "//***@"));
  console.log("admin:", admin);
  console.log("treasury:", treasury);
  console.log("devWallet:", devWallet);
  console.log("strictAdminDeployer:", strict);

  if (strict && deployerAddr !== admin) {
    throw new Error(`Deployer (${deployer.address}) must match ADMIN_ADDRESS (${process.env.ADMIN_ADDRESS})`);
  }

  if (balance === 0n) {
    throw new Error("Deployer wallet has 0 ETH");
  }

  try {
    const payload = { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] };
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`RPC health check failed (${response.status}): ${text.slice(0, 180)}`);
    }
  } catch (error) {
    throw new Error(
      `RPC endpoint is not healthy: ${error instanceof Error ? error.message : String(error)}. ` +
        `Set SEPOLIA_RPC_URL to a stable provider (Alchemy/Infura/QuickNode/PublicNode) and retry.`
    );
  }

  console.log("Preflight OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
