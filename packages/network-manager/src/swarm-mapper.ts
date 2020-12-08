//
// Copyright 2020 DXOS.org
//

import { Event } from '@dxos/async';
import { PublicKey } from '@dxos/crypto';
import { ComplexMap } from '@dxos/util';

import { Connection } from './swarm/connection';
import { Swarm } from './swarm/swarm';

export interface PeerState {
  id: PublicKey
  state: Connection.State | 'INDIRECTLY_CONNECTED' | 'ME'
  connections: PublicKey[]
}

type Unsubscribe = () => void;

export class SwarmMapper {
  private readonly _subscriptions: (() => void)[] = [];

  private readonly _connectionSubscriptions = new ComplexMap<PublicKey, Unsubscribe>(x => x.toHex());

  private readonly _peers = new ComplexMap<PublicKey, PeerState>(x => x.toHex());

  get peers (): PeerState[] {
    return Array.from(this._peers.values());
  }

  readonly mapUpdated = new Event<PeerState[]>();

  constructor (
    private readonly _swarm: Swarm,
    private readonly _presence: any /* Presence */ | undefined
  ) {
    this._subscriptions.push(_swarm.connectionAdded.on(connection => {
      this._update();
      this._connectionSubscriptions.set(connection.remoteId, connection.stateChanged.on(() => {
        this._update();
      }));
    }));
    this._subscriptions.push(_swarm.connectionRemoved.on(connection => {
      this._connectionSubscriptions.get(connection.remoteId)?.();
      this._connectionSubscriptions.delete(connection.remoteId);
      this._update();
    }));
    if (_presence) {
      this._subscriptions.push(_presence.on('graph-updated', () => {
        this._update();
      }));
    }
    this._update();
  }

  private _update () {
    this._peers.clear();
    this._peers.set(this._swarm.ownPeerId, {
      id: this._swarm.ownPeerId,
      state: 'ME',
      connections: []
    });
    for (const connection of this._swarm.connections) {
      this._peers.set(connection.remoteId, {
        id: connection.remoteId,
        state: connection.state,
        connections: [this._swarm.ownPeerId]
      });
    }
    if (this._presence) {
      this._presence.graph.forEachNode((node: any) => {
        const id = PublicKey.fromHex(node.id);
        if (this._peers.has(id)) {
          return;
        }
        this._peers.set(id, {
          id,
          state: 'INDIRECTLY_CONNECTED',
          connections: []
        });
      });
      this._presence.graph.forEachLink((link: any) => {
        this._peers.get(PublicKey.from(link.fromId))!.connections.push(PublicKey.from(link.toId));
      });
    }
    this.mapUpdated.emit(Array.from(this._peers.values()));
  }

  destroy () {
    this._subscriptions.forEach(cb => cb());
  }
}
