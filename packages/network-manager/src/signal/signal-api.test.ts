import { sleep } from "@dxos/async";
import { PublicKey } from "@dxos/crypto"
import { expect } from "earljs";
import { SignalApi } from "./signal-api"

describe('SignalApi', () => {
  it('join', async () => {
    const topic = PublicKey.random();
    const peer1 = PublicKey.random();
    const peer2 = PublicKey.random();
    const api1 = new SignalApi('wss://apollo1.kube.moon.dxos.network/dxos/signal', async () => {}, async () => {});

    api1.connect();

    const join = await api1.join(topic, peer1);
    expect(join).toEqual([peer1]);

    const join2 = await api1.join(topic, peer2);
    expect(join2).toEqual([peer1, peer2]);
  }).timeout(10_000)

  it.only('offer', async () => {
    const topic = PublicKey.random();
    const peer1 = PublicKey.random();
    const peer2 = PublicKey.random();
    const api1 = new SignalApi('wss://apollo1.kube.moon.dxos.network/dxos/signal', async (x) => {console.log(x); return { foo: 'bar' }}, async () => {});

    api1.connect();

    await api1.join(topic, peer1);

    console.log(await api1.offer({
      data: { foo: 'bar' },
      id: peer2,
      remoteId: peer1,
      sessionId: PublicKey.random(),
      topic,
    }))
  })
})
