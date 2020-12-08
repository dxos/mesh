//
// Copyright 2020 DXOS.org
//

import assert from 'assert';

import { PublicKey } from '@dxos/crypto';

import { SwarmController, Topology } from './topology';

export class StarTopology implements Topology {
  private _controller?: SwarmController;

  private _intervalId?: NodeJS.Timeout;

  constructor(
    private readonly _centralPeer: PublicKey,
  ) {}

  init (controller: SwarmController): void {
    assert(!this._controller, 'Already initialized');
    this._controller = controller;

    this._intervalId = setInterval(() => {
      controller.lookup();
    }, 10_000);
  }

  update (): void {
    assert(this._controller, 'Not initialized');
    const { candidates, connected, ownPeerId } = this._controller.getState();
    if(!ownPeerId.equals(this._centralPeer)) {
      // Drop all connections other than central peer.
      for(const peer of connected) {
        if(!peer.equals(this._centralPeer)) {
          this._controller.disconnect(peer);
        }
      }
    }
    for (const peer of candidates) {
      // Connect to central peer.
      if(peer.equals(this._centralPeer)) {
        this._controller.connect(peer);
      }
    }
  }

  async onOffer (peer: PublicKey): Promise<boolean> {
    assert(this._controller, 'Not initialized');
    const { ownPeerId } = this._controller.getState();
    return ownPeerId.equals(this._centralPeer) || peer.equals(this._centralPeer);
  }

  async destroy (): Promise<void> {
    if (this._intervalId !== undefined) {
      clearInterval(this._intervalId);
    }
  }
}
