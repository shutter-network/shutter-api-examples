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

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown !== null && countdown > 0) {
            timer = setInterval(() => {
                setCountdown(prev => {
                    const newCount = prev !== null ? prev - 1 : null;
                    return newCount;
                });
            }, 1000);
        } else if (countdown === 0) {
            decryptMoves();
        }
        return () => {
            if (timer) {
                clearInterval(timer);
            }
        };
    }, [countdown]);

    const handleMoveChange = (player: Player, move: Move) => {
        setPlayers(prev => ({
            ...prev,
            [player]: { ...prev[player], move }
        }));
    };

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

            // Fetch encryption data from Shutter API
            console.log(`Fetching encryption data for decryption at timestamp ${decryptionTimestamp}...`);
            const shutterData = await fetchShutterData(decryptionTimestamp);

            // Extract the eon key and identity from the response
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
            
            // Check if both players have submitted after updating the state
            if (newState.player1.submitted && newState.player2.submitted) {
                console.log("Both players submitted, starting countdown");
                setCountdown(DECRYPTION_DELAY + 2);
            }
            
            return newState;
        });
    }

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

            // Decrypt both moves
            const decryptedMove1 = hexToString(await shutterDecrypt(players.player1.encryptedMove, decryptionKey)) as Move;
            const decryptedMove2 = hexToString(await shutterDecrypt(players.player2.encryptedMove, decryptionKey)) as Move;

            // Determine the winner
            const gameResult = determineWinner(decryptedMove1, decryptedMove2);
            setResult(gameResult);
        } catch (err) {
            setError("Failed to decrypt moves. Please try again.");
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

export default App;
