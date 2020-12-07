import React, { useRef, useState, useEffect } from 'react';
import { FullScreen, SVG, useGrid, Grid } from '@dxos/gem-core';
import { Markers, createSimulationDrag, ForceLayout, Graph, NodeProjector } from '@dxos/gem-spore';
import useResizeAware from 'react-resize-aware';
import { NetworkManager, PeerState, SwarmMapper, transportProtocolProvider } from '@dxos/network-manager'
import { randomBytes, PublicKey } from '@dxos/crypto';
import { Presence } from '@dxos/protocol-plugin-presence'
import { makeStyles, colors } from '@material-ui/core';

export default {
  title: 'Devtools'
}

const createPeer = async (controlTopic: PublicKey, peerId: PublicKey) => {
  const networkManager = new NetworkManager(['wss://apollo2.kube.moon.dxos.network/dxos/signal']);
  const presencePlugin = new Presence(peerId.asBuffer())
  await networkManager.start()
  networkManager.joinProtocolSwarm(controlTopic, peerId, transportProtocolProvider(controlTopic.asBuffer(), peerId.asBuffer(), presencePlugin), { presence: presencePlugin })
  return networkManager.getSwarmMap(controlTopic)!;
}

const GraphDemo = () => {
  const [controlTopic] = useState(() => PublicKey.random())
  const [controlPeer, setControlPeer] = useState<SwarmMapper | undefined>();

  useEffect(() => {
    createPeer(controlTopic, controlTopic).then(peer => setControlPeer(peer))
  }, [])

  const [resizeListener, size] = useResizeAware();
  const { width, height } = size;
  const grid = useGrid({ width, height });

  const [layout] = useState(() => new ForceLayout({
    // initializer: (node: any, center: any) => {
    //   // Freeze this peer.
    //   // if (node.id === controlTopic.toString('hex')) {
    //   //   return {
    //   //     fx: center.x,
    //   //     fy: center.y
    //   //   };
    //   // }
    // }
  }));
  const [drag] = useState(() => createSimulationDrag(layout.simulation));
  const [{ nodeProjector }] = useState({
    nodeProjector: new NodeProjector({
      node: {
        showLabels: true,
        propertyAdapter: (node: any) => {
          return {
            class: node.id === controlTopic.toHex() ? 'blue' :
                    node.state === 'WAITING_FOR_CONNECTION' ? 'orange' :
                    node.state === 'CONNECTED' ? 'green' :
                    'grey',

            // radius: node.id === controlTopic.toHex() ? 20 : 10
          };
        }
      }
    })
  });



  const [data, setData] = useState<any>({ nodes: [], links: [] });

  function buildGraph(peers: PeerState[]) {
    const nodes: any[] = [], links: any[] = []
    for(const peer of peers) {
      nodes.push({
        id: peer.id.toHex(),
        title: peer.id.humanize(),
        state: peer.state,
      })
      for(const connection of peer.connections) {
        links.push({
          id: `${peer.id.toHex()}-${connection.toHex()}`,
          source: peer.id.toHex(),
          target: connection.toHex(),
        })
      }
    }
    return { nodes, links }
  }

  useEffect(() => {
    controlPeer?.mapUpdated.on(peers => {
      console.log(peers)
      setData(buildGraph(peers))
    })
    console.log(controlPeer?.peers)
    controlPeer && setData(buildGraph(controlPeer.peers))
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

  console.log('data', data)

  const classes = useCustomStyles();

  return (
    <FullScreen>
      {resizeListener}

      <div style={{ position: 'absolute' }}>
        <button onClick={() => addPeers(1)}>Add peer</button>
        <button onClick={() => addPeers(5)}>Add 5 peers</button>
        <button onClick={() => addPeers(10)}>Add 10 peers</button>
        <button onClick={() => killPeer()}>Kill peer</button>
      </div>

      <SVG width={width} height={height}>
        <Grid grid={grid} />

        <Graph
          grid={grid}
          data={data}
          layout={layout}
          nodeProjector={nodeProjector}
          drag={drag}
          classes={{
            nodes: classes.nodes
          }}
        />
      </SVG>
    </FullScreen>
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
