import React from 'react'
import { SignalApi } from "@dxos/network-manager/dist/signal/signal-api";

export interface SignalStatusProps {
  status: SignalApi.Status[]
}

export const SignalStatus = ({ status }: SignalStatusProps) => (
  <ul>
    {status.map(s => (
      <li 
        style={{ 
          color: getColor(s.state),
        }}
        key={s.host}
      >
        {s.host} {s.state} {s.error ?? ''}
      </li>
    ))}
  </ul>
)

function getColor(state: SignalApi.State) {
  switch(state) {
    case SignalApi.State.CONNECTING:
    case SignalApi.State.NOT_CONNECTED:
      return 'orange'
    case SignalApi.State.CONNECTED:
      return 'green'
    case SignalApi.State.ERROR:
    case SignalApi.State.DISCONNECTED:
      return 'red'
  }
}
