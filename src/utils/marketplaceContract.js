import * as algosdk from 'algosdk';

export const getSmartContractSource = (assetId, price, creatorAddress) => {
    return `
#pragma version 5

// Check if it's an Opt-In transaction (Asset Transfer to Self)
txn TypeEnum
int axfer
==
txn AssetReceiver
txn Sender
==
&&
bnz handle_optin

// Check if it's a Sale (Group Size 3: OptIn, Payment, Transfer)
global GroupSize
int 3
==
txn GroupIndex
int 2
==
&&
bnz handle_sale

err // unnecessary fallthrough protection

handle_optin:
// Allow opt-in to the specific asset
txn XferAsset
int ${assetId}
==
return

handle_sale:
// Verify Payment Transaction (Txn 1 - Payment to Creator)
gtxn 1 TypeEnum
int pay
==
gtxn 1 Receiver
addr ${creatorAddress}
==
&&
gtxn 1 Amount
int ${price} // Price in MicroAlgos
>=
&&

// Verify Asset Transfer Transaction (Txn 2 - Current Txn - Transfer to Buyer)
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

export const compileProgram = async (algodClient, source) => {
    const encoder = new TextEncoder();
    const programBytes = encoder.encode(source);
    const compileResponse = await algodClient.compile(programBytes).do();
    return compileResponse; // { result: "base64...", hash: "addr..." }
};
