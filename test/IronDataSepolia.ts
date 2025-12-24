import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { IronData } from "../types";
import { expect } from "chai";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("IronDataSepolia", function () {
  let signers: Signers;
  let ironDataContract: IronData;
  let ironDataContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const ironDataDeployment = await deployments.get("IronData");
      ironDataContractAddress = ironDataDeployment.address;
      ironDataContract = await ethers.getContractAt("IronData", ironDataDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("creates a database and stores a record", async function () {
    steps = 8;

    this.timeout(4 * 40000);

    progress("Encrypting a random address key...");
    const encryptedKey = await fhevm
      .createEncryptedInput(ironDataContractAddress, signers.alice.address)
      .addAddress(ethers.Wallet.createRandom().address)
      .encrypt();

    progress(`Call createDatabase() IronData=${ironDataContractAddress} signer=${signers.alice.address}...`);
    let tx = await ironDataContract
      .connect(signers.alice)
      .createDatabase("SepoliaDB", encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    progress("Reading database count...");
    const count = await ironDataContract.getDatabaseCount(signers.alice.address);
    expect(count).to.be.greaterThan(0);

    progress("Adding a record...");
    const payload = "0xdeadbeef";
    tx = await ironDataContract.connect(signers.alice).addRecord(Number(count) - 1, payload);
    await tx.wait();

    progress("Reading records...");
    const records = await ironDataContract.getRecords(signers.alice.address, Number(count) - 1);
    expect(records[records.length - 1]).to.eq(payload);
  });
});
