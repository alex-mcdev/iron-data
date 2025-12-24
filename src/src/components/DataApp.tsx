import { useMemo, useState } from 'react';
import { isAddress } from 'ethers';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { DatabaseCreator } from './DatabaseCreator';
import { DatabaseWorkspace } from './DatabaseWorkspace';
import { CONTRACT_ADDRESS } from '../config/contracts';
import '../styles/DataApp.css';

export function DataApp() {
  const { isConnected } = useAccount();
  const [contractAddress, setContractAddress] = useState(CONTRACT_ADDRESS);
  const [refreshToken, setRefreshToken] = useState(0);

  const isAddressValid = useMemo(() => {
    const normalized = contractAddress.toLowerCase();
    return isAddress(contractAddress) && normalized !== '0x0000000000000000000000000000000000000000';
  }, [contractAddress]);

  return (
    <div className="data-app">
      <Header />
      <section className="hero">
        <div className="hero-text">
          <p className="hero-kicker">Encrypted Merchant Vault</p>
          <h2 className="hero-title">Create confidential databases and store purchase data with Zama FHE keys.</h2>
          <p className="hero-subtitle">
            A random on-chain address key is encrypted with Zama, then used to seal every payload you store.
          </p>
        </div>
        <div className="hero-panel">
          <div className="hero-panel-content">
            <p className="hero-panel-title">Contract address</p>
            <input
              value={contractAddress}
              onChange={(event) => setContractAddress(event.target.value)}
              placeholder="0x..."
              className={`hero-input ${isAddressValid ? 'is-valid' : 'is-invalid'}`}
            />
            <p className="hero-panel-note">
              {isAddressValid ? 'Address looks valid for Sepolia.' : 'Enter the deployed Sepolia address.'}
            </p>
          </div>
        </div>
      </section>

      {!isConnected && (
        <section className="connect-callout">
          <p>Connect your wallet to create a database or decrypt stored data.</p>
        </section>
      )}

      <section className="workspace-grid">
        <DatabaseCreator
          contractAddress={contractAddress}
          disabled={!isConnected || !isAddressValid}
          onCreated={() => setRefreshToken((prev) => prev + 1)}
        />
        <DatabaseWorkspace
          contractAddress={contractAddress}
          disabled={!isConnected || !isAddressValid}
          refreshToken={refreshToken}
        />
      </section>
    </div>
  );
}
