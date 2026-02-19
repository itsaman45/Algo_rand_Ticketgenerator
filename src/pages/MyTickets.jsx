import React, { useState, useEffect } from 'react';
import { useAlgorand } from '../context/AlgorandContext';
import { QRCodeCanvas } from 'qrcode.react';

const MyTickets = () => {
    const { accountAddress, indexerClient } = useAlgorand();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);

    const downloadQR = () => {
        const canvas = document.getElementById('ticket-qr');
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `Ticket_${selectedTicket.name.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    useEffect(() => {
        const fetchMyTickets = async () => {
            setLoading(true);
            try {
                const accountInfo = await indexerClient.lookupAccountAssets(accountAddress).do();
                const assets = accountInfo['assets'];

                // Filter for assets with amount > 0 
                const ownedAssets = assets.filter(asset => asset.amount > 0);

                const ticketsWithDetails = await Promise.all(ownedAssets.map(async (asset) => {
                    try {
                        const assetInfo = await indexerClient.lookupAssetByID(asset['asset-id']).do();
                        const params = assetInfo['asset']['params'];

                        // Filter out assets created by self (Organizer view handled elsewhere)
                        if (params['creator'] === accountAddress) return null;

                        return {
                            id: asset['asset-id'],
                            amount: asset['amount'],
                            name: params['name'],
                            unitName: params['unit-name']
                        };
                    } catch (e) {
                        return null;
                    }
                }));

                setTickets(ticketsWithDetails.filter(t => t !== null));
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        if (accountAddress && indexerClient) {
            fetchMyTickets();
        }
    }, [accountAddress, indexerClient]);

    if (!accountAddress) return <div className="text-center mt-10">Please connect your wallet.</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">My Tickets</h2>

            {loading ? (
                <div className="text-center text-gray-400 py-12 animate-pulse">Scanning blockchain for your tickets...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tickets.map((ticket) => (
                        <div key={ticket.id} className="glass-card rounded-2xl p-6 relative group overflow-hidden">
                            {/* Abstract bg shape */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-bold text-white tracking-tight">{ticket.name}</h3>
                                    <span className="glass px-2 py-1 rounded text-xs font-mono text-cyan-300 border border-cyan-500/30">
                                        {ticket.unitName}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="text-gray-400 text-sm">Quantity:</span>
                                    <span className="text-white font-bold">{ticket.amount}</span>
                                </div>

                                <p className="text-[10px] text-gray-500 font-mono mb-4 truncate">Asset ID: {ticket.id}</p>

                                <button
                                    onClick={() => setSelectedTicket(ticket)}
                                    className="w-full py-2 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 text-white transition-all backdrop-blur-md"
                                >
                                    View QR Ticket
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tickets.length === 0 && !loading && (
                <div className="text-center text-gray-400 mt-10 p-8 glass rounded-2xl border-dashed border-gray-700">
                    <p>You don't own any tickets yet.</p>
                </div>
            )}

            {selectedTicket && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedTicket(null)}>
                    <div className="glass-card p-8 rounded-3xl max-w-sm w-full text-center border border-white/10 relative overflow-hidden" onClick={e => e.stopPropagation()}>

                        {/* Glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/10 blur-3xl -z-10"></div>

                        <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">{selectedTicket.name}</h3>
                        <p className="text-gray-400 mb-8 font-mono text-xs truncate px-4">{accountAddress}</p>

                        <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl shadow-blue-500/20 mb-6">
                            <QRCodeCanvas
                                id="ticket-qr"
                                value={JSON.stringify({
                                    address: accountAddress,
                                    assetId: selectedTicket.id
                                })}
                                size={300}
                                level="Q"
                                includeMargin={true}
                                bgColor={"#ffffff"}
                                fgColor={"#000000"}
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={downloadQR}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2"
                            >
                                <span>⬇️</span> Download Ticket
                            </button>
                            <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest animate-pulse">Scan at Entrance</p>
                        </div>

                        <button
                            onClick={() => setSelectedTicket(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTickets;
