import React, { createContext, useContext, useEffect, useState } from 'react';
import { PeraWalletConnect } from '@perawallet/connect';
import * as algosdk from 'algosdk';

const AlgorandContext = createContext();

export const useAlgorand = () => useContext(AlgorandContext);

// Create the PeraWalletConnect instance outside of the component to avoid re-creation
const peraWallet = new PeraWalletConnect({
    shouldShowSignTxnToast: true,
    chainId: 416002, // TestNet - ensures wallet shows correct network for signing
});

export const AlgorandProvider = ({ children }) => {
    const [accountAddress, setAccountAddress] = useState(null);
    const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected
    const [algodClient, setAlgodClient] = useState(null);
    const [indexerClient, setIndexerClient] = useState(null);

    useEffect(() => {
        // Initialize Algorand Client (Testnet via AlgoNode)
        const client = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
        setAlgodClient(client);

        const indexer = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', '');
        setIndexerClient(indexer);

        // Reconnect session
        peraWallet.reconnectSession().then((accounts) => {
            peraWallet.connector?.on("disconnect", handleDisconnectWalletClick);

            if (accounts.length) {
                setAccountAddress(accounts[0]);
                setStatus('connected');
            }
        }).catch((e) => console.log(e));

        return () => {
            peraWallet.connector?.off("disconnect");
        };
    }, []);

    const handleConnectWalletClick = () => {
        setStatus('connecting');
        peraWallet
            .connect()
            .then((newAccounts) => {
                peraWallet.connector?.on("disconnect", handleDisconnectWalletClick);
                setAccountAddress(newAccounts[0]);
                setStatus('connected');
            })
            .catch((error) => {
                if (error?.data?.type !== "CONNECT_MODAL_CLOSED") {
                    console.log(error);
                }
                setStatus('disconnected');
            });
    };

    const handleDisconnectWalletClick = () => {
        peraWallet.disconnect();
        setAccountAddress(null);
        setStatus('disconnected');
    };

    return (
        <AlgorandContext.Provider value={{
            accountAddress,
            status,
            handleConnectWalletClick,
            handleDisconnectWalletClick,
            peraWallet,
            algodClient,
            indexerClient
        }}>
            {children}
        </AlgorandContext.Provider>
    );
};
