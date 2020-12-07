import React, { useState, useEffect } from 'react';
import { SVG, useGrid, Grid } from '@dxos/gem-core';
import { createSimulationDrag, ForceLayout, Graph, NodeProjector } from '@dxos/gem-spore';
import { PeerState } from '@dxos/network-manager'
import { makeStyles, colors } from '@material-ui/core';

export interface PeerGraphProps {
  peers: PeerState[]
  size: { width: number | null, height: number | null }
}

export const PeerGraph = ({ peers, size }: PeerGraphProps) => {
  const grid = useGrid(size);

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
            class: node.state === 'ME' ? 'blue' :
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
    setData(buildGraph(peers))
  }, [peers])

  const classes = useCustomStyles();

  return (
    <SVG width={size.width} height={size.height}>
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
  )
}

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
