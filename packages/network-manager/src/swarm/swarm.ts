import { PublicKey } from "@dxos/crypto";
import { ComplexMap } from "@dxos/util";
import { SignalApi } from '../signal/signal-api'
import assert from 'assert'
import { ProtocolProvider } from "../network-manager";
import { Connection } from "./connection";

/**
 * A single peer's view of the swarm.
 * Manages a set of connections implemented by simple-peer instances.
 * Routes signal events and maintains swarm topology.
 */
export class Swarm {
  private readonly _connections = new ComplexMap<PublicKey, Connection>(x => x.toHex());

  get connections() {
    return Array.from(this._connections.values())
  }

  constructor(
    private readonly _topic: PublicKey,
    private readonly _ownPeerId: PublicKey,
    private readonly _protocol: ProtocolProvider,
    private readonly _sendOffer: (message: SignalApi.SignalMessage) => Promise<void>,
    private readonly _sendSignal: (message: SignalApi.SignalMessage) => Promise<void>,
  ) {}

  onCandidatesChanged(candidates: PublicKey[]) {
    for(const candidate of candidates) {
      if(this._connections.has(candidate)) continue;

      // connect
      const sessionId = PublicKey.random()

      this._createConnection(true, candidate, sessionId);
      this._sendOffer({
        id: this._ownPeerId,
        remoteId: candidate,
        sessionId,
        topic: this._topic,
        data: {},
      })
    }  
  }

  async onOffer(message: SignalApi.SignalMessage): Promise<void> {
    assert(message.remoteId.equals(this._ownPeerId));
    assert(message.topic.equals(this._topic));
    this._createConnection(false, message.id, message.sessionId);
  }

  async onSignal(message: SignalApi.SignalMessage): Promise<void> {
    assert(message.remoteId.equals(this._ownPeerId));
    assert(message.topic.equals(this._topic));
    const connection = this._connections.get(message.id);
    if(connection) {
      connection.signal(message);
    }
  }

  private _createConnection(initiator: boolean, remoteId: PublicKey, sessionId: PublicKey) {
    assert(!this._connections.has(remoteId), 'Peer already connected');
    const connection = new Connection(
      initiator,
      this._protocol({ channel: remoteId.asBuffer() }),
      this._ownPeerId,
      remoteId,
      sessionId,
      this._topic,
      msg => this._sendSignal(msg),
    )
    this._connections.set(remoteId, connection)
  }
}
