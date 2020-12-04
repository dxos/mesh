import { Event, sleep } from "@dxos/async";
import { PublicKey } from "@dxos/crypto"
import { expect, mockFn } from "earljs";
import waitForExpect from 'wait-for-expect';
import { SignalData } from "simple-peer";
import { Swarm } from "./swarm";

describe('Swarm', () => {
  it('connects two peers in a swarm', async () => {
    const topic = PublicKey.random()
    const firstPeerId = PublicKey.random()
    const secondPeerId = PublicKey.random()
    const swarm1: Swarm = new Swarm(topic, firstPeerId, msg => swarm2.onOffer(msg), msg => swarm2.onSignal(msg))
    const swarm2: Swarm = new Swarm(topic, secondPeerId, msg => swarm1.onOffer(msg), msg => swarm1.onSignal(msg))

    expect(swarm1.connections.length).toEqual(0)
    expect(swarm2.connections.length).toEqual(0)

    swarm1.onCandidatesChanged([secondPeerId])

    await waitForExpect(() => {
      expect(swarm1.connections.length).toEqual(1)
      expect(swarm2.connections.length).toEqual(1)
    })

    const swarm1Connection = swarm1.connections[0]
    const swarm2Connection = swarm2.connections[0]
    const onData = mockFn<(data: Buffer) => void>().returns(undefined)
    swarm2Connection.on('data', onData)
    
    await Event.wrap(swarm1Connection, 'connect').waitForCount(1)

    const data = Buffer.from('1234');
    swarm1Connection.send(data)
    await waitForExpect(() => {
      expect(onData).toHaveBeenCalledWith([data])
    })
  })

  it('two peers try to originate connections to each other simultaneously')
})
