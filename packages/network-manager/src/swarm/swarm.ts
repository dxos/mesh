import { PublicKey } from "@dxos/crypto";
import { ComplexMap } from "@dxos/util";
import SimplePeerConstructor, { Instance as SimplePeer, SignalData } from 'simple-peer';
import { SignalApi } from '../signal/signal-api'
import assert from 'assert'
import wrtc from 'wrtc';

/**
 * A single peer's view of the swarm.
 * Manages a set of connections implemented by simple-peer instances.
 * Routes signal events and maintains swarm topology.
 */
export class Swarm {
  private readonly _connections = new ComplexMap<PublicKey, SimplePeer>(x => x.toHex());

  get connections() {
    return Array.from(this._connections.values())
  }

  constructor(
    private readonly _topic: PublicKey,
    private readonly _ownPeerId: PublicKey,
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
    const peer = this._connections.get(message.id);
    if(peer) {
      peer.signal(message.data);
    }
  }

  private _createConnection(initiator: boolean, remoteId: PublicKey, sessionId: PublicKey) {
    assert(!this._connections.has(remoteId), 'Peer already connected');
    const peer = new SimplePeerConstructor({
      initiator,
      wrtc: SimplePeerConstructor.WEBRTC_SUPPORT ? undefined : wrtc,
    })
    peer.on('signal', data => {
      this._sendSignal({
        id: this._ownPeerId,
        remoteId,
        sessionId,
        topic: this._topic,
        data,
      })
    })
    this._connections.set(remoteId, peer)
  }
}
