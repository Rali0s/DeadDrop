import { spawn } from "node:child_process";

const target = (process.env.RAILWAY_SERVICE_TYPE || "single").toLowerCase();
const isWebOnly = target === "web";
const isApiOnly = target === "api";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

async function main() {
  if (isWebOnly) {
    await run("npm", ["run", "build", "--workspace", "@deaddrop/web"]);
    await run("npm", ["run", "start", "--workspace", "@deaddrop/web"]);
    return;
  }

  if (isApiOnly) {
    await run("npm", ["run", "build", "--workspace", "@deaddrop/api"]);
    await run("npm", ["run", "start", "--workspace", "@deaddrop/api"]);
    return;
  }

  // Default "single-domain" mode for Railway: build web + api, run api host.
  await run("npm", ["run", "build", "--workspace", "@deaddrop/web"]);
  await run("npm", ["run", "build", "--workspace", "@deaddrop/api"]);
  await run("npm", ["run", "start", "--workspace", "@deaddrop/api"]);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
