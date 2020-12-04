import { Event } from "@dxos/async";
import { PublicKey } from "@dxos/crypto";
import { SignalApi } from "./signal-api";
import assert from 'assert'

export class SignalManager {
  private readonly _servers = new Map<string, SignalApi>();

  constructor(
    private readonly _hosts: string[],
  ) {
    assert(_hosts.length === 1, 'Only a single signaling server connection is supported');
  }

  async connect() {
    await Promise.all(this._hosts.map(async host => {
      const server = new SignalApi(host, async (msg) => {  console.log('offer', msg); return {} as any }, async msg => { console.log('signal', msg) })
      this._servers.set(host, server);
      await server.connect();
    }))
  }

  join(topic: PublicKey, peerId: PublicKey) {
    for(const server of this._servers.values()) {
      server.join(topic, peerId).then(peers => {
        // TODO(marik-d): Deduplicate peers.
        this.candidatesChanged.emit([topic, peers]);
      })
    }
  }

  leave(topic: PublicKey, peerId: PublicKey) {
    for(const server of this._servers.values()) {
      server.leave(topic, peerId)
    }
  }

  lookup(topic: PublicKey) {
    for(const server of this._servers.values()) {
      server.lookup(topic).then(peers => {
        // TODO(marik-d): Deduplicate peers.
        this.candidatesChanged.emit([topic, peers]);
      })
    }
  }

  candidatesChanged = new Event<[topic: PublicKey, candidates: PublicKey[]]>()
}
