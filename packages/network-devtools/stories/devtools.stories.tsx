import React, { useState, useEffect } from 'react';
import { FullScreen } from '@dxos/gem-core';
import useResizeAware from 'react-resize-aware';
import { FullyConnectedTopology, NetworkManager, PeerState, SignalApi, SignalManager, SwarmMapper, transportProtocolProvider } from '@dxos/network-manager'
import { PublicKey } from '@dxos/crypto';
import { Presence } from '@dxos/protocol-plugin-presence'
import { makeStyles, colors } from '@material-ui/core';
import { PeerGraph } from '../src/PeerGraph';
import { SignalStatus } from '../src/SignalStatus';

export default {
  title: 'Devtools'
}

const createPeer = async (controlTopic: PublicKey, peerId: PublicKey) => {
  const networkManager = new NetworkManager(['wss://apollo2.kube.moon.dxos.network/dxos/signal']);
  const presencePlugin = new Presence(peerId.asBuffer())
  await networkManager.start()
  networkManager.joinProtocolSwarm({
    topic: controlTopic,
    peerId,
    topology: new FullyConnectedTopology(),
    protocol: transportProtocolProvider(controlTopic.asBuffer(), peerId.asBuffer(), presencePlugin),
    presence: presencePlugin,
  })
  return {
    map: networkManager.getSwarmMap(controlTopic)!,
    signal: networkManager.signal,
  }
}

const GraphDemo = () => {
  const [controlTopic] = useState(() => PublicKey.random())
  const [controlPeer, setControlPeer] = useState<{ map: SwarmMapper, signal: SignalManager }>();

  useEffect(() => {
    createPeer(controlTopic, controlTopic).then(peer => setControlPeer(peer))
  }, [])

  const [resizeListener, size] = useResizeAware();
  const { width, height } = size;
 
  useEffect(() => {
    controlPeer?.map.mapUpdated.on(peers => {
      setPeerMap(peers)
    })
    controlPeer && setPeerMap(controlPeer.map.peers)
  }, [controlPeer])

  const [peers, setPeers] = useState<any[]>([]);

  function addPeers(n: number) {
    for(let i = 0; i < n; i++) {
      const peer = createPeer(controlTopic, PublicKey.random())
      setPeers(peers => [...peers, peer])
    }
  }

  const killPeer = () => {
    const peer = peers[Math.floor(Math.random() * peers.length)];
    console.log('leave', peer)
    peer && peer.leave();
  }

  const [peerMap, setPeerMap] = useState<PeerState[]>([]);

  const [signalStatus, setSignalStatus] = useState<SignalApi.Status[]>([]);
  useEffect(() => {
    return controlPeer?.signal.statusChanged.on(status => {
      setSignalStatus(status)
    })
  }, [controlPeer])

  return (
    <div style={{display: 'flex', flexDirection: 'row', width: '100vw', height: '100vw' }}>
      <div style={{ position: 'absolute' }}>
        <button onClick={() => addPeers(1)}>Add peer</button>
        <button onClick={() => addPeers(5)}>Add 5 peers</button>
        <button onClick={() => addPeers(10)}>Add 10 peers</button>
        <button onClick={() => killPeer()}>Kill peer</button>
      </div>

      <div style={{ flex: 0.5 }}>
        {resizeListener}
        <PeerGraph
          peers={peerMap}
          size={{ width, height }}
        />
      </div>

      <div style={{ flex: 0.5 }}>
        <SignalStatus status={signalStatus} />
      </div>
    </div>
  )
}

export const withGraph = () => <GraphDemo />

const nodeColors: (keyof typeof colors)[] = ['red', 'green', 'blue', 'yellow', 'orange', 'grey'];
const useCustomStyles = makeStyles(() => ({
  nodes: nodeColors.reduce((map: any, color: string) => {
    map[`& g.node.${color} circle`] = {
      fill: (colors as any)[color][400],
      stroke: (colors as any)[color][700],
    };

    // map[`& g.node.${color} text`] = {
    //   fontFamily: 'sans-serif',
    //   fontSize: 12,
    //   fill: colors['grey'][700]
    // };

    return map;
  }, {})
}));
