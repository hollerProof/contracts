import {Holler} from "./Holler.js";

import {MerkleTree, Mina, PrivateKey, shutdown, Signature} from 'snarkyjs';
import fs from 'fs/promises';

// check command line arg
let network = process.argv[2];
if (!network)
    throw Error(`Missing <network> argument.

 Usage:
 node build/src/interact.js <network>

 Example:
 node build/src/interact.js berkeley
 `);
Error.stackTraceLimit = 1000;

// parse config and private key from file
type Config = { networks: Record<string, { url: string; keyPath: string }> };
let configJson: Config = JSON.parse(await fs.readFile('config.json', 'utf8'));
let config = configJson.networks[network];
let key: { privateKey: string } = JSON.parse(
    await fs.readFile(config.keyPath, 'utf8')
);
let zkAppKey = PrivateKey.fromBase58(key.privateKey);

// set up Mina instance and contract we interact with
const Network = Mina.Network(config.url);
Mina.setActiveInstance(Network);
let zkAppAddress = zkAppKey.toPublicKey();
let zkApp = new Holler(zkAppAddress);

// compile the contract to create prover keys
console.log('compile the contract...');
let {verificationKey} = await Holler.compile();

// call update() and send transaction
console.log('build transaction and create proof...');
const tree = new MerkleTree(9);

const initSignature = Signature.create(
    zkAppKey,
    tree.getRoot().toFields()
);
let tx = await Mina.transaction({feePayerKey: zkAppKey, fee: 0.1e9}, () => {
    zkApp.deploy({zkappKey: zkAppKey, verificationKey: verificationKey})
    zkApp.init();
    zkApp.initState(tree.getRoot(), initSignature);
});
await tx.prove();
console.log('send transaction...');
let sentTx = await tx.send();

if (sentTx.hash() !== undefined) {
    console.log(`
 Success! Update transaction sent.

 Your smart contract state will be updated
 as soon as the transaction is included in a block:
 https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
 `);
}
shutdown();

