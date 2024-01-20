import { sampleScalar, sampleScalarPointPair } from "../math/sample";
import { ZkEncPrivate, ZkEncPublic, zkEncCreateProof } from "../zk/enc";
import { SignBroadcastForRound2, SignMessageForRound2 } from "./signRound2";
import { SignSession } from "./signSession";
import { SignPartyInputRound1, SignPartyOutputRound1 } from "./types";

export class SignerRound1 {
      public session: SignSession;
      private roundInput: SignPartyInputRound1;

      constructor(session: SignSession, roundInput: SignPartyInputRound1) {
            this.session = session;
            this.roundInput = roundInput;
      }

      public init({
            session,
            input,
      }: {
            session?: KeygenSession;
            input?: GenericKeygenRoundInput;
            sessionConfig?: SessionConfig;
      }): void {
            this.session = session;
            this.input = input;
      }

      public process(): SignPartyOutputRound1 {
            const [GammaShare, BigGammaShare] = sampleScalarPointPair();
            const { ciphertext: G, nonce: GNonce } =
                  this.roundInput.partiesPublic[this.session.selfId].paillier.encrypt(GammaShare);

            const KShare = sampleScalar();
            const { ciphertext: K, nonce: KNonce } =
                  this.roundInput.partiesPublic[this.session.selfId].paillier.encrypt(KShare);

            const broadcast = SignBroadcastForRound2.from({
                  from: this.session.selfId,
                  K,
                  G,
            });

            const messages: Array<SignMessageForRound2> = [];

            Object.entries(this.roundInput.partiesPublic).forEach(([partyId, partyPublic]) => {
                  // Go over other parties
                  if (partyId === this.session.selfId) {
                        return;
                  }

                  const zkPublic: ZkEncPublic = {
                        K,
                        prover: this.roundInput.partiesPublic[this.session.selfId].paillier,
                        aux: partyPublic.pedersen,
                  };
                  const zkPrivate: ZkEncPrivate = {
                        k: KShare,
                        rho: KNonce,
                  };
                  const proof = zkEncCreateProof(
                        zkPublic,
                        zkPrivate,
                        this.session.cloneHashForId(this.session.selfId)
                  );
                  const message = SignMessageForRound2.from({
                        from: this.session.selfId,
                        to: partyId,
                        proofEnc: proof,
                  });
                  messages.push(message);
            });

            this.session.currentRound = "round2";

            return {
                  broadcasts: [broadcast],
                  messages,
                  inputForRound2: {
                        inputForRound1: this.roundInput,
                        K,
                        G,
                        BigGammaShare,
                        GammaShare,
                        KShare,
                        KNonce,
                        GNonce,
                  },
            };
      }
}
