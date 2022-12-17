import { Holler } from './Holler.js';
import {
    isReady,
    shutdown,
    Mina,
    PrivateKey,
    AccountUpdate,
    Signature,
    Poseidon,
    MerkleWitness,
    MerkleTree, Struct, PublicKey, Field,
} from 'snarkyjs';

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

    const proofsEnabled = false;
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    const deployerAccount = Local.testAccounts[0].privateKey;

    // ----------------------------------------------------

    const zkAppPrivateKey = PrivateKey.random();
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

    console.log('deploying...');

    const contract = new Holler(zkAppAddress);
    // const deploy_txn = await Mina.transaction({feePayerKey: deployerAccount, fee: 0.1e9}, () => {
    //     // AccountUpdate.fundNewAccount(deployerAccount);
    //     if (!proofsEnabled) {
    //         contract.deploy({ zkappKey: zkAppPrivateKey });
    //     } else {
    //         contract.deploy({ verificationKey, zkappKey: zkAppPrivateKey });
    //     }
    // });
    // await deploy_txn.prove();
    // deploy_txn.sign([zkAppPrivateKey]);
    // await deploy_txn.send();

    const deploy_txn = await Mina.transaction({feePayerKey: deployerAccount, fee: 0.1e9}, () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        if (!proofsEnabled) {
            contract.deploy({ zkappKey: zkAppPrivateKey });
        } else {
            contract.deploy({ verificationKey, zkappKey: zkAppPrivateKey });
        }
    });
    await deploy_txn.prove();
    deploy_txn.sign([zkAppPrivateKey]);
    await deploy_txn.send();

    console.log('deployed');

    // ----------------------------------------------------

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


    // ----------------------------------------------------

    console.log('initializing...');
    const initSignature = Signature.create(
        zkAppPrivateKey,
        tree.getRoot().toFields()
    );
    // const rest = await fetchAccount({publicKey: zkAppAddress});
    // console.log('rest', rest);
    console.log(contract.proofTree.get());
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
    await init_txn.send();


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
    tree.setLeaf(BigInt(0), prompt1.hashQueue());
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
    tree.setLeaf(BigInt(1), prompt2.hashQueue());
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