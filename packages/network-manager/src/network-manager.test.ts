//
// Copyright 2020 DXOS.org
//

import { expect, mockFn } from 'earljs';
import { describe, it } from 'mocha';
import waitForExpect from 'wait-for-expect';

import { Event } from '@dxos/async';
import { PublicKey } from '@dxos/crypto';
import { Protocol } from '@dxos/protocol';

import { NetworkManager } from './network-manager';
import { TestProtocolPlugin, testProtocolProvider } from './testing/test-protocol';
import { FullyConnectedTopology } from './topology/fully-connected-topology';

describe('Network manager', () => {
  const createPeer = async (topic: PublicKey, peerId: PublicKey, inMemory = false) => {
    const networkManager = new NetworkManager({ signal: !inMemory ? ['wss://apollo1.kube.moon.dxos.network/dxos/signal'] : undefined });
    await networkManager.start();

    const plugin = new TestProtocolPlugin(peerId.asBuffer());
    const protocolProvider = testProtocolProvider(topic.asBuffer(), peerId.asBuffer(), plugin);
    networkManager.joinProtocolSwarm({ topic, peerId, protocol: protocolProvider, topology: new FullyConnectedTopology() });

    return {
      networkManager,
      plugin
    };
  };

  it('two peers connect to each other', async () => {
    const topic = PublicKey.random();
    const peer1Id = PublicKey.random();
    const peer2Id = PublicKey.random();

    const { plugin: plugin1 } = await createPeer(topic, peer1Id);
    const { plugin: plugin2 } = await createPeer(topic, peer2Id);

    const mockReceive = mockFn<[Protocol, string]>().returns(undefined);
    plugin1.on('receive', mockReceive);

    plugin2.on('connect', async () => {
      plugin2.send(peer1Id.asBuffer(), 'Foo');
    });

    await waitForExpect(() => {
      expect(mockReceive).toHaveBeenCalledWith([expect.a(Protocol), 'Foo']);
    });
  }).timeout(10_000);

  it('join an leave swarm', async () => {
    const topic = PublicKey.random();
    const peer1Id = PublicKey.random();
    const peer2Id = PublicKey.random();

    const { networkManager: networkManager1, plugin: plugin1 } = await createPeer(topic, peer1Id);
    const { plugin: plugin2 } = await createPeer(topic, peer2Id);

    await Promise.all([
      Event.wrap(plugin1, 'connect').waitForCount(1),
      Event.wrap(plugin2, 'connect').waitForCount(1)
    ]);

    const promise = Event.wrap(plugin2, 'disconnect').waitForCount(1);
    await networkManager1.leaveProtocolSwarm(topic);
    await promise;
  }).timeout(10_000);

  describe('in-memory', () => {
    it('two peers connect to each other', async () => {
      const topic = PublicKey.random();
      const peer1Id = PublicKey.random();
      const peer2Id = PublicKey.random();

      const { plugin: plugin1 } = await createPeer(topic, peer1Id, true);
      const { plugin: plugin2 } = await createPeer(topic, peer2Id, true);

      const mockReceive = mockFn<[Protocol, string]>().returns(undefined);
      plugin1.on('receive', mockReceive);

      plugin2.on('connect', async () => {
        plugin2.send(peer1Id.asBuffer(), 'Foo');
      });

      await waitForExpect(() => {
        expect(mockReceive).toHaveBeenCalledWith([expect.a(Protocol), 'Foo']);
      });
    }).timeout(10_000);

    it('two swarms at the same time', async () => {
      const topicA = PublicKey.random();
      const topicB = PublicKey.random();
      const peerA1Id = PublicKey.random();
      const peerA2Id = PublicKey.random();
      const peerB1Id = PublicKey.random();
      const peerB2Id = PublicKey.random();

      const { plugin: pluginA1 } = await createPeer(topicA, peerA1Id, true);
      const { plugin: pluginA2 } = await createPeer(topicA, peerA2Id, true);
      const { plugin: pluginB1 } = await createPeer(topicB, peerB1Id, true);
      const { plugin: pluginB2 } = await createPeer(topicB, peerB2Id, true);

      const mockReceiveA = mockFn<[Protocol, string]>().returns(undefined);
      pluginA1.on('receive', mockReceiveA);
      const mockReceiveB = mockFn<[Protocol, string]>().returns(undefined);
      pluginB1.on('receive', mockReceiveB);

      pluginA2.on('connect', async () => {
        pluginA2.send(peerA1Id.asBuffer(), 'Foo A');
      });
      pluginB2.on('connect', async () => {
        pluginB2.send(peerB1Id.asBuffer(), 'Foo B');
      });

      await waitForExpect(() => {
        expect(mockReceiveA).toHaveBeenCalledWith([expect.a(Protocol), 'Foo A']);
        expect(mockReceiveB).toHaveBeenCalledWith([expect.a(Protocol), 'Foo B']);
      });
    });
  });
});
