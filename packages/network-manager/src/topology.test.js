import { NetworkManager } from './network-manager'
import { SwarmProvider } from './swarm-provider'
import { randomBytes } from '@dxos/crypto';
import { Presence } from '@dxos/protocol-plugin-presence'
import { transportProtocolProvider } from './protocol-factory';

test('topology', async () => {
  const createPeer = (controlTopic, peerId) => {
    // TODO(marik-d): Remove feed-store (first arg).
    const networkManager = new NetworkManager({}, new SwarmProvider({
      signal: 'wss://apollo2.kube.moon.dxos.network/dxos/signal',
        ice: [{ urls: 'stun:apollo1.kube.moon.dxos.network:3478' }, { urls: 'turn:apollo1.kube.moon.dxos.network:3478', username: 'dxos', credential: 'dxos' }, { urls: 'stun:apollo2.kube.moon.dxos.network:3478' }, { urls: 'turn:apollo2.kube.moon.dxos.network:3478', username: 'dxos', credential: 'dxos' }]
    }))

    const presencePlugin = new Presence(peerId)
    networkManager.joinProtocolSwarm(controlTopic, transportProtocolProvider(controlTopic, peerId, presencePlugin));

    return presencePlugin;
  }

  const controlTopic = randomBytes()
  const peer1 = createPeer(controlTopic, randomBytes())
  const peer2 = createPeer(controlTopic, randomBytes())

  peer1.on('graph-updated', graph => console.log('peer1', graph))
  peer2.on('graph-updated', graph => console.log('peer2', graph))

  await new Promise(() => {})
}, 300_000)
