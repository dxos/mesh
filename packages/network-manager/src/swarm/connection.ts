import { Event } from "@dxos/async";
import { PublicKey } from "@dxos/crypto";
import { SignalApi } from "../signal/signal-api";
import { WebrtcConnection } from "./webrtc-connection";

export interface Connection {
  stateChanged: Event<WebrtcConnection.State>;

  closed: Event;
  
  remoteId: PublicKey

  state: WebrtcConnection.State;

  signal (msg: SignalApi.SignalMessage): void;

  close (): Promise<void>;
}
