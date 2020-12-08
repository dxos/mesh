//
// Copyright 2020 DXOS.org
//

import { expect, mockFn } from 'earljs';
import waitForExpect from 'wait-for-expect';
import { describe, it } from 'mocha'

import { PublicKey } from '@dxos/crypto';
import { Protocol } from '@dxos/protocol';

import { NetworkManager } from './network-manager';
import { TestProtocolPlugin, testProtocolProvider } from './testing/test-protocol';
import { FullyConnectedTopology } from './topology/fully-connected-topology';

describe('Network manager', () => {
  it('two peers connect to each other', async () => {
    const networkManager1 = new NetworkManager(['wss://apollo1.kube.moon.dxos.network/dxos/signal']);
    const networkManager2 = new NetworkManager(['wss://apollo1.kube.moon.dxos.network/dxos/signal']);

    await networkManager1.start();
    await networkManager2.start();

    const topic = PublicKey.random();
    const peer1Id = PublicKey.random();
    const peer2Id = PublicKey.random();

    const plugin1 = new TestProtocolPlugin(peer1Id.asBuffer());
    const protocolProvider1 = testProtocolProvider(topic.asBuffer(), peer1Id.asBuffer(), plugin1);
    networkManager1.joinProtocolSwarm({ topic, peerId: peer1Id, protocol: protocolProvider1, topology: new FullyConnectedTopology() });

    const plugin2 = new TestProtocolPlugin(peer2Id.asBuffer());
    const protocolProvider2 = testProtocolProvider(topic.asBuffer(), peer2Id.asBuffer(), plugin2);
    networkManager2.joinProtocolSwarm({ topic, peerId: peer2Id, protocol: protocolProvider2, topology: new FullyConnectedTopology() });

    const mockReceive = mockFn<[Protocol, string]>().returns(undefined);
    plugin1.on('receive', mockReceive);

    plugin2.on('connect', async () => {
      plugin2.send(peer1Id.asBuffer(), 'Foo');
    });

    await waitForExpect(() => {
      expect(mockReceive).toHaveBeenCalledWith([expect.a(Protocol), 'Foo']);
    });
  }).timeout(10_000);
});
