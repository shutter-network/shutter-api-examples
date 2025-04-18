# Shutter Hello World Tutorial

This tutorial will guide you through creating a basic Shutter encryption/decryption application. We'll build it step by step, focusing on the core functionality.

## Prerequisites

- Setup a React application (Vite, Next.js, etc.)
- Basic understanding of React hooks and TypeScript

## Step 1: Setting Up Dependencies

First, install the required packages:

```bash
npm install @shutter-network/shutter-sdk viem
```

## Step 2: Creating the API Layer

Create a new file `src/api.ts` and copy all the contents to it. For a detailed documentation regarding shutter-api and shutter-sdk please visit thier respective docs at: [Shutter-Api](https://shutter-api.shutter.network/docs/index.html), [Shutter-SDK](https://github.com/shutter-network/shutter-sdk)

```typescript
// src/api.ts

// This constant defines how long we need to wait before the decryption key becomes available
export const DECRYPTION_DELAY = 120; // 2 minutes

/**
 * This function registers an identity for a given timestamp.
 * The timestamp should be in the future, indicating when the decryption keys should be released.
 * Once the identity is registered, the endpoint returns the eon key and identity,
 * which are used for encryption in the encrypt function inside src/App.tsx.
 */
export async function fetchShutterData(decryptionTimestamp: number): Promise<{
    eon_key: string;
    identity: string;
}>;

/**
 * Fetches the decryption key for a given identity retrieved from fetchShutterData.
 * This key becomes available only after the DECRYPTION_DELAY has passed (2 minutes).
 */
export async function fetchDecryptionKey(identity: string): Promise<{
    decryption_key: string;
}>;
```

### API Functions Explanation

1. **DECRYPTION_DELAY**
   - Purpose: Defines the time delay before decryption is possible
   - Value: 120 seconds (2 minutes)

2. **fetchShutterData**
   - Purpose: Registers identity and fetches encryption parameters from the Shutter API
   - Why we need it: Provides the necessary keys (eon_key and identity) for encryption
   - Parameters: 
     - `decryptionTimestamp`: When the message should be decryptable
   - Returns: Object containing eon_key and identity

3. **fetchDecryptionKey**
   - Purpose: Retrieves the decryption key for a message
   - Why we need it: Required to decrypt the message after the delay period
   - Parameters:
     - `identity`: The identity used during encryption
   - Returns: Object containing the decryption key

Note: You'll need to implement these functions to make actual API calls to your Shutter API endpoints.

## Step 3: Creating Utility Functions

Create a new file `src/utils.ts`:

```typescript
// src/utils.ts
export function ensureHexString(value: string): string {
    return value.startsWith('0x') ? value : `0x${value}`;
}

export function generateRandomBytes32(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}
```

## Step 4: Building the Main Component

Create your main component `src/App.tsx`. Let's build it step by step:

### Step 4.1: Setting Up State

```typescript
import React, { useState, useEffect } from 'react';
import { encryptData, decrypt as shutterDecrypt } from "@shutter-network/shutter-sdk"
import { hexToString, stringToHex } from "viem";
import { DECRYPTION_DELAY, fetchDecryptionKey, fetchShutterData } from './api';
import { ensureHexString, generateRandomBytes32 } from './utils';

function App() {
    // State management
    const [input, setInput] = useState('');
    const [encryptedMessage, setEncryptedMessage] = useState('');
    const [decryptedMessage, setDecryptedMessage] = useState('');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [encryptionTimestamp, setEncryptionTimestamp] = useState<number | null>(null);
    const [identity, setIdentity] = useState<string>('');
    const [error, setError] = useState<string>('');
```

### Step 4.2: Implementing the Countdown Timer

```typescript
    // Countdown timer effect
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
```

### Step 4.3: Implementing the Encrypt Function
The ```encrypt``` function works in a two step process, first it calculates the decryption timestamp(timestamp at which the decryption keys will be available). It then registers the identity for the decryption timestamp via ```fetchShutterData```. Data which gets returned from the function is then used to encrypt the data via ```encryptData``` function from shutter-sdk.

```typescript
    async function encrypt(): Promise<void> {
        setError(''); // Clear any previous errors
        
        // 1. Calculate decryption timestamp
        const decryptionTimestamp = Math.floor(Date.now() / 1000) + DECRYPTION_DELAY;
        setEncryptionTimestamp(decryptionTimestamp);
        setCountdown(DECRYPTION_DELAY);

        try {
            // 2. Fetch encryption data
            const shutterData = await fetchShutterData(decryptionTimestamp);

            // 3. Extract and format keys
            const eonKeyHex = ensureHexString(shutterData.eon_key);
            const identityHex = ensureHexString(shutterData.identity);
            setIdentity(identityHex);

            // 4. Prepare message and sigma
            const msgHex = stringToHex(input);
            const sigmaHex = generateRandomBytes32();

            // 5. Encrypt the message
            const encryptedCommitment = await encryptData(msgHex, identityHex, eonKeyHex, sigmaHex);
            setEncryptedMessage(encryptedCommitment);
        } catch (err) {
            setError("Encryption failed. Please try again.");
        }
    }
```

### Step 4.4: Implementing the Decryption Function
The ```decrypt``` function is simple. It utilizes the identity which was setup via ```encrypt``` function, checks if the decryption timestamp has passed. If the decryption timestamp has passed it queries for the decryption keys via ```fetchDecryptionKey``` for that identity. Once the decryption key is available you can utilize the ```shutterDecrypt``` function from the shutter-sdk to decrypt to the original message.
```typescript
    async function decrypt(): Promise<void> {
        setError('');
        
        // 1. Check if we have an identity
        if (!identity) {
            setError("No identity available. Please encrypt a message first.");
            return;
        }

        // 2. Check if enough time has passed
        const currentTime = Math.floor(Date.now() / 1000);
        if (!encryptionTimestamp || currentTime < encryptionTimestamp + 5) {
            setError("Please wait before decryption key is available");
            return;
        }

        try {
            // 3. Fetch decryption key
            const decryptionKeyData = await fetchDecryptionKey(identity);
            const decryptionKey = ensureHexString(decryptionKeyData.decryption_key);

            // 4. Decrypt the message
            const decryptedHexMessage = await shutterDecrypt(encryptedMessage, decryptionKey);
            setDecryptedMessage(hexToString(decryptedHexMessage as `0x${string}`));
        } catch (err) {
            setError("Failed to decrypt message. Please try again.");
        }
    }
```

### Step 4.5: Building the UI

```typescript
    return (
        <div className="App">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter text"
            />
            <div>
                <button onClick={encrypt}>Encrypt</button>
                <button onClick={decrypt}>Decrypt</button>
            </div>
            <div>
                {encryptedMessage && (
                    <p>Encrypted Message: {encryptedMessage}</p>
                )}
                {countdown !== null && countdown > 0 && (
                    <p>Decryption available in: {countdown} seconds</p>
                )}
                {error && (
                    <p style={{ color: 'red' }}>{error}</p>
                )}
                {decryptedMessage && (
                    <p>Decrypted Message: {decryptedMessage}</p>
                )}
            </div>
        </div>
    );
}
```

## Step 5: Testing the Application

1. Enter some text in the input field
2. Click "Encrypt"
   - You should see the encrypted message
   - A countdown timer should start
3. Wait for the countdown to finish
4. Click "Decrypt"
   - You should see the original message

## Common Issues and Solutions

1. **Decryption fails**
   - Make sure you're waiting for the full countdown period
   - Check that the identity is being properly stored
   - Verify the API endpoints are correct

2. **Encryption fails**
   - Check your API connection
   - Verify the input text is not empty
   - Ensure all hex strings are properly formatted

3. **Countdown not working**
   - Verify the DECRYPTION_DELAY constant is set correctly
   - Check the useEffect hook for the timer

## Important links
- [Shutter-api](https://github.com/shutter-network/shutter-api)
- [Shutter-sdk](https://github.com/shutter-network/shutter-sdk)
- [Shutter-api detailed docs](https://shutter-api.shutter.network/docs/index.html)

## Support
Feel free to open an issue on GitHub
