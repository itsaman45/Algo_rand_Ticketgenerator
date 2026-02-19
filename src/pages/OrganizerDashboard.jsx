import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAlgorand } from '../context/AlgorandContext';
import algosdk from 'algosdk';
import { getSmartContractSource, compileProgram } from '../utils/marketplaceContract';
import { Buffer } from 'buffer';

const OrganizerDashboard = () => {
    const { accountAddress, indexerClient, algodClient, peraWallet } = useAlgorand();
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState([]);
    const [pendingOrders, setPendingOrders] = useState([]);
    const [stats, setStats] = useState({
        totalEvents: 0,
        totalTicketsSold: 0,
        totalRevenue: 0
    });

    // Helper: Parse logic with safety checks
    const parseEventFromTxn = (txn) => {
        try {
            const createdAssetId = txn['created-asset-index'];
            if (!createdAssetId) return null;
            if (!txn.note) return null;

            let decodedNote = atob(txn.note);
            const APP_PREFIX = "TICKET_APP_V3:";
            if (decodedNote.startsWith(APP_PREFIX)) {
                decodedNote = decodedNote.slice(APP_PREFIX.length);
            }

            const noteJSON = JSON.parse(decodedNote);
            if (noteJSON.type !== 'ticket-token') return null;

            const assetParams = txn['asset-config-transaction']['params'];
            return {
                id: createdAssetId,
                name: assetParams.name,
                unitName: assetParams['unit-name'],
                total: assetParams.total || 0,
                creator: txn.sender,
                price: noteJSON.price ? noteJSON.price / 1000000 : 0,
                // Ensure strings
                date: String(noteJSON.date || "TBA"),
                time: String(noteJSON.time || ""),
                venue: String(noteJSON.venue || "TBA")
            };
        } catch (e) {
            return null;
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!accountAddress || !indexerClient) return;
            setLoading(true);

            try {
                // 1. Fetch Created Assets
                const accountInfo = await indexerClient.lookupAccountCreatedAssets(accountAddress).limit(100).do();
                const assets = accountInfo['assets'] || [];
                const activeAssets = assets.filter(a => !a.deleted);

                // 2. Fetch Details & Sales Logic in Parallel
                const detailsPromises = activeAssets.map(async (asset) => {
                    try {
                        // A. Get Creation Note (Metadata)
                        const txns = await indexerClient.searchForTransactions()
                            .assetID(asset.index)
                            .txType('acfg')
                            .limit(10)
                            .do();

                        const creationTxn = (txns.transactions || []).find(t => t['created-asset-index'] === asset.index);
                        if (!creationTxn) return null;

                        const eventData = parseEventFromTxn(creationTxn);
                        if (!eventData) return null;

                        // B. Get Current Balance (Sales Logic)
                        // V3: Sold = Total - Vending Machine Balance

                        // 1. Calculate VM Address
                        const priceMicroAlgos = Math.round(eventData.price * 1000000);
                        const source = getSmartContractSource(eventData.id, priceMicroAlgos, accountAddress);
                        // We need access to compileProgram which uses algodClient
                        // Since we are inside map, this is async.

                        // Note: compileProgram is imported from utils.
                        const compiled = await compileProgram(algodClient, source);
                        const vmAddress = compiled.hash;

                        // 2. Fetch VM Balance
                        // Use Algod for accuracy
                        let available = 0;
                        try {
                            const vmInfo = await algodClient.accountInformation(vmAddress).do();
                            const vmAsset = vmInfo['assets'].find(a => a['asset-id'] === eventData.id);
                            available = vmAsset ? vmAsset.amount : 0;
                        } catch (e) {
                            // If VM not found/funded yet, it might be 0 available (or full if not started?)
                            // For dashboard, let's assume if VM empty, maybe started?
                            // Actually if VM has 0, it means Sold Out OR Not Setup.
                            // But CreateEvent setup is atomic now. So likely Sold Out.
                            available = 0;
                        }

                        const sold = eventData.total - available;
                        const revenue = sold * eventData.price;

                        return { ...eventData, sold, revenue };
                    } catch (e) {
                        console.error("Error parsing asset", asset.index, e);
                        return null;
                    }
                });

                const allEvents = (await Promise.all(detailsPromises)).filter(e => e !== null);

                // Sort by ID desc (newest first)
                allEvents.sort((a, b) => b.id - a.id);

                // 3. FETCH PENDING ORDERS
                const orders = [];
                const PAYMENT_NOTE_PREFIX = "BUY_TICKET_";
                const enc = new TextEncoder();

                // Search for payments TO me with correct note
                const payTxns = await indexerClient.searchForTransactions()
                    .address(accountAddress)
                    .addressRole('receiver')
                    .txType('pay')
                    .notePrefix(enc.encode(PAYMENT_NOTE_PREFIX))
                    .limit(100)
                    .do();

                for (const txn of (payTxns.transactions || [])) {
                    try {
                        const note = atob(txn.note);
                        const assetId = parseInt(note.replace(PAYMENT_NOTE_PREFIX, ''));
                        const buyer = txn.sender;

                        // Check if valid event
                        const event = allEvents.find(e => e.id === assetId);
                        if (!event) continue;

                        // Check if fulfilled (Does buyer have asset?)
                        // Use ALGOD for real-time accuracy (Indexer lags)
                        let buyerHolding = null;
                        try {
                            const buyerInfo = await algodClient.accountInformation(buyer).do();
                            buyerHolding = buyerInfo['assets'].find(a => a['asset-id'] === assetId);
                        } catch (e) {
                            // User might not be opted in or account new
                        }

                        // If buyer has 0 (or undefined), it's PENDING
                        if (!buyerHolding || buyerHolding.amount === 0) {
                            orders.push({
                                id: txn.id, // TxID of payment
                                buyer,
                                assetId,
                                eventName: event.name,
                                amount: txn['payment-transaction']?.amount ? txn['payment-transaction'].amount / 1000000 : 0,
                                timestamp: txn['round-time']
                            });
                        }
                    } catch (e) {
                        // ignore malformed notes
                    }
                }

                setEvents(allEvents);
                setPendingOrders(orders);
                // ... (Stats)

                // Stats
                setStats({
                    totalEvents: allEvents.length,
                    totalTicketsSold: allEvents.reduce((sum, e) => sum + e.sold, 0),
                    totalRevenue: allEvents.reduce((sum, e) => sum + e.revenue, 0)
                });

            } catch (error) {
                console.error("Dashboard fetch error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [accountAddress, indexerClient]);



    // ... (imports)

    // ... (inside component)

    const activateInstantBuy = async (event) => {
        if (!algodClient || !accountAddress) return;

        try {
            // Calculate Address FIRST to show to user
            const source = getSmartContractSource(event.id, Math.round(event.price * 1000000), accountAddress);
            const compiled = await compileProgram(algodClient, source);
            const logicSigAddress = compiled.hash;

            const proceed = window.confirm(
                `Activate Instant Buy for "${event.name}"?\n\n` +
                `VM Address: ${logicSigAddress}\n\n` +
                `This will move your tickets to a "Vending Machine" (Smart Contract).\n` +
                `If you previously tried and failed, clicking this again will RESUME the setup!`
            );
            if (!proceed) return;

            setLoading(true);

            console.log("Vending Machine Address:", logicSigAddress);

            // ... (rest of logic: check state, etc)

            // CHECK EXISTING STATE
            let isFunded = false;
            let isOptedIn = false;
            let currentVmStock = 0;

            try {
                const vmInfo = await algodClient.accountInformation(logicSigAddress).do();
                if (vmInfo.amount > 100000) isFunded = true;
                const holding = vmInfo['assets'].find(a => a['asset-id'] === event.id);
                if (holding) {
                    isOptedIn = true;
                    currentVmStock = holding.amount;
                }
            } catch (e) {
                // Account probably doesn't exist yet
            }

            const suggestedParams = await algodClient.getTransactionParams().do();
            const txnsToSign = [];

            // 1. Funding (Skip if already has > 0.1 ALGO, but let's be safe and top up if low)
            // Actually, for simplicity/safety, let's always fund if < 0.2
            // If it has 0.19, we don't need to fund really.
            // Let's just fund if it's not well funded.
            if (!isFunded) {
                const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                    from: accountAddress,
                    to: logicSigAddress,
                    amount: 1000000, // 1.0 ALGO to account for MBR + Future Fees 
                    suggestedParams
                });
                // We will sign this
                console.log("Adding Fund Txn...");
                // EXECUTE FUNDING IMMEDIATELY (Simpler than grouping if we want sequential safety)
                const signedFund = await peraWallet.signTransaction([[{ txn: fundTxn, signers: [accountAddress] }]]);
                await algodClient.sendRawTransaction(signedFund[0]).do();
                await algosdk.waitForConfirmation(algodClient, fundTxn.txID, 10);
                console.log("Funded.");
            } else {
                console.log("VM already funded. Skipping Step 1.");
            }

            // 2. Opt-In (Wrapped in check)
            if (!isOptedIn) {
                const programBytes = new Uint8Array(Buffer.from(compiled.result, "base64"));
                const lsig = new algosdk.LogicSigAccount(programBytes);
                const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    from: logicSigAddress,
                    to: logicSigAddress,
                    assetIndex: event.id,
                    amount: 0,
                    suggestedParams
                });
                const signedOptIn = algosdk.signLogicSigTransactionObject(optInTxn, lsig);

                await algodClient.sendRawTransaction(signedOptIn.blob).do();
                await algosdk.waitForConfirmation(algodClient, optInTxn.txID, 10);
                console.log("Opted In.");
            } else {
                console.log("VM already opted-in. Skipping Step 2.");
            }

            // 3. Stock Transaction
            const accountAssetInfo = await indexerClient.lookupAccountAssets(accountAddress).assetId(event.id).do();
            const holding = accountAssetInfo['assets'].find(a => a['asset-id'] === event.id);
            const balance = holding ? holding.amount : 0;

            if (balance > 0) {
                const stockTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    from: accountAddress,
                    to: logicSigAddress,
                    assetIndex: event.id,
                    amount: balance,
                    suggestedParams
                });

                const signedStock = await peraWallet.signTransaction([[{ txn: stockTxn, signers: [accountAddress] }]]);
                await algodClient.sendRawTransaction(signedStock[0]).do();
                await algosdk.waitForConfirmation(algodClient, stockTxn.txID, 30);
                console.log("Stocked.");
            } else {
                if (currentVmStock > 0) {
                    alert("System Check: VM is already stocked!");
                } else {
                    alert("You have no tickets to stock! (Check if you already sent them?)");
                }
                window.location.reload();
                return;
            }

            alert("Auto-Sell Activation Complete! Tickets are in the Vending Machine.");
            window.location.reload();

        } catch (e) {
            console.error(e);
            alert("Activation Failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFulfillOrder = async (order) => {
        // ... (existing helper)
    };

    // ... (Render changes below)



    if (!accountAddress) return <div className="text-center mt-20 text-white">Please connect wallet.</div>;

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2">Organizer Dashboard</h1>
                    <p className="text-gray-400">Manage your events and track performance.</p>
                </div>
                <div className="flex gap-4">
                    <Link to="/organizer/create-event" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-purple-500/30">
                        + Create New Event
                    </Link>
                </div>
            </header>



            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">📊</div>
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Active Events</h3>
                    <p className="text-4xl font-bold text-white">{loading ? '...' : stats.totalEvents}</p>
                </div>
                <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🎟️</div>
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Tickets Sold</h3>
                    <p className="text-4xl font-bold text-white">{loading ? '...' : stats.totalTicketsSold}</p>
                </div>
                <div className="glass-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">💰</div>
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Total Revenue</h3>
                    <p className="text-4xl font-bold text-green-400">
                        {loading ? '...' : stats.totalRevenue.toFixed(2)} <span className="text-sm text-gray-400">ALGO</span>
                    </p>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-6">Your Events</h2>

            {loading ? (
                <div className="text-center py-20 animate-pulse text-gray-500">Loading your events...</div>
            ) : events.length === 0 ? (
                <div className="glass-card p-12 rounded-2xl text-center border-dashed border-gray-700">
                    <p className="text-gray-400 mb-4">You haven't created any events yet.</p>
                    <Link to="/organizer/create-event" className="text-purple-400 hover:text-white font-bold">Get Started &rarr;</Link>
                </div>
            ) : (
                <div className="grid gap-6">
                    {events.map((event) => (
                        <div key={event.id} className="glass-card p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row gap-6 items-center">

                            {/* Date Badge */}
                            <div className="flex flex-col items-center justify-center bg-white/5 p-4 rounded-xl min-w-[80px]">
                                <span className="text-xs text-gray-400 uppercase font-bold">{String(event.date).split('-')[1] || 'TBA'}</span>
                                <span className="text-2xl font-bold text-white">{String(event.date).split('-')[2] || '--'}</span>
                            </div>

                            {/* Info */}
                            <div className="flex-grow text-center md:text-left">
                                <div className="flex items-center gap-3 justify-center md:justify-start mb-1">
                                    <h3 className="text-xl font-bold text-white">{event.name}</h3>
                                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                                        #{event.id}
                                    </span>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">📍 {event.venue} • 🕒 {event.time}</p>
                                <div className="flex items-center gap-4 justify-center md:justify-start text-xs font-mono text-gray-500">
                                    <span>Price: {event.price} ALGO</span>
                                    <span>Supply: {event.total}</span>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="min-w-[200px] w-full md:w-auto">
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-gray-400">Sales Progress</span>
                                    <span className="text-white font-bold">{event.sold} / {event.total}</span>
                                </div>
                                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden mb-2">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full"
                                        style={{ width: `${(event.sold / event.total) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="text-right">
                                    <span className="text-green-400 font-bold text-sm">
                                        +{event.revenue.toFixed(2)} ALGO
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Link
                                    to="/organizer/verify"
                                    className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
                                    title="Verify Tickets"
                                >
                                    📷 Scan
                                </Link>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrganizerDashboard;
