//
// Copyright 2020 DXOS.org
//

import assert from 'assert';
import debug from 'debug';
import { EventEmitter } from 'events';

import { keyToString, discoveryKey } from '@dxos/crypto';

const log = debug('dxos:network-manager');

/**
 * @typedef {Buffer} SwarmKey
 */

/**
 * Close a swarm safely: no exceptions thrown.
 * @param {Swarm} swarm
 * @param {Buffer} [key]
 */
const safeSwarmClose = async (swarm, key) => {
  try {
    const swarmId = keyToString(swarm.id);
    if (swarm.close) {
      await swarm.close();
      log(`Swarm: ${swarmId} closed`);
    } else if (swarm.leave && key) {
      log(`Swarm: ${swarmId} left ${keyToString(key)}`);
      await swarm.leave(discoveryKey(key));
    } else {
      log(`Swarm: ${swarmId} no close fn, skipping close`);
    }
  } catch (error) {
    log(error);
  }
};

/**
 * Higher level abstraction for interacting with: FeedStore, Replicator, Protocol object specialized for
 * feed replication with authentication, RPC-style p2p connections.
 */
// TODO(dboreham): We'd like to use only one swarm object but that's not currently possible due to limitations in
//  hypercore-protocol/@dxos/protocol (can't have one swarm joined with two swarm keys and different protocols per key).
export class NetworkManager extends EventEmitter {
  /** @type {FeedStore} */
  _feedStore;

  /** @type {SwarmProvider} */
  _swarmProvider;

  /** @type {Map<String, Swarm>} */
  _swarms = new Map();

  /**
   * @param {FeedStore} feedStore Configured FeedStore
   * @param {SwarmProvider} swarmProvider Supplies swarm objects
   */
  constructor (feedStore, swarmProvider) {
    super();

    assert(feedStore);
    assert(swarmProvider);
    this._feedStore = feedStore;
    this._swarmProvider = swarmProvider;
  }

  /**
   * Begin participating in a p2p network with other nodes advertising the same key, using a supplied protocol.
   *
   * @param {SwarmKey} key - Participation key: make connections with peers advertising the same key.
   *  In lower layers the hex string encoding of key is known as "topic".
   *  The discovery hash of key is known as "discovery key".
   * @param {ProtocolProvider} protocolProvider - Protocol factory object for peer connections associated with this key.
   * @return {function} - Call to stop participation in the swarm, release any resources allocated.
   * @throws {Error} TODO(dboreham): add details.
   */
  async joinProtocolSwarm (key, protocolProvider) {
    // Existing swarm for this key is a fatal error because we have no easy way to enforce uniqueness over
    // [key x protocol] tuples.
    const keyString = keyToString(key);
    if (this._swarms.get(keyString)) {
      throw new Error(`Already joined swarm: ${keyString}`);
    }

    // TODO(dboreham): Discuss alternatives to this pattern: Inject context known only here (FeedStore currently).
    // Create a new swarm for this key (shouldn't be necessary, see above for details).
    const swarm = await this._swarmProvider.createSwarm(protocolProvider, { feedStore: this._feedStore });
    this._swarms.set(keyString, swarm);

    swarm.on('connection', (conn, info) => {
      this.emit('connection', key, swarm, conn, info);
    });

    swarm.on('connection-closed', (conn, info) => {
      this.emit('connection-closed', key, swarm, conn, info);
    });

    // swarm.join() in combination with Protocol requires discoveryKey(realKey)
    swarm.join(discoveryKey(key));
    log(`Joined: ${keyString} using swarm: ${keyToString(swarm.id)}`);
    return async () => {
      await this.leaveProtocolSwarm(key);
    };
  }

  /**
   * Leave the designated swarm, clean up resources.
   * Safe to call on an already "left" swarm key.
   * @param {SwarmKey} key
   */
  async leaveProtocolSwarm (key) {
    const keyString = keyToString(key);
    const swarm = this._swarms.get(keyString);
    if (swarm) {
      log(`Leaving: ${keyString}`);
      await safeSwarmClose(swarm, key);
      this._swarms.delete(keyString);
    }
  }

  /**
   * Connect directly to a peer in the swarm bypassing the MMST
   * @param {Buffer} key
   * @param {Buffer} peerId
   * @returns {Promise<SimplePeer>}
   */
  async connecTo (key, peerId) {
    assert(Buffer.isBuffer(key));
    assert(Buffer.isBuffer(peerId));

    const keyString = keyToString(key);
    const swarm = this._swarms.get(keyString);
    if (!swarm) {
      throw new Error(`You need to be connected to the swarm: ${keyString}`);
    }

    return swarm.connect(key, peerId);
  }

  /**
   * Call to release resources and network sockets. Not subsequently usable.
   */
  async close () {
    log('Closing.');
    for await (const [key, swarm] of this._swarms.entries()) {
      await safeSwarmClose(swarm, key);
    }
    this._swarms.clear();
    log('Closed.');
  }
}
