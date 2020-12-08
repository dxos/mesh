//
// Copyright 2020 DXOS.org
//

import assert from 'assert';
import distance from 'xor-distance'
import debug from 'debug';

import { PublicKey } from '@dxos/crypto';

import { SwarmController, Topology } from './topology';

const ORIGINATE_CONNECTIONS = 2;

const MAX_PEERS = 4;

const SAMPLE_SIZE = 10;

const LOOKUP_TIMEOUT = 1_000;

const log = console.log //debug('dxos:network-manager:topology:mmst-topology');

export class MMSTTopology implements Topology {
  private _controller?: SwarmController;

  private _lookupIntervalId?: NodeJS.Timeout;

  private _sampleTimeout?: NodeJS.Timeout;

  private _sampleCollected = false;

  init (controller: SwarmController): void {
    assert(!this._controller, 'Already initialized');
    this._controller = controller;

    this._lookupIntervalId = setTimeout(() => {
      controller.lookup();
    }, 10_000);

    // If required sample size is not reached after a certain timeout, run the algorithm on discovered peers.
    this._sampleTimeout = setTimeout(() => {
      log(`Running the algorithm after ${LOOKUP_TIMEOUT} ms timeout.`)
      this._sampleCollected = true;
      this._runAlgorithm();
    }, LOOKUP_TIMEOUT)
  }

  update (): void {
    assert(this._controller, 'Not initialized');
    if(this._sampleCollected) {
      // Re-run the algorithm if we already have already ran it before.
      log(`Re-running the algorithm on update.`)
      this._runAlgorithm();
    } else {
      const { connected, candidates } = this._controller.getState();
      // Run the algorithm if we have reached the required sample size.
      if(connected.length + candidates.length > SAMPLE_SIZE) {
      log(`Sample collected, running the algorithm.`)
        this._sampleCollected = true;
        this._runAlgorithm();
      }
    }
  }

  async onOffer (peer: PublicKey): Promise<boolean> {
    assert(this._controller, 'Not initialized');
    const { connected } = this._controller.getState();
    return connected.length < MAX_PEERS;
  }

  async destroy (): Promise<void> {
    if (this._lookupIntervalId !== undefined) {
      clearInterval(this._lookupIntervalId);
    }
    if(this._sampleTimeout !== undefined) {
      clearInterval(this._sampleTimeout);
    }
  }

  private _runAlgorithm() {
    assert(this._controller, 'Not initialized');
    const { connected, candidates, ownPeerId } = this._controller.getState();

    if(connected.length > MAX_PEERS) {
      // Disconnect extra peers.
      const sorted = sortByXorDistance(connected, ownPeerId).reverse().slice(0, MAX_PEERS - connected.length);
      for(const peer of sorted) {
        log(`Disconnect ${peer}.`)
        this._controller.disconnect(peer);
      }
    } else if(connected.length < ORIGINATE_CONNECTIONS) {
      // Connect new peers to reach desired quota.
      const sample = candidates.sort(() => Math.random() - 0.5).slice(0, SAMPLE_SIZE);
      const sorted = sortByXorDistance(sample, ownPeerId).slice(0, ORIGINATE_CONNECTIONS - connected.length);
      for(const peer of sorted) {
        log(`Connect ${peer}.`)
        this._controller.connect(peer);
      }
    }
  }
}

function sortByXorDistance(keys: PublicKey[], reference: PublicKey): PublicKey[] {
  return keys.sort((a, b) => distance.gt(distance(a.asBuffer(), reference.asBuffer()), distance(b.asBuffer(), reference.asBuffer())));
}
