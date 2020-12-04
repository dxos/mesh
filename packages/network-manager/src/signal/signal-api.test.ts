import { sleep } from "@dxos/async";
import { PublicKey } from "@dxos/crypto"
import { expect, mockFn } from "earljs";
import { SignalApi } from "./signal-api"
import waitForExpect from 'wait-for-expect';

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

  it('offer', async () => {
    const topic = PublicKey.random();
    const peer1 = PublicKey.random();
    const peer2 = PublicKey.random();
    const offerMock = mockFn<(msg: SignalApi.SignalMessage) => Promise<unknown>>()
      .resolvesTo({ foo: 'bar' })
    const api1 = new SignalApi('wss://apollo1.kube.moon.dxos.network/dxos/signal', offerMock, async () => {});

    api1.connect();

    await api1.join(topic, peer1);

    const offer: SignalApi.SignalMessage = {
      data: { foo: 'bar' },
      id: peer2,
      remoteId: peer1,
      sessionId: PublicKey.random(),
      topic,
    }
    const offerResult = await api1.offer(offer)
    expect(offerResult).toEqual({ foo: 'bar' })
    expect(offerMock).toHaveBeenCalledWith([offer])
  }).timeout(5_000)

  it('signal', async () => {
    const topic = PublicKey.random();
    const peer1 = PublicKey.random();
    const peer2 = PublicKey.random();
    const signalMock = mockFn<(msg: SignalApi.SignalMessage) => Promise<void>>()
      .resolvesTo()
    const api1 = new SignalApi('wss://apollo1.kube.moon.dxos.network/dxos/signal', async () => {}, signalMock);

    api1.connect();

    await api1.join(topic, peer1);

    const msg: SignalApi.SignalMessage = {
      id: peer2,
      remoteId: peer1,
      sessionId: PublicKey.random(),
      topic,
      data: { foo: 'bar' },
    }
    await api1.signal(msg)

    await waitForExpect(() => {
      expect(signalMock).toHaveBeenCalledWith([msg]);
    })
  }).timeout(5_000)
})
