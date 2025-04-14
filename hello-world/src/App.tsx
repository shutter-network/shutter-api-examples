import React, { useState } from 'react';
import { encryptData, decrypt } from "@shutter-network/shutter-sdk"
import { useEffect } from 'react';
import { stringToHex } from "viem";
import { DECRYPTION_DELAY, fetchShutterData } from './api';
import { ensureHexString, generateRandomBytes32 } from './utils';

function App() {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');

    async function encrypt(): Promise<string> {
        // Set decryption timestamp
        const decryptionTimestamp = Math.floor(Date.now() / 1000) + DECRYPTION_DELAY;

        // Fetch encryption data from Shutter API
        console.log(`Fetching encryption data for decryption at timestamp ${decryptionTimestamp}...`);
        const shutterData = await fetchShutterData(decryptionTimestamp);

        // Extract the eon key and identity from the response and ensure they have the correct format
        const eonKeyHex = ensureHexString(shutterData.eon_key);
        const identityHex = ensureHexString(shutterData.identity);

        // Message to encrypt
        const msgHex = stringToHex(input);

        // Generate a random sigma
        const sigmaHex = generateRandomBytes32();

        console.log("Eon Key:", eonKeyHex);
        console.log("Identity:", identityHex);
        console.log("Sigma:", sigmaHex);

        // Encrypt the message
        const encryptedCommitment = await encryptData(msgHex, identityHex, eonKeyHex, sigmaHex);

        return encryptedCommitment;
    }

    const decrypt = () => {
        // Replace this with your actual decryption logic
        try {
            const decrypted = atob(input); // simple Base64 decoding
            setOutput(`Decrypted: ${decrypted}`);
        } catch (e) {
            setOutput('Decryption failed: Invalid input');
        }
    };

    const getDataForEncryption = async (address: string) => {
        try {
            const url = `https://shutter.api.staging.shutter.network/api/get_data_for_encryption?address=${address}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            return data; // Returns the parsed JSON response
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error; // Re-throw for handling in the calling function
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter text"
                    style={{ padding: '8px', marginBottom: '10px' }}
                />
                <div>
                    <button onClick={encrypt} style={{ margin: '5px', padding: '8px' }}>Encrypt</button>
                    <button onClick={decrypt} style={{ margin: '5px', padding: '8px' }}>Decrypt</button>
                </div>
                <p>{output}</p>
            </header>
        </div>
    );
}

export default App;
