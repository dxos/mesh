import { Event, sleep } from "@dxos/async";
import { PublicKey } from "@dxos/crypto"
import { expect, mockFn } from "earljs";
import waitForExpect from 'wait-for-expect';
import { SignalData } from "simple-peer";
import { Swarm } from "./swarm";
import { Protocol } from "@dxos/protocol";
import { FullyConnectedTopology } from "../topology/fully-connected-topology";

describe('Swarm', () => {
  let topic: PublicKey;
  let firstPeerId: PublicKey;
  let secondPeerId: PublicKey;
  let swarm1: Swarm;
  let swarm2: Swarm;

  beforeEach(() => {
    topic = PublicKey.random()
    firstPeerId = PublicKey.random()
    secondPeerId = PublicKey.random()
    swarm1 = new Swarm(
      topic,
      firstPeerId,
      new FullyConnectedTopology(),
      () => new Protocol(),
      async msg => {
        await sleep(10); // Simulating network delay
        await swarm2.onOffer(msg)
      },
      async msg => {
        await sleep(10); // Simulating network delay
        await swarm2.onSignal(msg)
      },
      () => {},
    )
    swarm2 = new Swarm(
      topic,
      secondPeerId,
      new FullyConnectedTopology(),
      () => new Protocol(),
      async msg => {
        await sleep(10); // Simulating network delay
        await swarm1.onOffer(msg)
      },
      async msg => {
        await sleep(10); // Simulating network delay
        await swarm1.onSignal(msg)
      },
      () => {},
    )
  })

  afterEach(async () => {
    // await Promise.all([
    //   swarm1.destroy(),
    //   swarm2.destroy(),
    // ])
  })

  it('connects two peers in a swarm', async () => {
    expect(swarm1.connections.length).toEqual(0)
    expect(swarm2.connections.length).toEqual(0)

    swarm1.onCandidatesChanged([secondPeerId])

    await Promise.all([
      swarm1.connected.waitForCount(1),
      swarm1.connected.waitForCount(1),
    ])

    const swarm1Connection = swarm1.connections[0]
    const swarm2Connection = swarm2.connections[0]
    const onData = mockFn<(data: Buffer) => void>().returns(undefined)
    swarm2Connection.peer.on('data', onData)
    
    const data = Buffer.from('1234');
    swarm1Connection.peer.send(data)
    await waitForExpect(() => {
      expect(onData).toHaveBeenCalledWith([data])
    })
  })

  it('two peers try to originate connections to each other simultaneously', async () => {
    expect(swarm1.connections.length).toEqual(0)
    expect(swarm2.connections.length).toEqual(0)

    swarm1.onCandidatesChanged([secondPeerId])
    swarm2.onCandidatesChanged([firstPeerId])

    await Promise.all([
      swarm1.connected.waitForCount(1),
      swarm1.connected.waitForCount(1),
    ])
  }).timeout(5_000)
})
