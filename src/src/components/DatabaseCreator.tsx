import { useState } from 'react';
import { Contract, Wallet } from 'ethers';
import { useAccount } from 'wagmi';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ABI } from '../config/contracts';
import '../styles/DatabaseCreator.css';

type DatabaseCreatorProps = {
  contractAddress: string;
  disabled: boolean;
  onCreated: () => void;
};

export function DatabaseCreator({ contractAddress, disabled, onCreated }: DatabaseCreatorProps) {
  const { address } = useAccount();
  const { instance, isLoading, error } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!instance || !address || !signerPromise) {
      setStatus('Wallet or encryption service not ready.');
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setStatus('Database name is required.');
      return;
    }

    setIsCreating(true);
    setStatus(null);

    try {
      const randomKey = Wallet.createRandom().address;
      const input = instance.createEncryptedInput(contractAddress, address);
      input.addAddress(randomKey);
      const encryptedInput = await input.encrypt();

      const signer = await signerPromise;
      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.createDatabase(trimmed, encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      setLastKey(randomKey);
      setName('');
      setStatus('Database created. Key stored on-chain and encrypted.');
      onCreated();
    } catch (err) {
      console.error('Failed to create database', err);
      setStatus('Failed to create database. Check the console for details.');
    } finally {
      setIsCreating(false);
    }
  };

  const canSubmit = !disabled && !isLoading && !!name.trim() && !!instance;

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3>Create a database</h3>
        <p>Generate a new address key, encrypt it with Zama, and pin it on-chain.</p>
      </div>
      <div className="panel-body">
        <label className="field-label" htmlFor="database-name">
          Database name
        </label>
        <input
          id="database-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Merchant vault, orders Q4, etc."
          className="text-input"
          disabled={disabled || isCreating}
        />

        <button
          type="button"
          className="primary-button"
          onClick={handleCreate}
          disabled={!canSubmit || isCreating}
        >
          {isCreating ? 'Encrypting key...' : 'Create database'}
        </button>

        {status && <p className="status-text">{status}</p>}
        {error && <p className="status-text error-text">{error}</p>}
        {lastKey && (
          <div className="hint-box">
            <p className="hint-title">Key fingerprint</p>
            <p className="hint-value">{lastKey.slice(0, 10)}...{lastKey.slice(-6)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
