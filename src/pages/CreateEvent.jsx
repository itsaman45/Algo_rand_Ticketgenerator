import React, { useState } from 'react';
import { useAlgorand } from '../context/AlgorandContext';
import algosdk from 'algosdk';
import { useNavigate } from 'react-router-dom';
import { getSmartContractSource, compileProgram } from '../utils/marketplaceContract';
import { Buffer } from 'buffer';

const CreateEvent = () => {
    const { accountAddress, peraWallet, algodClient } = useAlgorand();
    const navigate = useNavigate();

    // Updated state to match the form fields
    const [formData, setFormData] = useState({
        name: '',
        date: '',
        time: '',
        venue: '',
        description: '',
        price: '',
        supply: ''
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!accountAddress || !algodClient) {
            setMessage('Please connect your wallet first.');
            alert('Please connect your wallet first');
            return;
        }

        setLoading(true);
        setMessage('Creating event ticket...');

        try {
            // 1. Prepare Note with Metadata
            const noteObject = {
                desc: formData.description,
                date: formData.date,
                time: formData.time,
                venue: formData.venue,
                price: Math.round(parseFloat(formData.price) * 1000000), // Ensure integer
                type: 'ticket-token'
            };

            // APP_PREFIX for efficient filtering (V3 to hide old events - Auto-Setup Mandatory)
            const APP_PREFIX = "TICKET_APP_V3:";
            const noteString = APP_PREFIX + JSON.stringify(noteObject);
            const note = new TextEncoder().encode(noteString);

            // 2. Create Asset Creation Transaction
            const suggestedParams = await algodClient.getTransactionParams().do();

            const createTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
                from: accountAddress,
                suggestedParams,
                defaultFrozen: false,
                unitName: "TKT",
                assetName: formData.name,
                manager: accountAddress,
                reserve: accountAddress,
                freeze: accountAddress,
                clawback: accountAddress,
                total: parseInt(formData.supply),
                decimals: 0,
                note: note
            });

            // Sign and Send Creation
            const signedCreate = await peraWallet.signTransaction([[{ txn: createTxn, signers: [accountAddress] }]]);
            const { txId } = await algodClient.sendRawTransaction(signedCreate[0]).do();

            setMessage(`Transaction sent: ${txId}. Waiting for confirmation...`);
            await algosdk.waitForConfirmation(algodClient, txId, 60);

            // 3. Get New Asset ID
            const ptx = await algodClient.pendingTransactionInformation(txId).do();
            const assetId = ptx["asset-index"];
            console.log("New Asset ID:", assetId);

            setMessage(`Event Created! Initializing Auto-Sell System for Asset ${assetId}...`);

            // --- AUTO-SELL ACTIVATION ---

            // 4. Generate Vending Machine (Smart Contract)
            const priceMicroAlgos = noteObject.price;
            const source = getSmartContractSource(assetId, priceMicroAlgos, accountAddress);
            const compiled = await compileProgram(algodClient, source);
            const logicSigAddress = compiled.hash;
            console.log("Vending Machine Address:", logicSigAddress);

            setMessage(`Initializing Vending Machine at ${logicSigAddress}...`);

            const suggestedParams2 = await algodClient.getTransactionParams().do();
            suggestedParams2.flatFee = true;
            suggestedParams2.fee = 2000; // Cover 2 txns for now (fund + opt-in)

            // 5. Prepare Setup Transactions

            // A. Fund (1.0 ALGO to LogicSig - Safer buffer for MBR + Fees)
            const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                from: accountAddress,
                to: logicSigAddress,
                amount: 1000000,
                suggestedParams: suggestedParams2
            });

            // B. Opt-In (LogicSig signs)
            const programBytes = new Uint8Array(Buffer.from(compiled.result, "base64"));
            const lsig = new algosdk.LogicSigAccount(programBytes);
            const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                from: logicSigAddress,
                to: logicSigAddress,
                assetIndex: assetId,
                amount: 0,
                suggestedParams: suggestedParams2
            });
            const signedOptIn = algosdk.signLogicSigTransactionObject(optInTxn, lsig);

            // C. Stock (Creator sends all tickets)
            const stockTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                from: accountAddress,
                to: logicSigAddress,
                assetIndex: assetId,
                amount: parseInt(formData.supply),
                suggestedParams: suggestedParams2
            });

            // 6. ATOMIC SETUP: Group 3 Transactions (Fund + OptIn + Stock)
            // Fix Inconsistent Group Values: Explicitly use the returned array from assignGroupID
            setMessage("Activating Auto-Sell (Funding, Opt-In, Stocking)...");

            const setupTxns = [fundTxn, optInTxn, stockTxn];
            const groupedTxns = algosdk.assignGroupID(setupTxns);

            // Log Group IDs for debugging
            console.log("Group IDs:", groupedTxns.map(t => t.group ? Buffer.from(t.group).toString('base64') : 'missing'));

            // Sign User Transactions (Fund + Stock) using result array
            const txnsToSign = [
                { txn: groupedTxns[0], signers: [accountAddress] },
                { txn: groupedTxns[1], signers: [] }, // LogicSig (OptIn)
                { txn: groupedTxns[2], signers: [accountAddress] }
            ];

            // ROBUST SIGNATURE EXTRACTION
            // Pera returns varying structures: [[A, null, B]] or [A, null, B] depending on updates.
            // We flatten and filter to get ONLY the valid Uint8Array signatures.

            const signedUserTxns = await peraWallet.signTransaction([txnsToSign]);
            console.log("Pera Raw Response:", signedUserTxns);

            const flatTxns = Array.isArray(signedUserTxns) ? signedUserTxns.flat(Infinity) : [];
            const userIter = flatTxns.filter(item => item instanceof Uint8Array);

            if (userIter.length < 2) {
                console.error("Missing expected user signatures!");
                // Fallback: If filtered list is empty, maybe it's nested differently? 
                // But flat(Infinity) should handle it.
            }

            // We expect Fund (index 0) and Stock (index 2) to be the user ones.
            // OptIn (index 1) is empty/null or not signed by user.
            // So the filtered array should contain [FundBlob, StockBlob].

            // Sign LogicSig Transaction (OptIn) using Result Array!
            // This is critical: Use groupedTxns[1] which DEFINITELY has the group ID.
            const signedLsigTxn = algosdk.signLogicSigTransactionObject(groupedTxns[1], lsig);

            // Assemble (User, Lsig, User)
            const completeGroup = [
                userIter[0],               // Fund (Signed by User)
                signedLsigTxn.blob,        // OptIn (Signed by LogicSig) 
                userIter[1]                // Stock (Signed by User)
            ];

            console.log("Sending Atomic Setup Group...", completeGroup);
            const { txId: setupTxId } = await algodClient.sendRawTransaction(completeGroup).do();

            setMessage(`Setup Transaction Sent: ${setupTxId}. Waiting for confirmation...`);
            await algosdk.waitForConfirmation(algodClient, setupTxId, 60);

            // --- AUTO-SELL ACTIVATION END ---

            alert(`Event Created & Auto-Sell Activated Successfully! \nAsset ID: ${assetId}`);
            navigate('/organizer/dashboard');

        } catch (error) {
            console.error(error);
            setMessage(`Note: If funds were deducted, navigate to Dashboard to resume.`);
            alert(`Process Interrupted: ${error.message}.\n\nDon't worry! Check your Dashboard. If the event exists, you can click "Auto-Sell" to finish setup.`);
        } finally {
            setLoading(false);
        }
    };

    if (!accountAddress) {
        return <div className="text-center mt-20 text-xl">Please connect your wallet to create events.</div>;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-center text-white">Create New Event</h1>

            <form onSubmit={handleCreateEvent} className="glass-card p-8 rounded-3xl border border-white/10 space-y-6">

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Event Name</label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full bg-black/40 border border-gray-600 rounded-xl p-4 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                        placeholder="e.g. Algorand Tech Summit 2024"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Date</label>
                        <input
                            type="date"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            className="w-full bg-black/40 border border-gray-600 rounded-xl p-4 text-white focus:border-purple-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Time</label>
                        <input
                            type="time"
                            name="time"
                            value={formData.time}
                            onChange={handleChange}
                            className="w-full bg-black/40 border border-gray-600 rounded-xl p-4 text-white focus:border-purple-500 outline-none"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Venue / Location</label>
                    <input
                        type="text"
                        name="venue"
                        value={formData.venue}
                        onChange={handleChange}
                        className="w-full bg-black/40 border border-gray-600 rounded-xl p-4 text-white focus:border-purple-500 outline-none"
                        placeholder="e.g. Grand Hall, NYC or Zoom Link"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="w-full bg-black/40 border border-gray-600 rounded-xl p-4 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all h-32 resize-none"
                        placeholder="Describe your event..."
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Price (ALGO)</label>
                        <input
                            type="number"
                            name="price"
                            value={formData.price}
                            onChange={handleChange}
                            className="w-full bg-black/40 border border-gray-600 rounded-xl p-4 text-white focus:border-purple-500 outline-none"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Total Tickets</label>
                        <input
                            type="number"
                            name="supply"
                            value={formData.supply}
                            onChange={handleChange}
                            className="w-full bg-black/40 border border-gray-600 rounded-xl p-4 text-white focus:border-purple-500 outline-none"
                            placeholder="100"
                            min="1"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !accountAddress}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition-all 
                        ${loading ? 'bg-gray-600 cursor-not-allowed' :
                            !accountAddress ? 'bg-gray-600 opacity-50 cursor-not-allowed' :
                                'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:scale-[1.01] active:scale-[0.99]'}`}
                >
                    {loading ? 'Processing...' : !accountAddress ? 'Connect Wallet to Create' : 'Mint Event Tickets'}
                </button>
            </form>

            {message && (
                <div className={`mt-6 p-4 rounded-lg text-sm border ${message.includes('Failed') ? 'bg-red-900/20 border-red-800 text-red-200' : 'bg-green-900/20 border-green-800 text-green-200'}`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default CreateEvent;
