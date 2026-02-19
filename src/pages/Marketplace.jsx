import React, { useState } from 'react';
import { useAlgorand } from '../context/AlgorandContext';
import * as algosdk from 'algosdk';
import { getSmartContractSource, compileProgram } from '../utils/marketplaceContract';
import { Buffer } from 'buffer';

const Marketplace = () => {
    const { indexerClient, algodClient, accountAddress, peraWallet } = useAlgorand();
    const [searchTerm, setSearchTerm] = useState('');
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [buying, setBuying] = useState(null);

    const [nextToken, setNextToken] = useState(null);

    // Helper: Parse logic
    const parseEventFromTxn = (txn) => {
        try {
            const createdAssetId = txn['created-asset-index'];
            if (!createdAssetId) return null;
            if (!txn.note) return null;

            let decodedNote = atob(txn.note);

            // Strip Prefix if present
            const APP_PREFIX = "TICKET_APP_V3:";
            if (decodedNote.startsWith(APP_PREFIX)) {
                decodedNote = decodedNote.slice(APP_PREFIX.length);
            } else {
                // Skip if not V2
                return null;
            }

            const noteJSON = JSON.parse(decodedNote);

            if (noteJSON.type !== 'ticket-token') return null;

            const assetParams = txn['asset-config-transaction']['params'];
            if (!assetParams) return null;

            return {
                id: createdAssetId,
                name: assetParams.name,
                unitName: assetParams['unit-name'],
                total: assetParams.total,
                creator: txn.sender,
                description: noteJSON.desc || "No description",
                price: noteJSON.price ? noteJSON.price / 1000000 : 0,
                date: noteJSON.date || "Date TBA",
                time: noteJSON.time || "",
                venue: noteJSON.venue || "Venue TBA"
            };
        } catch (e) {
            return null;
        }
    };

    // Fetch Global Events (Smart Window Strategy)
    const fetchGlobalEvents = async (nextTokenArg = null) => {
        if (!indexerClient || !algodClient) return { events: [], next: null };

        setLoading(true);
        console.log("Fetching global events (Smart Window)...");

        try {
            // Step 1: Get current round to define a "Recent" window
            // limiting the search window prevents "500 Timeout" errors on public nodes
            const status = await algodClient.status().do();
            const currentRound = status['last-round'];
            const SEARCH_WINDOW = 100000; // Look back ~100k blocks (approx 1-2 days on Testnet)
            const minRound = Math.max(0, currentRound - SEARCH_WINDOW);

            console.log(`Searching for Tagged Events since round ${minRound}...`);

            const APP_PREFIX = "TICKET_APP_V3:";
            const encoder = new TextEncoder();
            const notePrefixEncoded = encoder.encode(APP_PREFIX);

            let query = indexerClient.searchForTransactions()
                .notePrefix(notePrefixEncoded)
                .minRound(minRound) // Crucial optimization
                .txType('acfg')
                .limit(1000);

            if (nextTokenArg) {
                query = query.nextToken(nextTokenArg);
            }

            const txnInfo = await query.do();
            console.log("Smart Window Response:", txnInfo);

            const newEvents = [];
            for (const txn of txnInfo.transactions) {
                const event = parseEventFromTxn(txn);
                if (event) newEvents.push(event);
            }

            const next = txnInfo['next-token'];
            setNextToken(next);

            return { events: newEvents, next };

        } catch (error) {
            console.error("Smart Window Fetch Failed:", error);

            // Fallback: If Smart Window fails, try raw recent scan (Strategy B logic)
            // But usually minRound fixes the timeout.
            return { events: [], next: null };
        } finally {
            setLoading(false);
        }
    };

    // Fetch User's Own Events (Guaranteed visibility)
    const fetchAccountEvents = async () => {
        if (!indexerClient || !accountAddress) return [];
        console.log("Fetching user events...");
        try {
            const accountInfo = await indexerClient.lookupAccountCreatedAssets(accountAddress).do();
            const assets = accountInfo['assets'] || [];

            // We need to fetch the creation transaction for each asset to get the Note (Price/Desc)
            const userEvents = [];
            for (const asset of assets) {
                if (asset.deleted) continue;

                // Lookup creation txn for this asset
                const txns = await indexerClient.searchForTransactions()
                    .assetID(asset.index)
                    .txType('acfg')
                    .do();

                const creationTxn = txns.transactions.find(t => t['created-asset-index'] === asset.index);
                if (creationTxn) {
                    const event = parseEventFromTxn(creationTxn);
                    if (event) userEvents.push(event);
                }
            }
            return userEvents;
        } catch (e) {
            console.error("User Events Fetch Error:", e);
            return [];
        }
    };

    const loadMore = async () => {
        const { events: global } = await fetchGlobalEvents(nextToken); // Destructure
        mergeAndSetEvents(global);
    };

    const refreshAll = async () => {
        // Reset
        setEvents([]);
        setNextToken(null);

        // Fetch Parallel
        // Note: We pass null to fetchGlobalEvents to start fresh
        const [userEvents, globalResult] = await Promise.all([
            fetchAccountEvents(),
            fetchGlobalEvents(null)
        ]);

        // Merge
        const all = [...userEvents, ...globalResult.events];
        mergeAndSetEvents(all, true);
    };

    const mergeAndSetEvents = (newEvents, replace = false) => {
        setEvents(prev => {
            const base = replace ? [] : prev;
            const combined = [...base, ...newEvents];

            // Deduplicate by ID
            const seen = new Set();
            const unique = [];
            for (const item of combined) {
                if (!seen.has(item.id)) {
                    seen.add(item.id);
                    unique.push(item);
                }
            }
            return unique.sort((a, b) => b.id - a.id); // Newest first
        });
    };

    // Initial Fetch - Runs on mount (public access)
    React.useEffect(() => {
        if (indexerClient) {
            refreshAll();
        }
    }, [indexerClient]); // Removed accountAddress dependency to prevent double-fetch, handled inside refreshAll

    // Re-fetch user events when account changes
    React.useEffect(() => {
        if (accountAddress && indexerClient) {
            fetchAccountEvents().then(userEvents => {
                mergeAndSetEvents(userEvents);
            });
        }
    }, [accountAddress]);

    // Hydrate events with "Sold" data (Creator Balance Check)
    React.useEffect(() => {
        if (!indexerClient || events.length === 0) return;

        const fetchSoldData = async () => {
            // Find events that haven't been hydrated yet
            const eventsToUpdate = events.filter(e => e.sold === undefined);
            if (eventsToUpdate.length === 0) return;

            console.log(`Hydrating sales data for ${eventsToUpdate.length} events...`);

            // Process sequentially or in small batches to avoid rate limits
            const updatedEvents = await Promise.all(eventsToUpdate.map(async (ev) => {
                try {
                    // 1. Get VM Address
                    const priceMicroAlgos = Math.round(ev.price * 1000000);
                    const source = getSmartContractSource(ev.id, priceMicroAlgos, ev.creator);
                    const compiled = await compileProgram(algodClient, source);
                    const vmAddress = compiled.hash;

                    console.log(`[Hydrate ${ev.id}] Price: ${priceMicroAlgos}, VM: ${vmAddress}`);

                    // 2. Check VM Balance (Available Stock)
                    const vmInfo = await algodClient.accountInformation(vmAddress).do();
                    // console.log(`[Hydrate ${ev.id}] VM Info:`, vmInfo);

                    const vmAsset = vmInfo['assets'].find(a => a['asset-id'] === ev.id);
                    const available = vmAsset ? vmAsset.amount : 0;

                    console.log(`[Hydrate ${ev.id}] Available: ${available}, Total: ${ev.total}`);

                    // 3. Calculate Sold
                    const soldCount = ev.total - available;

                    return { ...ev, sold: soldCount, available: available };
                } catch (e) {
                    console.error(`Failed to hydrate event ${ev.id}`, e);
                    // Fallback: If VM not found, assume 0 available (Sold Out or Not Started)
                    return { ...ev, sold: ev.total, available: 0 };
                }
            }));

            // Merge updates back into state safely
            setEvents(prev => {
                const map = new Map(prev.map(p => [p.id, p]));
                updatedEvents.forEach(u => {
                    if (u.sold !== undefined) map.set(u.id, u);
                });
                return Array.from(map.values()).sort((a, b) => b.id - a.id);
            });
        };

        // Debounce or just run?
        // Since events updates often, let's run it.
        // It filters `e.sold === undefined` so it won't loop infinitely unless fetch fails repeatedly.
        fetchSoldData();
    }, [events.length, indexerClient]); // Depend on length to trigger when new events arrive




    // ... (existing code)

    // ... (existing code)

    // Rename to handleBuy to match usage
    const handleBuy = async (asset) => {
        console.log("Buy Clicked for asset:", asset.id); // Add debug log
        if (!accountAddress) {
            alert('Connect wallet first');
            return;
        }
        setBuying(asset.id);
        try {
            const suggestedParams = await algodClient.getTransactionParams().do();

            // 1. Determine if Vending Machine exists and has stock
            const source = getSmartContractSource(asset.id, Math.round(asset.price * 1000000), asset.creator);
            const compiled = await compileProgram(algodClient, source);
            const logicSigAddress = compiled.hash;

            let isInstantBuy = false;
            try {
                console.log(`Checking Vending Machine for Asset ${asset.id}...`);
                console.log(`VM Address: ${logicSigAddress}`);
                console.log(`Expected Price (MicroAlgos): ${Math.round(asset.price * 1000000)}`);

                // Use ALGOD for real-time check (Indexer has latency)
                const accountInfo = await algodClient.accountInformation(logicSigAddress).do();
                console.log("VM Account Info:", accountInfo);

                const stock = accountInfo['assets'].find(a => a['asset-id'] === asset.id);
                console.log("VM Stock:", stock);

                if (stock && stock.amount > 0) {
                    isInstantBuy = true;
                    console.log("Instant Buy Available!");
                } else {
                    console.warn("VM exists but has NO stock or not opted in.");
                    // Check balance to see if it was funded
                    if (accountInfo.amount < 100000) {
                        console.warn("VM has low ALGO balance. Funding failed?");
                    }
                }
            } catch (e) {
                // Account not found or no assets = Not active
                console.error("Instant Buy Check Failed:", e);
                console.log("Likely cause: VM not funded/activated yet.");
            }



            // OPT-IN (Always needed first)
            const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                from: accountAddress,
                to: accountAddress,
                assetIndex: asset.id,
                amount: 0,
                suggestedParams
            });

            if (isInstantBuy) {
                // ATOMIC SWAP: [OptIn, Payment, AxferFromLsig]
                // Wait, OptIn is needed by User. User signs OptIn + Payment. Lsig signs Axfer.
                // We group: [OptIn, Payment, Axfer]

                const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                    from: accountAddress,
                    to: asset.creator,
                    amount: Math.round(asset.price * 1000000),
                    suggestedParams
                });

                const axferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                    from: logicSigAddress,
                    to: accountAddress,
                    assetIndex: asset.id,
                    amount: 1,
                    suggestedParams
                });

                const txns = [optInTxn, paymentTxn, axferTxn];
                const grouped = algosdk.assignGroupID(txns);

                // Sign User Txns - MUST INCLUDE ALL TRANSACTIONS FOR PERA
                const multipleTxnGroups = [
                    { txn: grouped[0], signers: [accountAddress] }, // OptIn (User)
                    { txn: grouped[1], signers: [accountAddress] }, // Payment (User)
                    { txn: grouped[2], signers: [] }                // LogicSig (Read-Only)
                ];

                console.log("Sending Atomic Group (3 Txns) to Pera...");

                // ROBUST SIGNATURE EXTRACTION
                const signedUserTxns = await peraWallet.signTransaction([multipleTxnGroups]);
                console.log("Pera Raw Result:", signedUserTxns);

                const flatTxns = Array.isArray(signedUserTxns) ? signedUserTxns.flat(Infinity) : [];
                const userSigs = flatTxns.filter(item => item instanceof Uint8Array);

                if (userSigs.length < 2) {
                    console.error("Expected 2 user signatures (OptIn + Payment), got:", userSigs.length);
                    throw new Error(`Wallet signing incomplete. Expected 2 signatures, got ${userSigs.length}. Please try again.`);
                }

                // Sign Lsig Txn programmatically
                const programBytes = new Uint8Array(Buffer.from(compiled.result, "base64"));
                const lsig = new algosdk.LogicSigAccount(programBytes);
                // We sign grouped[2] explicitly
                const signedLsigTxn = algosdk.signLogicSigTransactionObject(grouped[2], lsig);

                // Assemble: (UserSig1, UserSig2, LsigSig)
                // userSigs[0] -> OptIn
                // userSigs[1] -> Payment
                const signedTxns = [
                    userSigs[0],           // User's OptIn Sig
                    userSigs[1],           // User's Payment Sig
                    signedLsigTxn.blob     // Lsig Sig
                ];

                const { txId } = await algodClient.sendRawTransaction(signedTxns).do();
                alert(`Swapped Instantly! Ticket ${asset.id} received. Tx: ${txId}`);
                window.location.reload(); // Quick refresh to show "My Tickets"

            } else {
                alert(`Auto-Sell Inactive.\n\nDebug Info:\nVM Address: ${logicSigAddress}\nAsset ID: ${asset.id}\n\nPossible Reasons:\n1. Event Creator didn't finish setup (Funding/Stocking).\n2. Network is slow (try refreshing after 1 min).\n3. VM is out of stock.`);
                return;
            }

        } catch (error) {
            console.error(error);
            if (error.message.includes('overspend')) {
                alert('Insufficient funds.');
            } else if (error.message.includes('has already opted in')) {
                alert('You already opted in. Please just pay directly if trying to buy again.');
            } else {
                alert('Purchase Failed: ' + error.message);
            }
        } finally {
            setBuying(null);
        }
    };

    // Client-side Filter
    const filteredEvents = events.filter(event =>
        event.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white">Global Event Marketplace</h2>

                <div className="flex w-full md:w-auto gap-2">
                    <input
                        type="text"
                        placeholder="Search Event Name..."
                        className="w-full md:w-64 bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                        onClick={refreshAll}
                        className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-white"
                        title="Refresh"
                    >
                        ↻
                    </button>
                    {nextToken && (
                        <button
                            onClick={loadMore}
                            className="bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-white font-bold text-sm whitespace-nowrap"
                        >
                            Load More
                        </button>
                    )}
                </div>
            </div>

            {loading && events.length === 0 ? (
                <div className="text-center text-gray-400 py-12">Loading events from the blockchain...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredEvents.map((event) => (
                        <div key={event.id} className="glass-card rounded-2xl overflow-hidden group relative">
                            {/* Glow Effect */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -mr-16 -mt-16 transition-all group-hover:bg-purple-500/20"></div>

                            <div className="p-6 relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-bold text-white group-hover:text-neon-cyan transition-colors truncate pr-2">{event.name}</h3>
                                    <div className="flex flex-col items-end">
                                        <span className="bg-white/10 text-xs font-mono px-2 py-1 rounded border border-white/5 text-gray-300 mb-1">
                                            #{event.id}
                                        </span>
                                        {event.sold !== undefined && (
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-green-400">
                                                {event.sold} / {event.total} Sold
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full bg-gray-700 h-1.5 rounded-full mb-6 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${event.sold ? (event.sold / event.total) * 100 : 0}%` }}
                                    ></div>
                                </div>

                                <div className="flex flex-col gap-1 mb-4 text-xs text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <span>📅</span>
                                        <span>{event.date} {event.time && `at ${event.time}`}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span>📍</span>
                                        <span className="truncate">{event.venue}</span>
                                    </div>
                                </div>

                                <p className="text-gray-400 text-sm mb-6 line-clamp-2 h-10">{event.description}</p>

                                <div className="flex items-center justify-between mb-6 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <span className="text-gray-300">{event.unitName}</span>
                                    </div>
                                    <span className="text-gray-500">Supply: {event.total.toString()}</span>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500 uppercase tracking-wider">Price</span>
                                        <span className="text-2xl font-bold text-white tracking-tight">
                                            {event.price} <span className="text-sm font-normal text-purple-400">ALGO</span>
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => handleBuy(event)}
                                        disabled={buying === event.id || (event.available !== undefined && event.available === 0)}
                                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all transform active:scale-95 ${(event.available !== undefined && event.available === 0)
                                            ? 'bg-gray-700/50 text-red-400 cursor-not-allowed border border-red-900/30'
                                            : buying === event.id
                                                ? 'bg-gray-700 cursor-wait'
                                                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg hover:shadow-purple-500/25 text-white'
                                            }`}
                                    >
                                        {buying === event.id ? 'Processing...' :
                                            (event.available !== undefined && event.available === 0) ? 'Sold Out' :
                                                !accountAddress ? 'Connect to Buy' : 'Buy Ticket'}
                                    </button>
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            )}

            {!loading && filteredEvents.length === 0 && (
                <div className="text-center text-gray-500 py-12 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
                    <p className="text-xl mb-2">No events found matching "{searchTerm}"</p>
                    <p className="text-sm">Be the first to create one!</p>
                </div>
            )}
        </div>
    );
};

export default Marketplace;
