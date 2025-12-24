// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title IronData
/// @notice Stores encrypted database keys on-chain and keeps encrypted payloads off-chain safe.
contract IronData is ZamaEthereumConfig {
    struct Database {
        string name;
        eaddress encryptedKey;
        uint256 createdAt;
    }

    mapping(address => Database[]) private _databases;
    mapping(address => mapping(uint256 => bytes[])) private _records;

    event DatabaseCreated(address indexed owner, uint256 indexed databaseId, string name);
    event RecordAdded(address indexed owner, uint256 indexed databaseId, uint256 indexed recordId);

    /// @notice Create a new database with an encrypted address key.
    function createDatabase(
        string calldata name,
        externalEaddress encryptedKey,
        bytes calldata inputProof
    ) external returns (uint256 databaseId) {
        require(bytes(name).length > 0, "Name required");

        eaddress key = FHE.fromExternal(encryptedKey, inputProof);
        databaseId = _databases[msg.sender].length;

        _databases[msg.sender].push(Database({name: name, encryptedKey: key, createdAt: block.timestamp}));

        FHE.allowThis(key);
        FHE.allow(key, msg.sender);

        emit DatabaseCreated(msg.sender, databaseId, name);
    }

    /// @notice Store an encrypted payload into a database owned by the caller.
    function addRecord(uint256 databaseId, bytes calldata encryptedPayload) external returns (uint256 recordId) {
        require(databaseId < _databases[msg.sender].length, "Invalid database");
        require(encryptedPayload.length > 0, "Empty payload");

        _records[msg.sender][databaseId].push(encryptedPayload);
        recordId = _records[msg.sender][databaseId].length - 1;

        emit RecordAdded(msg.sender, databaseId, recordId);
    }

    /// @notice Get how many databases an owner has.
    function getDatabaseCount(address owner) external view returns (uint256) {
        return _databases[owner].length;
    }

    /// @notice Read metadata for a database.
    function getDatabaseInfo(
        address owner,
        uint256 databaseId
    ) external view returns (string memory name, uint256 createdAt, uint256 recordCount) {
        require(databaseId < _databases[owner].length, "Invalid database");

        Database storage db = _databases[owner][databaseId];
        return (db.name, db.createdAt, _records[owner][databaseId].length);
    }

    /// @notice Get the encrypted address key for a database.
    function getDatabaseKey(address owner, uint256 databaseId) external view returns (eaddress) {
        require(databaseId < _databases[owner].length, "Invalid database");

        return _databases[owner][databaseId].encryptedKey;
    }

    /// @notice Get all encrypted records for a database.
    function getRecords(address owner, uint256 databaseId) external view returns (bytes[] memory) {
        require(databaseId < _databases[owner].length, "Invalid database");

        return _records[owner][databaseId];
    }

    /// @notice Get the number of encrypted records for a database.
    function getRecordCount(address owner, uint256 databaseId) external view returns (uint256) {
        require(databaseId < _databases[owner].length, "Invalid database");

        return _records[owner][databaseId].length;
    }

    /// @notice Get a single encrypted record by index.
    function getRecord(
        address owner,
        uint256 databaseId,
        uint256 recordId
    ) external view returns (bytes memory) {
        require(databaseId < _databases[owner].length, "Invalid database");
        require(recordId < _records[owner][databaseId].length, "Invalid record");

        return _records[owner][databaseId][recordId];
    }
}
