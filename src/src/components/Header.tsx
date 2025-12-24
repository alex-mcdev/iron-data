import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <p className="header-kicker">Iron Data</p>
            <h1 className="header-title">Encrypted Merchant Databases</h1>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
