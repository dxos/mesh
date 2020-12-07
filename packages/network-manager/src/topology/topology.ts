import { PublicKey } from "@dxos/crypto";

export interface SwarmController {
  connect(peer: PublicKey): void;
  disconnect(peer: PublicKey): void;
}

export interface Topology {
  init(controller: SwarmController): void;

  update(connected: PublicKey[], discovered: PublicKey[]): void;

  onOffer(peer: PublicKey): void;

  destroy(): Promise<void>;
}
