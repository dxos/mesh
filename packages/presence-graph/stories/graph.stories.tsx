import React, { useRef, useState, useEffect } from 'react';
import { FullScreen, SVG, useGrid, Grid } from '@dxos/gem-core';
import { Markers, createSimulationDrag, ForceLayout, Graph } from '@dxos/gem-spore';
import useResizeAware from 'react-resize-aware';

export default {
  title: 'Graph'
}

export const withFoo = () => <h1>Foo</h1>

const GraphDemo = () => {
  const [resizeListener, size] = useResizeAware();
  const { width, height } = size;
  const grid = useGrid({ width, height });
  const guides = useRef<any>();

  const [layout] = useState(() => new ForceLayout());
  const [drag] = useState(() => createSimulationDrag(layout.simulation));

  const data = {
    nodes: [
      { id: 'a', title: 'a' },
      { id: 'b', title: 'b' }
    ],
    links: [
      { id: 'a-b', source: 'a', target: 'b' }
    ]
  }

  return (
    <FullScreen>
      {resizeListener}

      <SVG width={width} height={height}>
        <Grid grid={grid} />

        <Graph
          grid={grid}
          data={data}
          layout={layout}
          drag={drag}
        />
      </SVG>
    </FullScreen>
  )
}

export const withGraph = () => <GraphDemo />
