import React, { useState, useEffect } from 'react';
import { encryptData, decrypt as shutterDecrypt } from "@shutter-network/shutter-sdk"
import { hexToString, stringToHex } from "viem";
import { DECRYPTION_DELAY, fetchDecryptionKey, fetchShutterData } from './api';
import { ensureHexString, generateRandomBytes32 } from './utils';

function App() {
    const [input, setInput] = useState('');
    const [encryptedMessage, setEncryptedMessage] = useState('');
    const [decryptedMessage, setDecryptedMessage] = useState('');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [decryptionTimestamp, setDecryptionTimestamp] = useState<number | null>(null);
    const [identity, setIdentity] = useState<string>('');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown !== null && countdown > 0) {
            timer = setInterval(() => {
                setCountdown(prev => prev !== null ? prev - 1 : null);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [countdown]);

    async function encrypt(): Promise<void> {
        setError(''); // Clear any previous errors
        // Set decryption timestamp
        const decryptionTimestamp = Math.floor(Date.now() / 1000) + DECRYPTION_DELAY;
        setDecryptionTimestamp(decryptionTimestamp);
        setCountdown(DECRYPTION_DELAY + 2);

        // Fetch encryption data from Shutter API
        console.log(`Fetching encryption data for decryption at timestamp ${decryptionTimestamp}...`);
        const shutterData = await fetchShutterData(decryptionTimestamp);

        // Extract the eon key and identity from the response and ensure they have the correct format
        const eonKeyHex = ensureHexString(shutterData.eon_key);
        const identityHex = ensureHexString(shutterData.identity);
        setIdentity(identityHex);

        // Message to encrypt
        const msgHex = stringToHex(input);

        // Generate a random sigma
        const sigmaHex = generateRandomBytes32();

        console.log("Eon Key:", eonKeyHex);
        console.log("Identity:", identityHex);
        console.log("Sigma:", sigmaHex);

        // Encrypt the message
        const encryptedCommitment = await encryptData(msgHex, identityHex, eonKeyHex, sigmaHex);
        setEncryptedMessage(encryptedCommitment);
    }

    async function decrypt(): Promise<void> {
        setError('');
        if (!identity) {
            setError("No identity available. Please encrypt a message first.");
            return;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (!decryptionTimestamp || currentTime < decryptionTimestamp + 5) {
            setError(`Please wait before decryption key is available`);
            return;
        }

        try {
            // Fetch the decryption key
            const decryptionKeyData = await fetchDecryptionKey(identity);
            console.log("Decryption key:", decryptionKeyData.decryption_key);

            // Ensure the decryption key is properly formatted
            const decryptionKey = ensureHexString(decryptionKeyData.decryption_key);

            // Decrypt the message
            const decryptedHexMessage = await shutterDecrypt(encryptedMessage, decryptionKey);

            // Convert the decrypted hex message back to a string
            setDecryptedMessage(hexToString(decryptedHexMessage as `0x${string}`));
        } catch (err) {
            setError("Failed to decrypt message. Please try again.");
        }
    }

    return (
        <div className="App" style={{ 
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5'
        }}>
            <div style={{
                padding: '2rem',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                maxWidth: '600px',
                width: '100%'
            }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter text"
                    style={{ 
                        padding: '12px',
                        marginBottom: '20px',
                        width: '100%',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        fontSize: '16px'
                    }}
                />
                <div style={{ 
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '10px',
                    marginBottom: '20px'
                }}>
                    <button 
                        onClick={encrypt} 
                        style={{ 
                            padding: '12px 24px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Encrypt
                    </button>
                    <button 
                        onClick={decrypt} 
                        style={{ 
                            padding: '12px 24px',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        Decrypt
                    </button>
                </div>
                <div style={{ 
                    textAlign: 'center',
                    wordBreak: 'break-word'
                }}>
                    {encryptedMessage && (
                        <p style={{ marginBottom: '10px' }}>
                            <strong>Encrypted Message:</strong> {encryptedMessage}
                        </p>
                    )}
                    {countdown !== null && countdown > 0 && (
                        <p style={{ 
                            color: '#666',
                            marginBottom: '10px'
                        }}>
                            Decryption available in: {countdown} seconds
                        </p>
                    )}
                    {error && (
                        <p style={{ 
                            color: 'red', 
                            marginBottom: '10px',
                            fontWeight: 'bold'
                        }}>
                            {error}
                        </p>
                    )}
                    {decryptedMessage && (
                        <p style={{ marginBottom: '10px' }}>
                            <strong>Decrypted Message:</strong> {decryptedMessage}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
