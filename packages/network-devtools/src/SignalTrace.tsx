import React from 'react';
import { SignalApi } from "@dxos/network-manager";

export interface SignalTraceProps {
  trace: SignalApi.CommandTrace[],
}

export const SignalTrace = ({ trace }: SignalTraceProps) => (
  <div style={{  overflowY: 'auto' }}>
    {trace.map(msg => (
      <div key={JSON.stringify(msg)}>{msg.method} {msg.time} ms</div>
    ))}
  </div>
)
