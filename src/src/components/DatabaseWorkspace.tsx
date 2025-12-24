import { useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient } from 'wagmi';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ABI } from '../config/contracts';
import { decryptWithAddress, encryptWithAddress, normalizeDecryptedAddress } from '../utils/crypto';
import '../styles/DatabaseWorkspace.css';

type DatabaseWorkspaceProps = {
  contractAddress: string;
  disabled: boolean;
  refreshToken: number;
};

type DatabaseInfo = {
  id: number;
  name: string;
  createdAt: number;
  recordCount: number;
};

export function DatabaseWorkspace({ contractAddress, disabled, refreshToken }: DatabaseWorkspaceProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const viemAddress = contractAddress as `0x${string}`;

  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [records, setRecords] = useState<string[]>([]);
  const [decryptedRecords, setDecryptedRecords] = useState<string[]>([]);
  const [keyAddress, setKeyAddress] = useState<string | null>(null);
  const [isDecryptingKey, setIsDecryptingKey] = useState(false);
  const [isDecryptingRecords, setIsDecryptingRecords] = useState(false);
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [payload, setPayload] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const selectedDatabase = useMemo(
    () => databases.find((db) => db.id === selectedId) ?? null,
    [databases, selectedId],
  );

  useEffect(() => {
    let isMounted = true;

    const loadDatabases = async () => {
      if (!address || !publicClient || disabled) {
        setDatabases([]);
        return;
      }

      setIsLoading(true);
      try {
        const count = await publicClient.readContract({
          address: viemAddress,
          abi: CONTRACT_ABI,
          functionName: 'getDatabaseCount',
          args: [address],
        });

        const total = Number(count);
        const items = await Promise.all(
          Array.from({ length: total }).map(async (_, index) => {
            const info = await publicClient.readContract({
              address: viemAddress,
              abi: CONTRACT_ABI,
              functionName: 'getDatabaseInfo',
              args: [address, BigInt(index)],
            });

            return {
              id: index,
              name: info[0] as string,
              createdAt: Number(info[1]),
              recordCount: Number(info[2]),
            };
          }),
        );

        if (isMounted) {
          setDatabases(items);
          if (items.length && (selectedId === null || selectedId >= items.length)) {
            setSelectedId(items[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load databases', err);
        if (isMounted) {
          setDatabases([]);
          setStatus('Failed to load databases.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDatabases();

    return () => {
      isMounted = false;
    };
  }, [address, contractAddress, disabled, publicClient, refreshToken]);

  useEffect(() => {
    let isMounted = true;

    const loadRecords = async () => {
      if (!address || !publicClient || selectedId === null || disabled) {
        setRecords([]);
        return;
      }

      try {
        const data = await publicClient.readContract({
          address: viemAddress,
          abi: CONTRACT_ABI,
          functionName: 'getRecords',
          args: [address, BigInt(selectedId)],
        });

        if (isMounted) {
          setRecords((data as string[]) ?? []);
        }
      } catch (err) {
        console.error('Failed to load records', err);
        if (isMounted) {
          setRecords([]);
        }
      }
    };

    loadRecords();

    return () => {
      isMounted = false;
    };
  }, [address, contractAddress, disabled, publicClient, selectedId, refreshToken]);

  useEffect(() => {
    let isMounted = true;

    const decryptRecords = async () => {
      if (!keyAddress) {
        setDecryptedRecords([]);
        return;
      }

      if (!records.length) {
        setDecryptedRecords([]);
        return;
      }

      setIsDecryptingRecords(true);
      try {
        const decrypted = await Promise.all(records.map((record) => decryptWithAddress(keyAddress, record)));
        if (isMounted) {
          setDecryptedRecords(decrypted);
        }
      } catch (err) {
        console.error('Failed to decrypt records', err);
        if (isMounted) {
          setDecryptedRecords([]);
        }
      } finally {
        if (isMounted) {
          setIsDecryptingRecords(false);
        }
      }
    };

    decryptRecords();

    return () => {
      isMounted = false;
    };
  }, [keyAddress, records]);

  const handleSelectDatabase = (id: number) => {
    setSelectedId(id);
    setKeyAddress(null);
    setDecryptedRecords([]);
    setStatus(null);
  };

  const handleDecryptKey = async () => {
    if (!instance || !address || !publicClient || selectedId === null || !signerPromise) {
      setStatus('Wallet or encryption service not ready.');
      return;
    }

    setIsDecryptingKey(true);
    setStatus(null);

    try {
      const encryptedKey = (await publicClient.readContract({
        address: viemAddress,
        abi: CONTRACT_ABI,
        functionName: 'getDatabaseKey',
        args: [address, BigInt(selectedId)],
      })) as string;

      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [contractAddress];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signer = await signerPromise;
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        [{ handle: encryptedKey, contractAddress }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decrypted = normalizeDecryptedAddress(String(result[encryptedKey]));
      setKeyAddress(decrypted);
      setStatus('Database key decrypted in your session.');
    } catch (err) {
      console.error('Failed to decrypt key', err);
      setStatus('Failed to decrypt the database key.');
    } finally {
      setIsDecryptingKey(false);
    }
  };

  const handleAddRecord = async () => {
    if (!keyAddress || selectedId === null || !signerPromise) {
      setStatus('Decrypt the database key before adding records.');
      return;
    }

    const trimmed = payload.trim();
    if (!trimmed) {
      setStatus('Payload cannot be empty.');
      return;
    }

    setIsAddingRecord(true);
    setStatus(null);

    try {
      const encryptedPayload = await encryptWithAddress(keyAddress, trimmed);
      const signer = await signerPromise;
      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.addRecord(selectedId, encryptedPayload);
      await tx.wait();

      setRecords((prev) => [...prev, encryptedPayload]);
      setDatabases((prev) =>
        prev.map((db) => (db.id === selectedId ? { ...db, recordCount: db.recordCount + 1 } : db)),
      );
      setPayload('');
      setStatus('Record stored.');
    } catch (err) {
      console.error('Failed to add record', err);
      setStatus('Failed to store record.');
    } finally {
      setIsAddingRecord(false);
    }
  };

  const showDecrypted = keyAddress && decryptedRecords.length === records.length;

  return (
    <div className="panel-card workspace-card">
      <div className="panel-header">
        <h3>Database workspace</h3>
        <p>Decrypt the key, encrypt payloads locally, and view stored records.</p>
      </div>

      <div className="workspace-body">
        <div className="database-list">
          <p className="section-title">Your databases</p>
          {isLoading && <p className="muted-text">Loading databases...</p>}
          {!isLoading && !databases.length && (
            <p className="muted-text">No databases yet. Create one to get started.</p>
          )}
          <div className="database-items">
            {databases.map((db) => (
              <button
                key={db.id}
                type="button"
                className={`database-item ${selectedId === db.id ? 'active' : ''}`}
                onClick={() => handleSelectDatabase(db.id)}
                disabled={disabled}
              >
                <span className="database-name">{db.name}</span>
                <span className="database-meta">ID {db.id} · {db.recordCount} records</span>
              </button>
            ))}
          </div>
        </div>

        <div className="database-detail">
          {selectedDatabase ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="detail-title">{selectedDatabase.name}</p>
                  <p className="detail-meta">
                    Created {new Date(selectedDatabase.createdAt * 1000).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleDecryptKey}
                  disabled={isDecryptingKey || disabled}
                >
                  {isDecryptingKey ? 'Decrypting key...' : keyAddress ? 'Key ready' : 'Decrypt key'}
                </button>
              </div>

              {keyAddress && (
                <div className="key-chip">
                  <span>Key</span>
                  <strong>{keyAddress.slice(0, 8)}...{keyAddress.slice(-6)}</strong>
                </div>
              )}

              <div className="record-entry">
                <label className="field-label" htmlFor="payload-input">
                  Purchase data payload
                </label>
                <textarea
                  id="payload-input"
                  className="text-area"
                  rows={4}
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  placeholder="Add purchase data, invoice notes, or any sensitive string."
                  disabled={disabled || isAddingRecord}
                />
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleAddRecord}
                  disabled={disabled || isAddingRecord || !payload.trim() || !keyAddress}
                >
                  {isAddingRecord ? 'Encrypting payload...' : 'Encrypt and store'}
                </button>
              </div>

              <div className="records-section">
                <p className="section-title">Stored records</p>
                {isDecryptingRecords && <p className="muted-text">Decrypting records...</p>}
                {!records.length && <p className="muted-text">No records stored yet.</p>}
                {records.length > 0 && (
                  <div className="record-list">
                    {records.map((record, index) => (
                      <div key={`${record}-${index}`} className="record-card">
                        <p className="record-label">Record {index + 1}</p>
                        <p className="record-value">
                          {showDecrypted ? decryptedRecords[index] : record}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {!keyAddress && records.length > 0 && (
                  <p className="muted-text">Decrypt the key to reveal plaintext records.</p>
                )}
              </div>
            </>
          ) : (
            <p className="muted-text">Select a database to manage its records.</p>
          )}
        </div>
      </div>

      {status && <p className="status-text">{status}</p>}
    </div>
  );
}
