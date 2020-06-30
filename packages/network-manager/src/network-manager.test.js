//
// Copyright 2020 Wireline, Inc.
//

// TODO(dboreham): Remaining design issues with this module:
//  The object model seems not quite right (plugin is really the protocol, owns
//  functions that don't seem related to protocol such as new connection events).
//  peerId leaks out everywhere but Protocol pretends it doesn't exist.

import debug from 'debug';
import ram from 'random-access-memory';

import { createId, keyToBuffer, keyToString } from '@dxos/crypto';
import { FeedStore } from '@dxos/feed-store';

import { NetworkManager } from './network-manager';
import { SwarmProvider } from './swarm-provider';

import { testProtocolProvider, TestProtocolPlugin, getPeerId } from './testing/test-protocol';

const log = debug('dxos:network-manager:test');

// TODO(dboreham): Must be some reason this doesn't exist?
const createKey = () => {
  return keyToBuffer(createId());
};

/**
 * Compare expected and actual values, call doneFn with diagnostic string argument if not equal.
 * @param {comparable} actualValue
 * @param {comparable} expectedValue
 * @param {function(|string)} doneFn - called with param undefined on success, diagnostic string on failure.
 */
const expectEqualsDone = (actualValue, expectedValue, doneFn) => {
  if (actualValue === expectedValue) {
    doneFn();
  } else {
    doneFn(`Expected: ${expectedValue}, received: ${actualValue}`);
  }
};

/**
 * Compare expected and actual values, call resolve if equal, reject with diagnostic string if not.
 * @param {comparable} actualValue
 * @param {comparable} expectedValue
 */
const expectEqualsPromise = (actualValue, expectedValue, resolve, reject) => {
  if (actualValue === expectedValue) {
    resolve();
  } else {
    reject(`Expected: ${expectedValue}, received: ${actualValue}`);
  }
};

test('Create a NetworkManager', async () => {
  const feedStore = await FeedStore.create(ram);
  const swarmProvider = new SwarmProvider();
  const networkManager = new NetworkManager(feedStore, swarmProvider);
  expect(networkManager).toBeTruthy();
  log('Created NetworkManager');
  await networkManager.close();
  log('Closed NetworkManager');
});

test('One protocol and one swarm key', async (done) => {
  const swarmKey = createKey();
  const fnOnConnection = jest.fn();

  const makeNode = async (swarmKey) => {
    const nodeId = createKey();
    const feedStore = await FeedStore.create(ram);
    const swarmProvider = new SwarmProvider();
    const networkManager = new NetworkManager(feedStore, swarmProvider);
    const protocol = new TestProtocolPlugin(nodeId);
    const protocolProvider = testProtocolProvider(swarmKey, nodeId, protocol);
    return { nodeId, networkManager, protocol, protocolProvider };
  };

  // Create 2 test "nodes", each node has a FeedStore, a SwarmProvider,
  // a NetworkManager, a TestProtocolPlugin, a ProtocolProvider.
  // Test that the nodes when joined with a swarm key communicate via the intended protocol.

  const node1 = await makeNode(swarmKey);
  node1.networkManager.once('connection', fnOnConnection);
  const node2 = await makeNode(swarmKey);

  await node1.networkManager.joinProtocolSwarm(swarmKey, node1.protocolProvider);
  await node2.networkManager.joinProtocolSwarm(swarmKey, node2.protocolProvider);

  node2.protocol.on('receive', (protocol, message) => {
    log('Message', message);
    expect(fnOnConnection).toHaveBeenCalled();
    expectEqualsDone(message, 'Node 1', done);
  });

  node1.protocol.on('connect', async (protocol) => {
    log('Connected:', keyToString(getPeerId(protocol)));
    if (getPeerId(protocol).equals(node2.nodeId)) {
      await node1.protocol.send(node2.nodeId, 'Node 1');
    }
  });
});

test('Two protocols and two swarm keys', async (done) => {
  const swarmKeyA = createKey();
  const swarmKeyB = createKey();

  const makeNode = async (swarmKey, uppercase) => {
    const nodeId = createKey();
    const feedStore = await FeedStore.create(ram);
    const swarmProvider = new SwarmProvider();
    const networkManager = new NetworkManager(feedStore, swarmProvider);
    const protocol = new TestProtocolPlugin(nodeId, uppercase);
    const protocolProvider = testProtocolProvider(swarmKey, nodeId, protocol);
    return { nodeId, networkManager, protocol, protocolProvider };
  };

  const logOnConnect = (protocol) => {
    log('Connected:', keyToString(getPeerId(protocol)));
  };

  const hasExpectedPeer = (protocol, nodeId) => {
    return getPeerId(protocol).equals(nodeId);
  };

  // Create 2 test "nodes", each node has a FeedStore, a SwarmProvider,
  // a NetworkManager, a TestProtocolPlugin, a ProtocolProvider.
  // Create a second set of test nodes using a different Protocol.
  // Each set of 2 nodes connects using different Protocols and 2 swarm keys.
  // Test that nodes communicate using the correct protocol.

  const NodeA1 = await makeNode(swarmKeyA, false);
  const NodeB1 = await makeNode(swarmKeyB, true);
  const NodeA2 = await makeNode(swarmKeyA, false);
  const NodeB2 = await makeNode(swarmKeyB, true);

  const swarmATest = new Promise((resolve, reject) => {
    NodeA1.networkManager.joinProtocolSwarm(swarmKeyA, NodeA1.protocolProvider);
    NodeA2.protocol.on('receive', (protocol, message) => {
      log('Message', message);
      expectEqualsPromise(message, 'Node A1', resolve, reject);
    });
    NodeA1.protocol.on('connect', async (protocol) => {
      logOnConnect(protocol);
      if (hasExpectedPeer(protocol, NodeA2.nodeId)) {
        await NodeA1.protocol.send(NodeA2.nodeId, 'Node A1');
      }
    });
    NodeA2.networkManager.joinProtocolSwarm(swarmKeyA, NodeA2.protocolProvider);
    NodeA2.protocol.on('connect', async (protocol) => {
      logOnConnect(protocol);
      if (hasExpectedPeer(protocol, NodeA1.nodeId)) {
        await NodeA2.protocol.send(NodeA1.nodeId, 'Node A2');
      }
    });
  });

  const swarmBTest = new Promise((resolve, reject) => {
    NodeB1.networkManager.joinProtocolSwarm(swarmKeyB, NodeB1.protocolProvider);
    NodeB2.protocol.on('receive', (protocol, message) => {
      log('Message', message);
      expectEqualsPromise(message, 'NODE B1', resolve, reject);
    });

    NodeB1.protocol.on('connect', async (protocol) => {
      logOnConnect(protocol);
      if (hasExpectedPeer(protocol, NodeB2.nodeId)) {
        await NodeB1.protocol.send(NodeB2.nodeId, 'Node B1');
      }
    });

    NodeB2.networkManager.joinProtocolSwarm(swarmKeyB, NodeB2.protocolProvider);
    NodeB2.protocol.on('connect', async (protocol) => {
      logOnConnect(protocol);
      if (hasExpectedPeer(protocol, NodeB1.nodeId)) {
        await NodeB2.protocol.send(NodeB1.nodeId, 'Node B2');
      }
    });
  });

  try {
    await Promise.all([swarmATest, swarmBTest]);
  } catch (error) {
    done(error);
  }
  done();
});
