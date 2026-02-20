export const APP_ID = 755804005;
import * as algosdk from "algosdk";

/*
====================================================
GENERATE TEAL SMART CONTRACT SOURCE
====================================================
assetId → ASA id (ticket NFT)
price → price in microAlgos
creatorAddress → seller wallet
*/
export const getSmartContractSource = (assetId, price, creatorAddress) => {
    return `
#pragma version 6

// =============================
// HANDLE OPT-IN TRANSACTION
// =============================
txn TypeEnum
int axfer
==
txn AssetReceiver
txn Sender
==
&&
bnz handle_optin

// =============================
// HANDLE SALE TRANSACTION
// (group of 3 txns)
// =============================
global GroupSize
int 3
==
txn GroupIndex
int 2
==
&&
bnz handle_sale

err

// =============================
// OPT-IN LOGIC
// =============================
handle_optin:
txn XferAsset
int ${assetId}
==
return

// =============================
// SALE LOGIC
// =============================
handle_sale:

// Verify payment transaction (Txn 1)
gtxn 1 TypeEnum
int pay
==
gtxn 1 Receiver
addr ${creatorAddress}
==
&&
gtxn 1 Amount
int ${price}
>=
&&

// Verify asset transfer (Txn 2)
txn TypeEnum
int axfer
==
&&
txn XferAsset
int ${assetId}
==
&&
txn AssetAmount
int 1
==
&&
return
`;
};

/*
====================================================
COMPILE PROGRAM → BYTECODE
====================================================
*/
export const compileProgram = async (algodClient, source) => {
    const encoder = new TextEncoder();
    const programBytes = encoder.encode(source);

    const compileResponse = await algodClient
        .compile(programBytes)
        .do();

    // convert base64 → Uint8Array (required by SDK)
    return new Uint8Array(Buffer.from(compileResponse.result, "base64"));
};