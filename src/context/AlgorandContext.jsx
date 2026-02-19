import React, { createContext, useContext, useEffect, useState } from "react";
import { PeraWalletConnect } from "@perawallet/connect";
import algosdk from "algosdk";

// ===============================
// CONTEXT SETUP
// ===============================
const AlgorandContext = createContext();

export const useAlgorand = () => useContext(AlgorandContext);

// ===============================
// Pera Wallet Instance
// ===============================
const peraWallet = new PeraWalletConnect({
    shouldShowSignTxnToast: true,
    chainId: 416002, // 416002 = Algorand TestNet
});

// ===============================
// PROVIDER
// ===============================
export const AlgorandProvider = ({ children }) => {
    const [accountAddress, setAccountAddress] = useState(null);
    const [status, setStatus] = useState("disconnected");
    const [algodClient, setAlgodClient] = useState(null);
    const [indexerClient, setIndexerClient] = useState(null);

    // ===============================
    // INITIALIZE CLIENTS + RECONNECT
    // ===============================
    useEffect(() => {
        // --- Algod (TestNet via AlgoNode)
        const algod = new algosdk.Algodv2(
            "",
            "https://testnet-api.algonode.cloud",
            ""
        );

        // --- Indexer (TestNet)
        const indexer = new algosdk.Indexer(
            "",
            "https://testnet-idx.algonode.cloud",
            ""
        );

        setAlgodClient(algod);
        setIndexerClient(indexer);

        // Attempt session reconnect
        const reconnectWallet = async () => {
            try {
                const accounts = await peraWallet.reconnectSession();

                if (accounts.length) {
                    setAccountAddress(accounts[0]);
                    setStatus("connected");

                    // Listen for disconnect
                    peraWallet.connector?.on("disconnect", () => {
                        handleDisconnectWalletClick();
                    });
                }
            } catch (error) {
                console.log("Reconnect Error:", error);
            }
        };

        reconnectWallet();

        return () => {
            peraWallet.connector?.off("disconnect");
        };
    }, []);

    // ===============================
    // CONNECT WALLET
    // ===============================
    const handleConnectWalletClick = async () => {
        setStatus("connecting");

        try {
            const accounts = await peraWallet.connect();

            setAccountAddress(accounts[0]);
            setStatus("connected");

            peraWallet.connector?.on("disconnect", () => {
                handleDisconnectWalletClick();
            });
        } catch (error) {
            if (error?.data?.type !== "CONNECT_MODAL_CLOSED") {
                console.log("Connection Error:", error);
            }
            setStatus("disconnected");
        }
    };

    // ===============================
    // DISCONNECT WALLET
    // ===============================
    const handleDisconnectWalletClick = () => {
        peraWallet.disconnect();
        setAccountAddress(null);
        setStatus("disconnected");
    };

    // ===============================
    // CONTEXT VALUE
    // ===============================
    return (
        <AlgorandContext.Provider
            value={{
                accountAddress,
                status,
                handleConnectWalletClick,
                handleDisconnectWalletClick,
                peraWallet,
                algodClient,
                indexerClient,
            }}
        >
            {children}
        </AlgorandContext.Provider>
    );
};
