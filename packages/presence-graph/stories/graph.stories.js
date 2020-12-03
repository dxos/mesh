import React, { useRef, useState, useEffect } from 'react';
import { FullScreen, SVG, useGrid, Grid } from '@dxos/gem-core';
import { Markers, createSimulationDrag, ForceLayout, Graph, NodeProjector } from '@dxos/gem-spore';
import useResizeAware from 'react-resize-aware';
import { NetworkManager, SwarmProvider, transportProtocolProvider, TopologySignalClient } from '@dxos/network-manager'
import { randomBytes, PublicKey } from '@dxos/crypto';
import { Presence } from '@dxos/protocol-plugin-presence'

export default {
  title: 'Graph'
}

export const withFoo = () => <h1>Foo</h1>

const createPeer = (controlTopic, peerId) => {
  // TODO(marik-d): Remove feed-store (first arg).
  const networkManager = new NetworkManager({}, new SwarmProvider({
    signal: 'wss://apollo2.kube.moon.dxos.network/dxos/signal',
      ice: [{ urls: 'stun:apollo1.kube.moon.dxos.network:3478' }, { urls: 'turn:apollo1.kube.moon.dxos.network:3478', username: 'dxos', credential: 'dxos' }, { urls: 'stun:apollo2.kube.moon.dxos.network:3478' }, { urls: 'turn:apollo2.kube.moon.dxos.network:3478', username: 'dxos', credential: 'dxos' }]
  }))

  const presencePlugin = new Presence(peerId)
  networkManager.joinProtocolSwarm(controlTopic, transportProtocolProvider(controlTopic, peerId, presencePlugin), { signal: TopologySignalClient });

  return presencePlugin;
}

const GraphDemo = () => {
  const [controlTopic] = useState(() => randomBytes())
  const [controlPeer] = useState(() => createPeer(controlTopic, controlTopic))

  const [resizeListener, size] = useResizeAware();
  const { width, height } = size;
  const grid = useGrid({ width, height });

  const [layout] = useState(() => new ForceLayout({
    initializer: (node, center) => {
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
        propertyAdapter: (node) => {
          return {
            radius: node.id === controlTopic.toString('hex') ? 20 : 10
          };
        }
      }
    })
  });



  const [data, setData] = useState(() => buildGraph(controlPeer.graph));

  function buildGraph(graph) {
    const nodes = [], links = []
    graph.forEachNode(node => {
      nodes.push({
        id: node.id,
        title: PublicKey.fromHex(node.id).humanize(),
      })
    })
    graph.forEachLink(link => {
      links.push({
        id: link.id,
        source: link.fromId,
        target: link.toId,
      })
    })
    return { nodes, links }
  }

  useEffect(() => {
    controlPeer.on('graph-updated', (_, graph) => {
      setData(buildGraph(graph))
    })
  }, [])

  function addPeers(n) {
    for(let i = 0; i < n; i++) {
      createPeer(controlTopic, randomBytes())
    }
  }

  return (
    <FullScreen>
      {resizeListener}

      <div style={{ position: 'absolute' }}>
        <button onClick={() => addPeers(1)}>Add peer</button>
        <button onClick={() => addPeers(5)}>Add 5 peers</button>
        <button onClick={() => addPeers(10)}>Add 10 peers</button>
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
