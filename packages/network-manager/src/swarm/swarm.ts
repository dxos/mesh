import { discoveryKey, PublicKey } from "@dxos/crypto";
import { ComplexMap } from "@dxos/util";
import { SignalApi } from '../signal/signal-api'
import assert from 'assert'
import { ProtocolProvider } from "../network-manager";
import { Connection } from "./connection";
import debug from 'debug';
import { SignalData } from "simple-peer";
import { Event } from "@dxos/async";

const log = debug('dxos:network-manager:swarm');

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

  readonly connected = new Event<PublicKey>();

  constructor(
    private readonly _topic: PublicKey,
    private readonly _ownPeerId: PublicKey,
    private readonly _protocol: ProtocolProvider,
    private readonly _sendOffer: (message: SignalApi.SignalMessage) => Promise<void>,
    private readonly _sendSignal: (message: SignalApi.SignalMessage) => Promise<void>,
  ) {}

  onCandidatesChanged(candidates: PublicKey[]) {
    for(const candidate of candidates) {
      if(candidate.equals(this._ownPeerId)) continue;
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

    if(this._connections.has(message.id)) {
      if(message.id.toHex() < message.remoteId.toHex()) {
        this._closeConnection(message.id).catch(err => {
          console.error(err);
          // TODO(marik-d): Error handling.
        });
      } else {
        return;
      }
    }

    this._createConnection(false, message.id, message.sessionId);
  }

  async onSignal(message: SignalApi.SignalMessage): Promise<void> {
    assert(message.remoteId.equals(this._ownPeerId));
    assert(message.topic.equals(this._topic));
    const connection = this._connections.get(message.id);
    if(!connection) {
      log(`Dropping signal message for non-existent connection: topic=${this._topic}, peerId=${message.id}`);
      return;
    }
    connection.signal(message);
  }

  private _createConnection(initiator: boolean, remoteId: PublicKey, sessionId: PublicKey) {
    assert(!this._connections.has(remoteId), 'Peer already connected');
    let signals: SignalData[]
    const connection = new Connection(
      initiator,
      this._protocol({ channel: discoveryKey(this._topic) }),
      this._ownPeerId,
      remoteId,
      sessionId,
      this._topic,
      msg => this._sendSignal(msg),
    )
    this._connections.set(remoteId, connection)
    Event.wrap(connection.peer, 'connect').once(() => this.connected.emit(remoteId));
    return connection;
  }

  private async _closeConnection(peerId: PublicKey) {
    const connection = this._connections.get(peerId);
    assert(connection);
    this._connections.delete(peerId);
    await connection.close();
  }
}
