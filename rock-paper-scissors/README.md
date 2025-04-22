# Shutter Rock Paper Scissors Tutorial

This tutorial will guide you through creating a Rock Paper Scissors game using Shutter's encryption/decryption functionality. The game ensures fair play by keeping both players' moves secret until the decryption key is available.

## Prerequisites

- Setup a React application (create-react-app, Next.js, Vite, etc.)
- Basic understanding of React hooks and TypeScript

## Step 1: Setting Up Dependencies

First, install the required packages:

```bash
npm install @shutter-network/shutter-sdk viem
```

## Step 2: Creating the API Layer

Create a new file `src/api.ts` and copy all the contents to it. For a detailed documentation regarding shutter-api and shutter-sdk please visit their respective docs at: [Shutter-Api](https://shutter-api.shutter.network/docs/index.html), [Shutter-SDK](https://github.com/shutter-network/shutter-sdk)

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
   - Why we need it: Provides the necessary keys (eon_key and identity) for encrypting player moves
   - Parameters: 
     - `decryptionTimestamp`: When the moves should be decryptable
   - Returns: Object containing eon_key and identity

3. **fetchDecryptionKey**
   - Purpose: Retrieves the decryption key for the moves
   - Why we need it: Required to decrypt the moves after the delay period
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

### Step 4.1: Setting Up State and Types

```typescript
import React, { useState, useEffect } from 'react';
import { encryptData, decrypt as shutterDecrypt } from "@shutter-network/shutter-sdk"
import { hexToString, stringToHex } from "viem";
import { DECRYPTION_DELAY, fetchDecryptionKey, fetchShutterData } from './api';
import { ensureHexString, generateRandomBytes32 } from './utils';

type Move = 'rock' | 'paper' | 'scissors';
type Player = 'player1' | 'player2';

interface PlayerState {
    move: Move | '';
    encryptedMove: string;
    submitted: boolean;
}

function App() {
    // State management
    const [players, setPlayers] = useState<Record<Player, PlayerState>>({
        player1: { move: '', encryptedMove: '', submitted: false },
        player2: { move: '', encryptedMove: '', submitted: false }
    });
    const [countdown, setCountdown] = useState<number | null>(null);
    const [encryptionTimestamp, setEncryptionTimestamp] = useState<number | null>(null);
    const [identity, setIdentity] = useState<`0x${string}`>('0x');
    const [eonKey, setEonKey] = useState<`0x${string}`>('0x');
    const [error, setError] = useState<string>('');
    const [result, setResult] = useState<string>('');
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
        } else if (countdown === 0) {
            decryptMoves();
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [countdown]);
```

### Step 4.3: Implementing the Move Submission Function
```typescript
    async function submitMove(player: Player): Promise<void> {
        setError('');
        if (!players[player].move) {
            setError(`Please select a move for ${player}`);
            return;
        }

        let identityHexHolder = identity;
        let eonKeyHexHolder = eonKey;

        // Set decryption timestamp only for the first submission
        if (!encryptionTimestamp) {
            const decryptionTimestamp = Math.floor(Date.now() / 1000) + DECRYPTION_DELAY;
            setEncryptionTimestamp(decryptionTimestamp);

            const shutterData = await fetchShutterData(decryptionTimestamp);
            const identityHex = ensureHexString(shutterData.identity) as `0x${string}`;
            setIdentity(identityHex);
            identityHexHolder = identityHex;
            const eonKeyHex = ensureHexString(shutterData.eon_key) as `0x${string}`;
            setEonKey(eonKeyHex);
            eonKeyHexHolder = eonKeyHex;
        }

        // Encrypt the move
        const msgHex = stringToHex(players[player].move);
        const sigmaHex = generateRandomBytes32();
        const encryptedMove = await encryptData(msgHex, identityHexHolder, eonKeyHexHolder, sigmaHex);

        setPlayers(prev => {
            const newState = {
                ...prev,
                [player]: {
                    ...prev[player],
                    encryptedMove,
                    submitted: true
                }
            };
            
            if (newState.player1.submitted && newState.player2.submitted) {
                setCountdown(DECRYPTION_DELAY + 2);
            }
            
            return newState;
        });
    }
```

### Step 4.4: Implementing the Decryption and Game Logic
```typescript
    const determineWinner = (move1: Move, move2: Move): string => {
        if (move1 === move2) return "It's a tie!";
        
        const winningCombinations = {
            rock: 'scissors',
            paper: 'rock',
            scissors: 'paper'
        };

        if (winningCombinations[move1] === move2) {
            return "Player 1 wins!";
        } else {
            return "Player 2 wins!";
        }
    };

    async function decryptMoves(): Promise<void> {
        if (!identity) {
            setError("No identity available. Please try submitting moves again.");
            return;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (!encryptionTimestamp || currentTime < encryptionTimestamp + 5) {
            setError(`Please wait before decryption key is available`);
            return;
        }

        try {
            const decryptionKeyData = await fetchDecryptionKey(identity);
            const decryptionKey = ensureHexString(decryptionKeyData.decryption_key);

            const decryptedMove1 = hexToString(await shutterDecrypt(players.player1.encryptedMove, decryptionKey)) as Move;
            const decryptedMove2 = hexToString(await shutterDecrypt(players.player2.encryptedMove, decryptionKey)) as Move;

            const gameResult = determineWinner(decryptedMove1, decryptedMove2);
            setResult(gameResult);
        } catch (err) {
            setError("Failed to decrypt moves. Please try again.");
        }
    }
```

### Step 4.5: Building the UI
```typescript
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
                maxWidth: '800px',
                width: '100%'
            }}>
                <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '20px',
                    marginBottom: '20px'
                }}>
                    {/* Player 1 */}
                    <div style={{ flex: 1 }}>
                        <h2>Player 1</h2>
                        <select
                            value={players.player1.move}
                            onChange={(e) => handleMoveChange('player1', e.target.value as Move)}
                            style={{ 
                                padding: '12px',
                                marginBottom: '10px',
                                width: '100%',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '16px'
                            }}
                        >
                            <option value="">Select Move</option>
                            <option value="rock">Rock</option>
                            <option value="paper">Paper</option>
                            <option value="scissors">Scissors</option>
                        </select>
                        <button 
                            onClick={() => submitMove('player1')}
                            disabled={players.player1.submitted}
                            style={{ 
                                padding: '12px 24px',
                                backgroundColor: players.player1.submitted ? '#ccc' : '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: players.player1.submitted ? 'not-allowed' : 'pointer',
                                fontSize: '16px',
                                width: '100%'
                            }}
                        >
                            {players.player1.submitted ? 'Submitted' : 'Submit Move'}
                        </button>
                    </div>

                    {/* Player 2 */}
                    <div style={{ flex: 1 }}>
                        <h2>Player 2</h2>
                        <select
                            value={players.player2.move}
                            onChange={(e) => handleMoveChange('player2', e.target.value as Move)}
                            style={{ 
                                padding: '12px',
                                marginBottom: '10px',
                                width: '100%',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '16px'
                            }}
                        >
                            <option value="">Select Move</option>
                            <option value="rock">Rock</option>
                            <option value="paper">Paper</option>
                            <option value="scissors">Scissors</option>
                        </select>
                        <button 
                            onClick={() => submitMove('player2')}
                            disabled={players.player2.submitted}
                            style={{ 
                                padding: '12px 24px',
                                backgroundColor: players.player2.submitted ? '#ccc' : '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: players.player2.submitted ? 'not-allowed' : 'pointer',
                                fontSize: '16px',
                                width: '100%'
                            }}
                        >
                            {players.player2.submitted ? 'Submitted' : 'Submit Move'}
                        </button>
                    </div>
                </div>

                <div style={{ 
                    textAlign: 'center',
                    wordBreak: 'break-word'
                }}>
                    {players.player1.submitted && players.player2.submitted && countdown !== null && (
                        <div style={{ 
                            marginBottom: '20px',
                            padding: '15px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid #dee2e6'
                        }}>
                            <p style={{ 
                                color: '#666',
                                fontSize: '18px',
                                margin: '0'
                            }}>
                                {countdown > 0 ? (
                                    <>Decryption available in: <strong>{countdown}</strong> seconds</>
                                ) : (
                                    "Decrypting moves..."
                                )}
                            </p>
                        </div>
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
                    {result && (
                        <p style={{ 
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: '#4CAF50',
                            marginTop: '20px'
                        }}>
                            {result}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
```

## Step 5: Testing the Application

1. Player 1 selects their move and clicks "Submit Move"
2. Player 2 selects their move and clicks "Submit Move"
   - The countdown timer should start
   - Both players' buttons should be disabled
3. Wait for the countdown to finish
4. The game result will be automatically displayed

## Common Issues and Solutions

1. **Decryption fails**
   - Make sure both players have submitted their moves
   - Check that the identity is being properly stored
   - Verify the API endpoints are correct

2. **Countdown not starting**
   - Verify both players have submitted their moves
   - Check the DECRYPTION_DELAY constant is set correctly
   - Ensure the state updates are working correctly

3. **Move submission issues**
   - Verify the move selection is valid
   - Check that the encryption process is working
   - Ensure the state is being updated properly

## Important links
- [Shutter-api](https://github.com/shutter-network/shutter-api)
- [Shutter-sdk](https://github.com/shutter-network/shutter-sdk)
- [Shutter-api detailed docs](https://shutter-api.shutter.network/docs/index.html)

## Support
Feel free to open an issue on GitHub