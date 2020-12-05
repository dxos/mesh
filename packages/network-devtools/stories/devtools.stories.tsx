import React, { useRef, useState, useEffect } from 'react';
import { FullScreen, SVG, useGrid, Grid } from '@dxos/gem-core';
import { Markers, createSimulationDrag, ForceLayout, Graph, NodeProjector } from '@dxos/gem-spore';
import useResizeAware from 'react-resize-aware';
import { NetworkManager, transportProtocolProvider } from '@dxos/network-manager'
import { randomBytes, PublicKey } from '@dxos/crypto';
import { Presence } from '@dxos/protocol-plugin-presence'

export default {
  title: 'Devtools'
}

const createPeer = (controlTopic: PublicKey, peerId: PublicKey) => {
  const networkManager = new NetworkManager(['wss://apollo2.kube.moon.dxos.network/dxos/signal']);

  const presencePlugin = new Presence(peerId)
  networkManager.joinProtocolSwarm(controlTopic, peerId, transportProtocolProvider(controlTopic.asBuffer(), peerId.asBuffer(), presencePlugin), {});

  return presencePlugin;
}

const GraphDemo = () => {
  const [controlTopic] = useState(() => PublicKey.random())
  const [controlPeer] = useState(() => createPeer(controlTopic, controlTopic))

  const [resizeListener, size] = useResizeAware();
  const { width, height } = size;
  const grid = useGrid({ width, height });

  const [layout] = useState(() => new ForceLayout({
    initializer: (node: any, center: any) => {
      // Freeze this peer.
      // if (node.id === controlTopic.toString('hex')) {
      //   return {
      //     fx: center.x,
      //     fy: center.y
      //   };
      // }
    }
  }));
  const [drag] = useState(() => createSimulationDrag(layout.simulation));
  const [{ nodeProjector }] = useState({
    nodeProjector: new NodeProjector({
      node: {
        showLabels: true,
        propertyAdapter: (node: any) => {
          return {
            radius: node.id === controlTopic.toHex() ? 20 : 10
          };
        }
      }
    })
  });



  const [data, setData] = useState(() => buildGraph(controlPeer.graph));

  function buildGraph(graph: any) {
    const nodes: any[] = [], links: any[] = []
    graph.forEachNode((node: any) => {
      nodes.push({
        id: node.id,
        title: PublicKey.fromHex(node.id).humanize(),
      })
    })
    graph.forEachLink((link: any) => {
      links.push({
        id: link.id,
        source: link.fromId,
        target: link.toId,
      })
    })
    return { nodes, links }
  }

  useEffect(() => {
    controlPeer.on('graph-updated', (_: any, graph: any) => {
      setData(buildGraph(graph))
    })
  }, [])

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
        />
      </SVG>
    </FullScreen>
  )
}

export const withGraph = () => <GraphDemo />
