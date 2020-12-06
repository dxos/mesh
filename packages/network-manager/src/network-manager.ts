import { PublicKey } from "@dxos/crypto";
import { Protocol } from "@dxos/protocol";
import { ComplexMap } from "@dxos/util";
import { SignalManager } from "./signal/signal-manager";
import { Swarm } from "./swarm/swarm";

export type ProtocolProvider = (opts: { channel: Buffer }) => Protocol;

export class NetworkManager {
  private readonly _swarms = new ComplexMap<PublicKey, Swarm>(x => x.toHex());

  private readonly _signal: SignalManager;

  constructor(signal: string[]) {
    this._signal = new SignalManager(signal);
    this._signal.candidatesChanged.on(([topic, candidates]) => this._swarms.get(topic)?.onCandidatesChanged(candidates))
    this._signal.onOffer.on(msg => this._swarms.get(msg.topic)?.onOffer(msg))
    this._signal.onSignal.on(msg => this._swarms.get(msg.topic)?.onSignal(msg))
    this._signal.statusChanged.on(console.log);
  }

  // TODO(marik-d): Remove.
  async start() {
    await this._signal.connect();
    
  }

  joinProtocolSwarm(topic: PublicKey, peerId: PublicKey, protocol: ProtocolProvider, options: {})  {
    if(this._swarms.has(topic)) {
      throw new Error(`Already connected to swarm ${topic}`);
    }

    const swarm = new Swarm(topic, peerId, protocol, async offer => this._signal.offer(offer), async msg => this._signal.signal(msg))
    this._swarms.set(topic, swarm);
    this._signal.join(topic, peerId);
  }
}
