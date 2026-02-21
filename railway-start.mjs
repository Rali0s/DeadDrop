import { spawn } from "node:child_process";

const target = (process.env.RAILWAY_SERVICE_TYPE || "api").toLowerCase();

const workspace = target === "web" ? "@deaddrop/web" : "@deaddrop/api";
const child = spawn("npm", ["run", "start", "--workspace", workspace], {
  stdio: "inherit",
  shell: true
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
