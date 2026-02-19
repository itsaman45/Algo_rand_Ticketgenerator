import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAlgorand } from '../context/AlgorandContext';
import { Html5Qrcode } from 'html5-qrcode';
import * as algosdk from 'algosdk';

const READER_ID = 'qr-reader';
const READER_HIDDEN_ID = 'qr-reader-hidden';

const Verify = () => {
    const { algodClient, accountAddress, peraWallet } = useAlgorand();
    const [scanResult, setScanResult] = useState(null);
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [cameraLoading, setCameraLoading] = useState(false);
    const html5QrCodeRef = useRef(null);
    const location = useLocation();

    // Process QR data (shared by camera and file upload)
    const verifyTicket = async (address, assetId) => {
        setVerificationStatus('checking');
        setScanResult({ address, assetId });
        setError('');
        setFreezeManager(null);

        if (!algodClient) {
            setError('Algod client not ready');
            setVerificationStatus('invalid');
            return;
        }

        try {
            const assetInfoGlobal = await algodClient.getAssetByID(assetId).do();
            const freezeAddr = assetInfoGlobal['params']['freeze'];
            setFreezeManager(freezeAddr);

            const accountInfo = await algodClient.accountInformation(address).do();
            const assets = accountInfo['assets'] || [];
            const assetParams = assets.find(a => a['asset-id'] === assetId);

            if (assetParams && assetParams.amount > 0) {
                if (assetParams['is-frozen']) {
                    setVerificationStatus('used');
                    setError('Ticket has already been used/scanned.');
                } else {
                    setVerificationStatus('valid');
                }
            } else {
                setVerificationStatus('invalid');
                setError('User does not hold this asset, or balance is 0.');
            }
        } catch (err) {
            console.error(err);
            setVerificationStatus('invalid');
            setError('Verification failed: Network error or Account not found.');
        }
    };

    const [freezeManager, setFreezeManager] = useState(null);

    const stopCamera = async () => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
            } catch (e) {
                console.warn('Stop camera error:', e);
            }
            html5QrCodeRef.current = null;
        }
        setCameraActive(false);
        setCameraError('');
    };

    const startCamera = async () => {
        if (cameraActive || cameraLoading) return;
        setCameraLoading(true);
        setCameraError('');

        try {
            // Let React flush so reader has dimensions
            await new Promise((r) => setTimeout(r, 100));

            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) {
                setCameraError('No camera found on this device.');
                setCameraLoading(false);
                return;
            }

            const element = document.getElementById(READER_ID);
            if (!element || element.offsetWidth === 0 || element.offsetHeight === 0) {
                setCameraError('Scanner area not ready. Please try again.');
                setCameraLoading(false);
                return;
            }

            // Clear any previous instance
            if (html5QrCodeRef.current) {
                try {
                    await html5QrCodeRef.current.stop();
                } catch (e) {}
                html5QrCodeRef.current = null;
            }

            const html5QrCode = new Html5Qrcode(READER_ID);
            html5QrCodeRef.current = html5QrCode;

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
            };

            // Prefer back camera on mobile (environment), fallback to first available
            const cameraId = cameras.find((c) => c.label.toLowerCase().includes('back'))?.id || cameras[0].id;

            await html5QrCode.start(
                cameraId,
                config,
                async (decodedText) => {
                    try {
                        await stopCamera();
                        const data = JSON.parse(decodedText);
                        if (data.address && data.assetId) {
                            verifyTicket(data.address, data.assetId);
                        } else {
                            setError('Invalid QR Code Format');
                            setVerificationStatus('invalid');
                            setScanResult({ address: 'Unknown', assetId: 'Unknown' });
                        }
                    } catch (e) {
                        console.error(e);
                        setError('Invalid QR Code Data');
                        setVerificationStatus('invalid');
                        setScanResult({ address: 'Unknown', assetId: 'Unknown' });
                    }
                },
                () => {}
            );

            setCameraActive(true);
        } catch (err) {
            console.error('Camera error:', err);
            const msg = err?.message || String(err);
            if (msg.includes('Permission') || msg.includes('permission') || msg.includes('NotAllowedError')) {
                setCameraError('Camera permission denied. Please allow camera access and try again.');
            } else if (msg.includes('NotFoundError') || msg.includes('not found')) {
                setCameraError('No camera found. Try uploading an image instead.');
            } else {
                setCameraError(msg || 'Failed to start camera. Use "Upload QR Image" as alternative.');
            }
        } finally {
            setCameraLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        if (e.target.files.length === 0) return;

        const file = e.target.files[0];
        const html5QrCode = new Html5Qrcode(READER_HIDDEN_ID);

        try {
            const decodedText = await html5QrCode.scanFile(file, false);
            const data = JSON.parse(decodedText);
            if (data.address && data.assetId) {
                verifyTicket(data.address, data.assetId);
            } else {
                setError('Invalid QR Code Format');
                setVerificationStatus('invalid');
                setScanResult({ address: 'Unknown', assetId: 'Unknown' });
            }
        } catch (err) {
            console.error('Scan Error:', err);
            setError(`Scan Failed: ${err.message || 'Unreadable QR'}`);
            setVerificationStatus('invalid');
            setScanResult({ address: 'Unknown', assetId: 'Unknown' });
        } finally {
            try {
                await html5QrCode.clear();
            } catch (e) {
                console.warn('Failed to clear file scanner', e);
            }
        }
    };

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [location.pathname]);

    const handleTestSign = async () => {
        if (!accountAddress || !algodClient) return;
        try {
            const params = await algodClient.getTransactionParams().do();
            const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                from: accountAddress,
                to: accountAddress,
                amount: 0,
                note: new Uint8Array(0),
                suggestedParams: params,
            });
            await peraWallet.signTransaction([[{ txn, signers: [accountAddress] }]]);
            alert('Test Signing Successful! ✅ Connection is good.');
        } catch (e) {
            console.error(e);
            alert('Test Signing Failed: ' + e.message);
        }
    };

    const handleAdmit = async () => {
        if (!accountAddress || !scanResult) return;

        if (accountAddress !== freezeManager) {
            alert(
                `Permission Denied.\n\nOnly the Event Organizer (Freeze Manager) can scan tickets.\n\nCurrent Account: ${accountAddress.slice(0, 8)}...\nOrganizer: ${freezeManager?.slice(0, 8)}...`
            );
            return;
        }

        if (!peraWallet.isConnected || (peraWallet.platform === 'mobile' && !peraWallet.connector)) {
            alert('Wallet session expired or disconnected. Please reconnect your Pera Wallet and try again.');
            return;
        }

        setProcessing(true);

        try {
            const assetIndexInt = parseInt(scanResult.assetId, 10);
            const freezeTarget = scanResult.address.trim();

            if (isNaN(assetIndexInt)) {
                alert('Error: Invalid Asset ID. Please rescan.');
                setProcessing(false);
                return;
            }
            if (!algosdk.isValidAddress(freezeTarget) || freezeTarget.length !== 58) {
                alert('Error: Invalid Target Address. Please rescan.');
                setProcessing(false);
                return;
            }

            const assetInfo = await algodClient.getAssetByID(assetIndexInt).do();
            const freezeAddr = assetInfo?.params?.freeze;

            if (!freezeAddr) {
                alert(
                    'CRITICAL ERROR: This asset has NO Freeze Address set. You must re-create the event with a Freeze Manager.'
                );
                setProcessing(false);
                return;
            }
            if (freezeAddr !== accountAddress) {
                alert(`PERMISSION ERROR: You are not authorized to freeze this asset.`);
                setProcessing(false);
                return;
            }

            const suggestedParams = await algodClient.getTransactionParams().do();
            const freezeTxn = algosdk.makeAssetFreezeTxnWithSuggestedParamsFromObject({
                from: accountAddress,
                assetIndex: assetIndexInt,
                freezeTarget,
                freezeState: true,
                note: new Uint8Array(0),
                suggestedParams,
            });

            const encoded = algosdk.encodeUnsignedTransaction(freezeTxn);
            const freezeTxnCanonical = algosdk.decodeUnsignedTransaction(encoded);

            const signPromise = peraWallet.signTransaction(
                [[{ txn: freezeTxnCanonical, signers: [accountAddress] }]],
                accountAddress
            );
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('SIGN_TIMEOUT')), 90000)
            );

            const signedTxns = await Promise.race([signPromise, timeoutPromise]);
            const signedBlob =
                signedTxns[0] instanceof Uint8Array
                    ? signedTxns[0]
                    : signedTxns.flat(Infinity).find((s) => s instanceof Uint8Array);

            if (!signedBlob) throw new Error('No signature returned from wallet');

            const { txId } = await algodClient.sendRawTransaction(signedBlob).do();
            await algosdk.waitForConfirmation(algodClient, txId, 4);

            setVerificationStatus('used');
            alert(`Ticket Verified & Marked as Used! (Tx: ${txId})`);
        } catch (error) {
            if (error?.message === 'SIGN_TIMEOUT') {
                alert(
                    'Request timed out. Try:\n1. Open Pera Wallet on same network\n2. Disconnect and reconnect wallet\n3. On mobile, keep wallet in foreground'
                );
            } else {
                alert('Failed to mark as used: ' + (error.message || error));
            }
        } finally {
            setProcessing(false);
        }
    };

    const reset = async () => {
        await stopCamera();
        setScanResult(null);
        setVerificationStatus(null);
        setError('');
    };

    return (
        <div className="max-w-md mx-auto text-center px-4 md:px-0 mb-20">
            <h2 className="text-3xl font-bold mb-6 text-white">Verify Ticket</h2>

            {!scanResult ? (
                <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col items-center">
                    <div className="w-full bg-black/50 rounded-xl border border-gray-700 mb-4 min-h-[300px] relative overflow-hidden">
                        {/* Reader must always be visible with dimensions so camera can render */}
                        <div
                            id={READER_ID}
                            className="absolute inset-0 w-full h-full min-h-[300px]"
                        />

                        {/* Overlay with Start Camera - only when camera not active */}
                        {!cameraActive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gray-900/95 z-[1]">
                                {cameraError ? (
                                    <p className="text-red-400 text-sm mb-4 text-center">{cameraError}</p>
                                ) : (
                                    <p className="text-gray-500 text-sm mb-4">
                                        Click below to open camera for real-time scanning
                                    </p>
                                )}
                                <button
                                    onClick={startCamera}
                                    disabled={cameraLoading}
                                    className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-wait text-white font-bold rounded-xl transition-all flex items-center gap-2"
                                >
                                    {cameraLoading ? (
                                        <>
                                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Starting camera...
                                        </>
                                    ) : (
                                        <>
                                            📷 Start Camera
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        <div
                            id={READER_HIDDEN_ID}
                            style={{
                                position: 'fixed',
                                top: '-9999px',
                                left: '-9999px',
                                width: 100,
                                height: 100,
                                opacity: 0,
                                pointerEvents: 'none',
                            }}
                        />

                        {cameraActive && (
                            <>
                                <div className="absolute inset-0 border-2 border-cyan-500/30 pointer-events-none rounded-xl" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-cyan-400 rounded-lg pointer-events-none shadow-[0_0_50px_rgba(34,211,238,0.2)]" />
                                <button
                                    onClick={stopCamera}
                                    className="absolute top-2 right-2 px-3 py-1 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg z-10"
                                >
                                    Stop Camera
                                </button>
                            </>
                        )}
                    </div>

                    <p className="text-gray-400 text-sm">
                        {cameraActive ? 'Point camera at the Attendee\'s QR Code' : 'OR'}
                    </p>

                    <div className="mt-4 flex flex-col items-center gap-3">
                        {cameraActive && <p className="text-gray-500 text-xs">OR</p>}
                        <label className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-2 rounded-lg text-white text-sm font-bold transition-all flex items-center gap-2">
                            <span>📂</span> Upload QR Image
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>

                        <button
                            onClick={handleTestSign}
                            className="text-xs text-gray-500 underline hover:text-white"
                        >
                            Test Pera Connection
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className={`p-8 rounded-2xl border-2 shadow-2xl ${
                        verificationStatus === 'valid'
                            ? 'border-green-500 bg-green-900/30 backdrop-blur-xl'
                            : verificationStatus === 'used'
                              ? 'border-yellow-500 bg-yellow-900/30 backdrop-blur-xl'
                              : verificationStatus === 'invalid'
                                ? 'border-red-500 bg-red-900/30 backdrop-blur-xl'
                                : 'border-blue-500 bg-black/40 backdrop-blur-xl'
                    }`}
                >
                    {verificationStatus === 'checking' && (
                        <div className="py-10">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <div className="text-xl animate-pulse text-blue-300">Verifying Ownership...</div>
                        </div>
                    )}

                    {verificationStatus === 'valid' && (
                        <div>
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg shadow-green-500/50">
                                ✅
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-2">VALID TICKET</h3>
                            <div className="bg-green-900/40 p-4 rounded-xl border border-green-500/30 text-left mb-6">
                                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Ticket Holder</p>
                                <p className="text-green-300 font-mono text-sm break-all mb-4">{scanResult.address}</p>
                                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Asset ID</p>
                                <p className="text-white font-bold">{scanResult.assetId}</p>
                            </div>

                            <button
                                onClick={handleAdmit}
                                disabled={processing || accountAddress !== freezeManager}
                                className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg mb-2 transition-all ${
                                    processing
                                        ? 'bg-gray-600 cursor-wait'
                                        : accountAddress !== freezeManager
                                          ? 'bg-gray-600/50 cursor-not-allowed text-gray-400 border border-gray-600'
                                          : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 hover:shadow-green-500/30 active:scale-95'
                                }`}
                            >
                                {processing
                                    ? 'Waiting for signature...'
                                    : accountAddress !== freezeManager
                                      ? 'Unauthorized (Organizer Only)'
                                      : 'ADMIT & MARK AS USED'}
                            </button>

                            {processing && (
                                <p className="text-cyan-300 text-sm text-center mt-3 animate-pulse">
                                    📱 Open your Pera Wallet app to confirm
                                </p>
                            )}

                            {accountAddress !== freezeManager && (
                                <p className="text-red-300 text-xs text-center mb-4 bg-red-900/20 p-2 rounded">
                                    ⚠️ Switch to the Event Organizer's wallet to scan tickets.
                                </p>
                            )}
                        </div>
                    )}

                    {verificationStatus === 'used' && (
                        <div>
                            <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg shadow-yellow-500/50">
                                ⚠️
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-2">ALREADY USED</h3>
                            <div className="bg-yellow-900/40 p-4 rounded-xl border border-yellow-500/30 text-left mb-6">
                                <p className="text-yellow-200">This ticket has already been scanned.</p>
                                <p className="text-sm text-gray-400 mt-2 font-mono">{scanResult.address}</p>
                            </div>
                        </div>
                    )}

                    {verificationStatus === 'invalid' && (
                        <div>
                            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg shadow-red-500/50">
                                ❌
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-2">ACCESS DENIED</h3>
                            <div className="bg-red-900/40 p-4 rounded-xl border border-red-500/30 text-left mb-6">
                                <p className="text-red-200">{error}</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={reset}
                        className="w-full bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-4 rounded-xl font-bold text-white transition-all active:scale-95"
                    >
                        Scan Next Ticket
                    </button>
                </div>
            )}
        </div>
    );
};

export default Verify;
