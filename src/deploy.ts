/**
 * This is an example for interacting with the Berkeley QANet, directly from snarkyjs.
 *
 * At a high level, it does the following:
 * -) try fetching the account corresponding to the `zkappAddress` from chain
 * -) if the account doesn't exist or is not a zkapp account yet, deploy a zkapp to it and initialize on-chain state
 * -) if the zkapp is already deployed, send a state-updating transaction which proves execution of the "update" method
 */

import {fetchAccount, isReady, MerkleTree, Mina, PrivateKey, shutdown, Signature,} from 'snarkyjs';
import {Holler} from "./Holler.js";

await isReady;

// you can use this with any spec-compliant graphql endpoint
let Berkeley = Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql');
Mina.setActiveInstance(Berkeley);

// to use this test, change this private key to an account which has enough MINA to pay fees
let feePayerKey = PrivateKey.fromBase58(
    'EKEQc95PPQZnMY9d9p1vq1MWLeDJKtvKj4V75UDG3rjnf32BerWD'
);
let feePayerAddress = feePayerKey.toPublicKey();
let response = await fetchAccount({publicKey: feePayerAddress});
if (response.error) throw Error(response.error.statusText);
let {nonce, balance} = response.account;
console.log(`Using fee payer account with nonce ${nonce}, balance ${balance}`);

// this used to be an actual zkapp that was deployed and updated with this script:
// https://berkeley.minaexplorer.com/wallet/B62qpRzFVjd56FiHnNfxokVbcHMQLT119My1FEdSq8ss7KomLiSZcan
// replace this with a new zkapp key if you want to deploy another zkapp
// and please never expose actual private keys in public code repositories like this!
let zkappKey = PrivateKey.fromBase58(
    'EKFQZG2RuLMYyDsC9RGE5Y8gQGefkbUUUyEhFbgRRMHGgoF9eKpY'
);
let zkappAddress = zkappKey.toPublicKey();


const proofsEnabled = false;
// const Local = Mina.LocalBlockchain({ proofsEnabled });
// Mina.setActiveInstance(Local);
// const deployerAccount = Local.testAccounts[0].privateKey;

// ----------------------------------------------------

// const zkAppPrivateKey = PrivateKey.random();
// console.log('zkAppPrivateKey', zkAppPrivateKey.toBase58().toString());
// const zkAppAddress = zkAppPrivateKey.toPublicKey();
// console.log('zkAppAddress', zkAppAddress.toBase58());

console.log('compiling...');

// let verificationKey: any;
// if (proofsEnabled) {
//     ({ verificationKey } = await Holler.compile());
// }

console.log('compiled');

// compile the SmartContract to get the verification key (if deploying) or cache the provers (if updating)
// this can take a while...
console.log('Compiling smart contract...');
let {verificationKey} = await Holler.compile();

// check if the zkapp is already deployed, based on whether the account exists and its first zkapp state is != 0
let zkapp = new Holler(zkappAddress);
let isDeployed = false;

// if the zkapp is not deployed yet, create a deploy transaction
if (!isDeployed) {
    console.log(`Deploying zkapp for public key ${zkappAddress.toBase58()}.`);
    // the `transaction()` interface is the same as when testing with a local blockchain
    const deploy_txn = await Mina.transaction(zkappKey, () => {
        // AccountUpdate.fundNewAccount(deployerAccount);
        if (!proofsEnabled) {
            zkapp.deploy({zkappKey: zkappKey});
        } else {
            zkapp.deploy({verificationKey, zkappKey: zkappKey});
        }
    });
    await deploy_txn.prove();
    deploy_txn.sign([zkappKey]);
    await deploy_txn.send();

    // ----------------------------------------------------

    console.log('initializing...');
    let init_txn = await Mina.transaction(zkappKey, () => {
        zkapp.init();
    });

    if (!proofsEnabled) {
        await init_txn.prove();
    } else {
        await init_txn.prove();
        init_txn.sign([zkappKey]);
    }
    await init_txn.send();

    const tree = new MerkleTree(9);

    const initSignature = Signature.create(
        zkappKey,
        tree.getRoot().toFields()
    );
    init_txn = await Mina.transaction(zkappKey, () => {
        zkapp.initState(tree.getRoot(), initSignature);
    });

    if (!proofsEnabled) {
        await init_txn.prove();
    } else {
        init_txn.sign([zkappKey]);
    }
    await init_txn.send();

    console.log('initialized');


}

// if the zkapp is not deployed yet, create an update transaction
if (isDeployed) {
    // let x = zkapp.x.get();
    // console.log(`Found deployed zkapp, updating state ${x} -> ${x.add(10)}.`);
    // let transaction = await Mina.transaction(
    //     {feePayerKey: feePayerKey, fee: transactionFee},
    //     () => {
    //         zkapp.update(Field(10));
    //     }
    // );
    // fill in the proof - this can take a while...
    console.log('Creating an execution proof...');
    // await transaction.prove();
    //
    // // if you want to inspect the transaction, you can print it out:
    // // console.log(transaction.toGraphqlQuery());
    //
    // // send the transaction to the graphql endpoint
    // console.log('Sending the transaction...');
    // await transaction.sign([feePayerKey]).send();
}

shutdown();