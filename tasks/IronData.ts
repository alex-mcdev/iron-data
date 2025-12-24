import { createCipheriv, createHash, randomBytes } from "crypto";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

function normalizeAddress(address: string): string {
  if (!address.startsWith("0x") || address.length !== 42) {
    throw new Error(`Invalid address: ${address}`);
  }
  return address.toLowerCase();
}

function deriveKey(address: string): Buffer {
  const hex = normalizeAddress(address).slice(2);
  const bytes = Buffer.from(hex, "hex");
  return createHash("sha256").update(bytes).digest();
}

function encryptPayload(address: string, plaintext: string): string {
  const key = deriveKey(address);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, ciphertext, tag]);
  return `0x${packed.toString("hex")}`;
}

task("task:address", "Prints the IronData address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const ironData = await deployments.get("IronData");

  console.log("IronData address is " + ironData.address);
});

task("task:create-db", "Creates a database with a random encrypted address key")
  .addParam("name", "Database name")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const ironDataDeployment = await deployments.get("IronData");
    const [signer] = await ethers.getSigners();
    const ironData = await ethers.getContractAt("IronData", ironDataDeployment.address);

    const randomKeyAddress = ethers.Wallet.createRandom().address;
    const encryptedInput = await fhevm
      .createEncryptedInput(ironDataDeployment.address, signer.address)
      .addAddress(randomKeyAddress)
      .encrypt();

    const tx = await ironData
      .connect(signer)
      .createDatabase(taskArguments.name, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Waiting for tx: ${tx.hash}...`);
    await tx.wait();

    console.log(`Database created. Address key (keep private): ${randomKeyAddress}`);
  });

task("task:add-record", "Encrypts a payload with the database key and stores it")
  .addParam("database", "Database id")
  .addParam("key", "Decrypted database address key")
  .addParam("payload", "Plaintext payload to encrypt")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const databaseId = Number.parseInt(taskArguments.database, 10);
    if (!Number.isInteger(databaseId)) {
      throw new Error(`Invalid database id: ${taskArguments.database}`);
    }

    const ironDataDeployment = await deployments.get("IronData");
    const [signer] = await ethers.getSigners();
    const ironData = await ethers.getContractAt("IronData", ironDataDeployment.address);

    const encryptedPayload = encryptPayload(taskArguments.key, taskArguments.payload);
    const tx = await ironData.connect(signer).addRecord(databaseId, encryptedPayload);
    console.log(`Waiting for tx: ${tx.hash}...`);
    await tx.wait();

    console.log("Record stored.");
  });

task("task:db-info", "Reads database metadata and record count")
  .addParam("owner", "Database owner address")
  .addParam("database", "Database id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const databaseId = Number.parseInt(taskArguments.database, 10);
    if (!Number.isInteger(databaseId)) {
      throw new Error(`Invalid database id: ${taskArguments.database}`);
    }

    const ironDataDeployment = await deployments.get("IronData");
    const ironData = await ethers.getContractAt("IronData", ironDataDeployment.address);

    const info = await ironData.getDatabaseInfo(taskArguments.owner, databaseId);
    console.log(`Name: ${info[0]}`);
    console.log(`Created: ${new Date(Number(info[1]) * 1000).toISOString()}`);
    console.log(`Record count: ${info[2]}`);
  });

task("task:list-records", "Lists encrypted record payloads")
  .addParam("owner", "Database owner address")
  .addParam("database", "Database id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const databaseId = Number.parseInt(taskArguments.database, 10);
    if (!Number.isInteger(databaseId)) {
      throw new Error(`Invalid database id: ${taskArguments.database}`);
    }

    const ironDataDeployment = await deployments.get("IronData");
    const ironData = await ethers.getContractAt("IronData", ironDataDeployment.address);

    const records = await ironData.getRecords(taskArguments.owner, databaseId);
    console.log(`Records (${records.length}):`);
    for (const [index, record] of records.entries()) {
      console.log(`#${index}: ${record}`);
    }
  });
