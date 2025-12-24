import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { IronData, IronData__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("IronData")) as IronData__factory;
  const ironDataContract = (await factory.deploy()) as IronData;
  const ironDataContractAddress = await ironDataContract.getAddress();

  return { ironDataContract, ironDataContractAddress };
}

describe("IronData", function () {
  let signers: Signers;
  let ironDataContract: IronData;
  let ironDataContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ ironDataContract, ironDataContractAddress } = await deployFixture());
  });

  it("creates a database with an encrypted key", async function () {
    const randomKeyAddress = ethers.Wallet.createRandom().address;
    const encryptedKey = await fhevm
      .createEncryptedInput(ironDataContractAddress, signers.alice.address)
      .addAddress(randomKeyAddress)
      .encrypt();

    const tx = await ironDataContract
      .connect(signers.alice)
      .createDatabase("Alpha", encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    const count = await ironDataContract.getDatabaseCount(signers.alice.address);
    expect(count).to.eq(1);

    const info = await ironDataContract.getDatabaseInfo(signers.alice.address, 0);
    expect(info[0]).to.eq("Alpha");
    expect(info[2]).to.eq(0);

    const encryptedHandle = await ironDataContract.getDatabaseKey(signers.alice.address, 0);
    expect(encryptedHandle).to.not.eq(ethers.ZeroHash);
  });

  it("stores and reads encrypted records", async function () {
    const randomKeyAddress = ethers.Wallet.createRandom().address;
    const encryptedKey = await fhevm
      .createEncryptedInput(ironDataContractAddress, signers.alice.address)
      .addAddress(randomKeyAddress)
      .encrypt();

    let tx = await ironDataContract
      .connect(signers.alice)
      .createDatabase("Beta", encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    const payload = "0x1234abcd";
    tx = await ironDataContract.connect(signers.alice).addRecord(0, payload);
    await tx.wait();

    const recordCount = await ironDataContract.getRecordCount(signers.alice.address, 0);
    expect(recordCount).to.eq(1);

    const stored = await ironDataContract.getRecord(signers.alice.address, 0, 0);
    expect(stored).to.eq(payload);
  });
});
