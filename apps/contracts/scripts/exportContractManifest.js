const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEPLOYMENTS_DIR = path.resolve(ROOT, "deployments");
const ARTIFACTS_DIR = path.resolve(ROOT, "artifacts/contracts");

const CONTRACT_MAP = {
  relToken: { name: "RelToken", artifact: "RelToken.sol/RelToken.json" },
  usdcToken: { name: "USDC", artifact: "MockUSDC.sol/MockUSDC.json" },
  mockUsdc: { name: "MockUSDC", artifact: "MockUSDC.sol/MockUSDC.json" },
  feeModel: { name: "FeeModel", artifact: "FeeModel.sol/FeeModel.json" },
  stakingVault: { name: "StakingVault", artifact: "StakingVault.sol/StakingVault.json" },
  dailyBriefNft: { name: "DailyBriefNFT", artifact: "DailyBriefNFT.sol/DailyBriefNFT.json" },
  relBoostOracle: { name: "RelBoostOracle", artifact: "RelBoostOracle.sol/RelBoostOracle.json" }
};

const ERC20_MINIMAL_ABI = [
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  { inputs: [], name: "decimals", outputs: [{ internalType: "uint8", name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  }
];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const network = process.env.MANIFEST_NETWORK || "sepolia";
  const deploymentFile = process.env.DEPLOYMENT_FILE || path.resolve(DEPLOYMENTS_DIR, `${network}.latest.json`);

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  const deployment = loadJson(deploymentFile);
  if (!deployment.contracts || typeof deployment.contracts !== "object") {
    throw new Error(`Invalid deployment file format: ${deploymentFile}`);
  }

  const contracts = {};
  const deploymentContracts = deployment.contracts || {};
  if (deploymentContracts.usdcType === "live" && deploymentContracts.usdcToken) {
    contracts.USDC = {
      address: deploymentContracts.usdcToken,
      abi: ERC20_MINIMAL_ABI
    };
  }

  for (const [deploymentKey, meta] of Object.entries(CONTRACT_MAP)) {
    if (deploymentContracts.usdcType === "live" && (deploymentKey === "usdcToken" || deploymentKey === "mockUsdc")) {
      continue;
    }
    const address = deployment.contracts[deploymentKey];
    if (!address) {
      continue;
    }
    const artifactPath = path.resolve(ARTIFACTS_DIR, meta.artifact);
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Artifact not found for ${meta.name}: ${artifactPath}`);
    }
    const artifact = loadJson(artifactPath);
    contracts[meta.name] = {
      address,
      abi: artifact.abi
    };
  }

  const manifest = {
    network: deployment.network || network,
    chainId: deployment.chainId,
    deployedAt: deployment.deployedAt,
    deployer: deployment.deployer,
    admin: deployment.admin,
    treasury: deployment.treasury,
    devWallet: deployment.devWallet,
    briefTreasury: deployment.briefTreasury,
    briefStartTs: deployment.briefStartTs,
    implementations: deployment.implementations || {},
    contracts
  };

  const outFile = process.env.OUTPUT_FILE || path.resolve(DEPLOYMENTS_DIR, `contract-manifest.${manifest.network}.json`);
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));

  const apiOut =
    process.env.API_MANIFEST_OUT || path.resolve(ROOT, "../api/data", `contract-manifest.${manifest.network}.json`);
  const webOut =
    process.env.WEB_MANIFEST_OUT || path.resolve(ROOT, "../web/public", `contract-manifest.${manifest.network}.json`);

  fs.mkdirSync(path.dirname(apiOut), { recursive: true });
  fs.mkdirSync(path.dirname(webOut), { recursive: true });
  fs.writeFileSync(apiOut, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(webOut, JSON.stringify(manifest, null, 2));

  console.log("manifest:", outFile);
  console.log("api manifest:", apiOut);
  console.log("web manifest:", webOut);
}

main();
