import {
  Field,
  method,
  Poseidon,
  PublicKey,
  SmartContract,
  State,
  state,
  Struct,
  MerkleWitness,
  DeployArgs,
  Signature,
  Permissions,
} from 'snarkyjs';

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


class MerkleWitness9 extends MerkleWitness(9) {}


export class Holler extends SmartContract {
  // @state(Field) num = State<Field>();
  @state(Field) proofTree = State<Field>();
  @state(Field) target = State<Field>();

  events = {
    proved: Field,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
  }

  @method
  init() {
    super.init();
    this.target.set(Field(
        '17057234437185175411792943285768571642343179330449434169483610110583519635705'
    ));
  }

  @method
  initState(commitment: Field, adminSignature: Signature) {
    adminSignature
        .verify(
            this.address,
            commitment.toFields(),
        )
        .assertTrue();
    this.proofTree.set(commitment);

  }

  @method addQueue(salt: Field, prompt: Prompt, leafWitness: MerkleWitness9) {
    // check leaf was empty
    leafWitness.calculateRoot(Field(0)).assertEquals(this.proofTree.get());

    this.target.assertEquals(this.target.get());
    Poseidon.hash([salt]).assertEquals(this.target.get());

    let commitment = this.proofTree.get();
    this.proofTree.assertEquals(commitment);

    // leafWitness.calculateRoot(Poseidon.hash([salt])).assertEquals(commitment);

    let newProofTree = leafWitness.calculateRoot(prompt.hashQueue());

    this.proofTree.set(newProofTree);
  }

  @method promptProof(prompt: Prompt, leafWitness: MerkleWitness9, adminSignature: Signature) {
    adminSignature
        .verify(
            this.address,
            prompt.toFields(),
        )
        .assertTrue();

    let commitment = this.proofTree.get();
    this.proofTree.assertEquals(commitment);

    leafWitness.calculateRoot(prompt.hashQueue()).assertEquals(commitment);

    let newProofTree = leafWitness.calculateRoot(prompt.hashComplete());

    this.proofTree.set(newProofTree);

    this.emitEvent('proved', newProofTree);
  }

  @method removeFromQueue(prompt: Prompt, leafWitness: MerkleWitness9, adminSignature: Signature) {
    adminSignature
        .verify(
            this.address,
            prompt.toFields(),
        )
        .assertTrue();

    let proofTree = this.proofTree.get();
    this.proofTree.assertEquals(proofTree);

    leafWitness.calculateRoot(prompt.hashQueue()).assertEquals(proofTree);

    let newProofTree = leafWitness.calculateRoot(Field(0));

    this.proofTree.set(newProofTree);
  }
}
