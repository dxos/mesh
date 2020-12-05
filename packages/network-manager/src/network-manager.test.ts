import { PublicKey } from "@dxos/crypto";
import { Protocol } from "@dxos/protocol";
import { expect, mockFn } from "earljs";
import waitForExpect from "wait-for-expect";
import { NetworkManager } from "./network-manager"
import { TestProtocolPlugin, testProtocolProvider } from "./testing/test-protocol";

describe('Network manager', () => {
  // TODO(marik-d): Crashes not process.
  it.skip('two peers connect to each other', async () => {
    const networkManager1 = new NetworkManager(['wss://apollo1.kube.moon.dxos.network/dxos/signal']);
    const networkManager2 = new NetworkManager(['wss://apollo1.kube.moon.dxos.network/dxos/signal']);

    await networkManager1.start()
    await networkManager2.start()

    const topic = PublicKey.random();
    const peer1Id = PublicKey.random();
    const peer2Id = PublicKey.random();

    const plugin1 = new TestProtocolPlugin(peer1Id.asBuffer());
    const protocolProvider1 = testProtocolProvider(topic, peer1Id, plugin1);
    networkManager1.joinProtocolSwarm(topic, peer1Id, protocolProvider1, {})

    const plugin2 = new TestProtocolPlugin(peer2Id.asBuffer());
    const protocolProvider2 = testProtocolProvider(topic, peer2Id, plugin2);
    networkManager2.joinProtocolSwarm(topic, peer2Id, protocolProvider2, {})

    const mockReceive = mockFn<[Protocol, string]>().returns(undefined);
    plugin1.on('receive', mockReceive);
  
    plugin2.on('connect', async (protocol) => {
      plugin2.send(peer1Id.asBuffer(), 'Foo')
    });

    await waitForExpect(() => {
      expect(mockReceive).toHaveBeenCalledWith([expect.a(Protocol), 'Foo']);
    })
  }).timeout(10_000)
})
