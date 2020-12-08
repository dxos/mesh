//
// Copyright 2020 DXOS.org
//

import assert from 'assert';

import { Event } from '@dxos/async';
import { PublicKey } from '@dxos/crypto';

import { SignalApi } from './signal-api';

export class SignalManager {
  private readonly _servers = new Map<string, SignalApi>();

  readonly statusChanged = new Event<SignalApi.Status[]>();

  readonly commandTrace = new Event<SignalApi.CommandTrace>();

  constructor (
    private readonly _hosts: string[]
  ) {
    assert(_hosts.length === 1, 'Only a single signaling server connection is supported');
  }

  getStatus (): SignalApi.Status[] {
    return Array.from(this._servers.values()).map(server => server.getStatus());
  }

  async connect () {
    await Promise.all(this._hosts.map(async host => {
      const server = new SignalApi(
        host,
        async (msg) => {
          this.onOffer.emit(msg);
          return {} as any; // TODO(marik-d): Figure out how to do answers or remove the entirely.
        },
        async msg => {
          this.onSignal.emit(msg);
        }
      );
      this._servers.set(host, server);
      server.statusChanged.on(() => this.statusChanged.emit(this.getStatus()));
      server.commandTrace.on(trace => this.commandTrace.emit(trace));
      await server.connect();
    }));
  }

  join (topic: PublicKey, peerId: PublicKey) {
    for (const server of this._servers.values()) {
      server.join(topic, peerId).then(peers => {
        // TODO(marik-d): Deduplicate peers.
        this.candidatesChanged.emit([topic, peers]);
      });
    }
  }

  leave (topic: PublicKey, peerId: PublicKey) {
    for (const server of this._servers.values()) {
      server.leave(topic, peerId);
    }
  }

  lookup (topic: PublicKey) {
    for (const server of this._servers.values()) {
      server.lookup(topic).then(peers => {
        // TODO(marik-d): Deduplicate peers.
        this.candidatesChanged.emit([topic, peers]);
      });
    }
  }

  offer (msg: SignalApi.SignalMessage) {
    for (const server of this._servers.values()) {
      server.offer(msg);
      // TODO(marik-d): Return value & error handling.
    }
  }

  signal (msg: SignalApi.SignalMessage) {
    for (const server of this._servers.values()) {
      server.signal(msg);
      // TODO(marik-d): Error handling.
    }
  }

  candidatesChanged = new Event<[topic: PublicKey, candidates: PublicKey[]]>()

  onOffer = new Event<SignalApi.SignalMessage>();
  onSignal = new Event<SignalApi.SignalMessage>();
}
