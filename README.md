# IronData

IronData is a privacy-first merchant data vault built on Zama FHEVM. Merchants create named databases whose encryption
key is a randomly generated EVM address, encrypted with FHE, and stored on-chain. All purchase records are encrypted
client-side and stored as ciphertext on-chain. Only the owner can decrypt the database key and then decrypt records
locally.

## Overview

IronData provides a minimal, auditable, and decentralized way to store sensitive purchase data without exposing
plaintext on-chain. It combines:

- FHEVM for encrypting and storing per-database keys on-chain.
- Browser-side AES-GCM encryption for record payloads.
- A simple, per-owner database model with explicit ownership and record counts.
- A React frontend that uses viem for reads and ethers for writes.

## The Problem

Merchants need a permanent audit trail of purchase records, but blockchains are public. Storing plaintext is not
acceptable, and centralized databases reintroduce trusted custodians. Existing solutions often:

- Leak user data or metadata.
- Require a centralized backend or key custodian.
- Make encryption workflows cumbersome for non-technical teams.

## The Solution

IronData keeps data encrypted end-to-end while preserving an on-chain source of truth.

1. A random EVM address key (A) is generated in the frontend.
2. A is encrypted using Zama FHE and stored on-chain with the database name.
3. To use a database, the owner decrypts A through the Zama relayer.
4. Purchase strings are encrypted locally with A and stored on-chain.
5. To read, the owner decrypts A again and decrypts records locally.

The contract never sees plaintext, and the encrypted key never leaves the chain unprotected.

## End-to-End User Flow

1. Connect a wallet on Sepolia.
2. Create a database name.
3. The frontend generates a random address key and encrypts it with FHE.
4. The contract stores the name and encrypted key.
5. Decrypt the key on demand (EIP-712 user decryption).
6. Encrypt purchase data locally and store it as a record.
7. Read records and decrypt them locally in the UI.

## Key Advantages

- Confidentiality by default: only ciphertext is stored on-chain.
- No backend: encryption, decryption, and storage happen in the client + contract.
- Clear ownership model: each database belongs to the creator address.
- Auditability: record counts and timestamps are verifiable on-chain.
- Minimal trust: encrypted keys are protected by FHE and user decryption.

## Architecture

### Smart Contract

- `contracts/IronData.sol`
- Stores database metadata and encrypted keys (FHE eaddress).
- Stores encrypted records as bytes arrays.
- Uses explicit owner arguments in view functions for read-only access.

### Frontend

- `src/` (Vite + React)
- Wallet connection: RainbowKit + wagmi
- Reads: viem public client
- Writes: ethers Contract with signer
- Encryption utilities: WebCrypto AES-GCM
- Zama relayer SDK for encrypted inputs and user decryption

### Tooling

- Hardhat for compile, deploy, tasks, and tests
- Hardhat deploy for deterministic deployments
- Custom tasks for CLI workflows

## Data Model and Storage

Database:

- `name` (plaintext string stored on-chain)
- `encryptedKey` (FHE-encrypted eaddress)
- `createdAt` (timestamp)

Records:

- `records[owner][databaseId]` is a list of encrypted payloads (`bytes[]`)

## Cryptography Details

- The database key is an EVM address (A) generated client-side.
- A is encrypted with Zama FHEVM and stored as `eaddress`.
- Records are encrypted locally with AES-256-GCM.
- The AES key is derived from SHA-256(address bytes).
- Payload format: 12-byte IV + ciphertext (including GCM tag), hex encoded.

## Security, Privacy, and Trust Notes

- Database names are plaintext on-chain. Do not store sensitive names.
- On-chain metadata (owner address, counts, timestamps) is public.
- The key is decrypted in-memory only; no local storage is used.
- Losing wallet access means losing the ability to decrypt the key.
- Large record payloads increase gas costs; ciphertext is still stored on-chain.

## Project Structure

```
.
├── contracts/           # Solidity contracts
├── deploy/              # Deployment scripts
├── deployments/         # Deployment artifacts and ABI outputs
├── docs/                # Zama documentation references
├── tasks/               # Hardhat tasks
├── test/                # Tests (local and Sepolia)
├── src/                 # Frontend (Vite + React)
└── hardhat.config.ts    # Hardhat configuration
```

## Technology Stack

Smart contracts:

- Solidity 0.8.x
- Hardhat + hardhat-deploy
- Zama FHEVM (`@fhevm/solidity`)

Frontend:

- React + Vite
- RainbowKit + wagmi
- viem (read-only contract calls)
- ethers (write transactions)
- WebCrypto AES-GCM
- Zama Relayer SDK

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Sepolia wallet with test ETH

### Install Dependencies

```
npm install
```

Frontend dependencies are managed in `src/`:

```
cd src
npm install
```

### Compile and Test

```
npm run compile
npm run test
```

### Local Node (Contract Development)

```
npx hardhat node
npx hardhat deploy --network localhost
```

### Hardhat Tasks

```
npx hardhat task:address --network sepolia
npx hardhat task:create-db --name "Acme Orders" --network sepolia
npx hardhat task:add-record --database 0 --key 0xYourDecryptedKey --payload "order-123" --network sepolia
npx hardhat task:db-info --owner 0xOwnerAddress --database 0 --network sepolia
npx hardhat task:list-records --owner 0xOwnerAddress --database 0 --network sepolia
```

### Deploy to Sepolia

1. Ensure tasks and tests pass locally.
2. Configure `.env` with the required values:

```
PRIVATE_KEY=your_private_key_without_0x
INFURA_API_KEY=your_infura_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

3. Deploy:

```
npx hardhat deploy --network sepolia
```

This project uses `PRIVATE_KEY` and `INFURA_API_KEY`. Do not use a mnemonic.

## Frontend Setup

1. Copy the ABI from `deployments/sepolia/IronData.json` into `src/src/config/contracts.ts`.
2. Set the deployed contract address in the UI or update the default in `src/src/config/contracts.ts`.
3. Start the frontend:

```
cd src
npm run dev
```

4. Connect a Sepolia wallet and use the app:
   - Create a database.
   - Decrypt the database key.
   - Encrypt and store purchase records.
   - View and decrypt stored records.

## Documentation

- `docs/zama_llm.md`
- `docs/zama_doc_relayer.md`

## Future Roadmap

- Encrypted metadata fields and optional name hashing.
- Database key sharing with scoped access control.
- Batched record uploads to reduce gas costs.
- Off-chain indexer for faster search and pagination.
- Optional export/import of encrypted records.
- Multi-merchant dashboards and analytics on ciphertext.

## License

BSD-3-Clause-Clear. See `LICENSE`.
