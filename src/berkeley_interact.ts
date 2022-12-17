import { Holler } from './Holler.js';
import {
    isReady,
    shutdown,
    Mina,
    PrivateKey,
    Signature,
    Poseidon,
    MerkleWitness,
    MerkleTree, Struct, PublicKey, Field, fetchAccount,
} from 'snarkyjs';
import fs from "fs/promises";

class MerkleWitness9 extends MerkleWitness(9) {}

class Prompt extends Struct({
    userPublicKey: PublicKey,
    promptHash: Field,
    status: Field
}) {
    hash(): Field {
        return Poseidon.hash([Poseidon.hash(this.userPublicKey.toFields()), this.promptHash, this.status]);
    }

    hashQueue(): Field {
        return Poseidon.hash([Poseidon.hash(this.userPublicKey.toFields()), this.promptHash, Field(0)]);
    }

    hashComplete(): Field {
        return Poseidon.hash([Poseidon.hash(this.userPublicKey.toFields()), this.promptHash, Field(1)]);
    }
    toFields(): Field[] {
        return this.userPublicKey.toFields().concat(this.promptHash, this.status);
    }
}

(async function main() {
    await isReady;

    console.log('SnarkyJS loaded');

    const proofsEnabled = true;
    const network = 'berkeley'

    // ----------------------------------------------------
    // parse config and private key from file
    type Config = { networks: Record<string, { url: string; keyPath: string }> };
    let configJson: Config = JSON.parse(await fs.readFile('config.json', 'utf8'));
    let config = configJson.networks[network];
    let key: { privateKey: string } = JSON.parse(
        await fs.readFile(config.keyPath, 'utf8')
    );
    let deployerAccount = PrivateKey.fromBase58(key.privateKey);

    // let deployerAccount = PrivateKey.fromBase58(
    //     'EKEPucRogGhAf6Lv73fJ72shxXkvyjuoHGpirCJNeFhkDv6djVHw'
    // );

    // ----------------------------------------------------
    // Set network
    const Network = Mina.Network(config.url);
    Mina.setActiveInstance(Network);

    // ----------------------------------------------------

    const zkAppPrivateKey = PrivateKey.fromBase58('EKEiXi7KhDCMTFtyBeAe6TfUnubDQcP8BUxrRLxXrec24ywp9Av7');
    console.log('zkAppPrivateKey', zkAppPrivateKey.toBase58().toString());
    const zkAppAddress = zkAppPrivateKey.toPublicKey();
    console.log('zkAppAddress', zkAppAddress.toBase58());

    console.log('compiling...');

    let verificationKey: any;
    if (proofsEnabled) {
        ({ verificationKey } = await Holler.compile());
    }

    console.log('compiled');


    // ----------------------------------------------------

    const contract = new Holler(zkAppAddress);

    // ----------------------------------------------------

    console.log('initializing...');
    const tree = new MerkleTree(9);
    const prompt1 = new Prompt({
        userPublicKey: zkAppAddress,
        promptHash: Poseidon.hash([Field(1), Field(2), Field(3)]),
        status: Field(0)
    });

    tree.setLeaf(
        BigInt(0),
        Field(0)
    );


    const initSignature = Signature.create(
        zkAppPrivateKey,
        tree.getRoot().toFields()
    );
    const rest = await fetchAccount({publicKey: zkAppAddress});
    console.log('rest', rest);
    // console.log(contract.proofTree.get());
    let init_txn = await Mina.transaction({feePayerKey: deployerAccount, fee:0.1e9}, () => {
        // AccountUpdate.fundNewAccount(deployerAccount);
        contract.initState(tree.getRoot(), initSignature);
    });

    if (!proofsEnabled) {
        await init_txn.prove();
    } else {
        await init_txn.prove();
        init_txn.sign([zkAppPrivateKey]);
    }
    let int_txn = await init_txn.send();

    if (int_txn.hash() !== undefined) {
        console.log(`
            Success! Update transaction sent.
            
            Your smart contract state will be updated
            as soon as the transaction is included in a block:
            https://berkeley.minaexplorer.com/transaction/${int_txn.hash()}
            `);
    }
    shutdown();


    // init_txn = await Mina.transaction({feePayerKey: deployerAccount, fee:0.1e9}, () => {
    //     contract.initState(tree.getRoot(), initSignature);
    // });

    // if (!proofsEnabled) {
    //     await init_txn.prove();
    // } else {
    //     init_txn.sign([zkAppPrivateKey]);
    // }
    // await init_txn.send();

    console.log('initialized');

    // ----------------------------------------------------

    console.log('adding...');

    // const mintAmount = UInt64.from(10);
    //
    // const queueSignature = Signature.create(
    //     zkAppPrivateKey,
    //     mintAmount.toFields().concat(zkAppAddress.toFields())
    // );
    const queueWitness = new MerkleWitness9(tree.getWitness(BigInt(0)));

    console.log('queueWitness', queueWitness);
    const queue_txn = await Mina.transaction({feePayerKey:deployerAccount, fee: 0.1e9}, () => {
        contract.addQueue(Field(22), prompt1, queueWitness);
    });
    console.log('txn created...');

    if (!proofsEnabled) {
        await queue_txn.prove();
    } else {
        await queue_txn.prove();
        queue_txn.sign([zkAppPrivateKey]);
    }
    console.log('txn signed...');

    await queue_txn.send();

    console.log('queued');

    console.log("Proof tree")
    console.log(
        contract.proofTree.get()
    );

    // ----------------------------------------------------

    console.log('adding again...');

    // const mintAmount = UInt64.from(10);
    //
    // const queueSignature = Signature.create(
    //     zkAppPrivateKey,
    //     mintAmount.toFields().concat(zkAppAddress.toFields())
    // );

    const prompt2 = new Prompt({
        userPublicKey: zkAppAddress,
        promptHash: Poseidon.hash([Field(1), Field(2), Field(3)]),
        status: Field(0)
    }
    );
    tree.setLeaf(BigInt(1), Field(prompt2.hashQueue()));
    // const newTree = new MerkleTree(tree);
    console.log('tree', tree);
    const queue2Witness = new MerkleWitness9(tree.getWitness(BigInt(1)));

    console.log('queueWitness', queueWitness);
    const queue_2_txn = await Mina.transaction({feePayerKey:deployerAccount, fee: 0.1e9}, () => {
        contract.addQueue(Field(22), prompt2, queue2Witness);
    });
    console.log('txn created...');

    if (!proofsEnabled) {
        await queue_2_txn.prove();
    } else {
        await queue_txn.prove();
        queue_2_txn.sign([zkAppPrivateKey]);
    }
    console.log('txn signed...');

    await queue_2_txn.send();

    console.log('queued');

    console.log("Proof tree")
    console.log(
        contract.proofTree.get()
    );

    // ----------------------------------------------------

    console.log('Proof...');
    prompt1.status = Field(1);
    const proofWitness = new MerkleWitness9(tree.getWitness(BigInt(0)));

    const proofSignature = Signature.create(
        zkAppPrivateKey,
        prompt1.toFields()
    );

    const proof_txn = await Mina.transaction({feePayerKey: deployerAccount, fee: 0.1e9}, () => {
        // AccountUpdate.fundNewAccount(deployerAccount);
        contract.promptProof(
            prompt1,
            proofWitness,
            proofSignature
        );
    });
    proof_txn.sign([zkAppPrivateKey]);
    if (!proofsEnabled) {
        await proof_txn.prove();
    } else {
        await proof_txn.prove();
        await proof_txn.sign([zkAppPrivateKey]);
    }
    await proof_txn.send();

    console.log('sent');

    console.log("Proof tree")
    console.log(
        contract.proofTree.get()
    );

    // ----------------------------------------------------

    console.log('Shutting down');

    await shutdown();
})().catch((f) => {
    console.log(f);
});