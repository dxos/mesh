import { PublicKey } from "@dxos/crypto";
import { Protocol } from "@dxos/protocol";
import { ComplexMap } from "@dxos/util";
import { expect } from "earljs";
import { SignalManager } from "./signal/signal-manager";
import { SwarmMapper } from "./swarm-mapper";
import { Connection } from "./swarm/connection";
import { Swarm } from "./swarm/swarm";
import { FullyConnectedTopology } from "./topology/fully-connected-topology";
import { Topology } from "./topology/topology";
import assert from 'assert';

export type ProtocolProvider = (opts: { channel: Buffer }) => Protocol;

export class NetworkManager {
  private readonly _swarms = new ComplexMap<PublicKey, Swarm>(x => x.toHex());

  private readonly _maps = new ComplexMap<PublicKey, SwarmMapper>(x => x.toHex());

  private readonly _signal: SignalManager;

  constructor(signal: string[]) {
    this._signal = new SignalManager(signal);
    this._signal.candidatesChanged.on(([topic, candidates]) => this._swarms.get(topic)?.onCandidatesChanged(candidates))
    this._signal.onOffer.on(msg => this._swarms.get(msg.topic)?.onOffer(msg))
    this._signal.onSignal.on(msg => this._swarms.get(msg.topic)?.onSignal(msg))
    this._signal.statusChanged.on(console.log);
    this._signal.commandTrace.on(console.log);
  }

  // TODO(marik-d): Remove.
  async start() {
    await this._signal.connect();
    
  }

  getSwarmMap(topic: PublicKey): SwarmMapper | undefined {
    return this._maps.get(topic);
  }

  joinProtocolSwarm(options: SwarmOptions)  {
    assert(typeof options === 'object', 'Incorrect arguments format.')
    const { topic, peerId, topology, protocol, presence } = options;
    assert(PublicKey.isPublicKey(topic), 'Incorrect arguments format.')
    assert(PublicKey.isPublicKey(peerId), 'Incorrect arguments format.')
    assert(topology, 'Incorrect arguments format.')
    assert(typeof protocol === 'function', 'Incorrect arguments format.')

    if(this._swarms.has(topic)) {
      throw new Error(`Already connected to swarm ${topic}`);
    }

    const swarm = new Swarm(topic, peerId, topology, protocol, async offer => this._signal.offer(offer), async msg => this._signal.signal(msg))
    this._swarms.set(topic, swarm);
    this._signal.join(topic, peerId);    
    this._maps.set(topic, new SwarmMapper(swarm, presence));
  }
}

export interface SwarmOptions {
  /**
   * Swarm topic.
   */
  topic: PublicKey,
  /**
   * This node's peer id.
   */
  peerId: PublicKey,

  /**
   * Requested topology. Must be a new instance for every swarm.
   */
  topology: Topology,

  /**
   * Protocol to use for every connection.
   */
  protocol: ProtocolProvider,

  /**
   * Presence plugin for network mapping, if exists.
   */
  presence?: any /* Presence */ 
}
