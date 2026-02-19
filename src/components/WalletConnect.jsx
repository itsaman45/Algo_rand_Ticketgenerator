import React from 'react';
import { useAlgorand } from '../context/AlgorandContext';

const WalletConnect = () => {
    const { accountAddress, status, handleConnectWalletClick, handleDisconnectWalletClick } = useAlgorand();

    if (status === 'connected') {
        return (
            <div className="flex items-center gap-4">
                <span className="text-sm font-mono text-gray-300">
                    {accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}
                </span>
                <button
                    onClick={handleDisconnectWalletClick}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleConnectWalletClick}
            disabled={status === 'connecting'}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-lg font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50"
        >
            {status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
        </button>
    );
};

export default WalletConnect;
