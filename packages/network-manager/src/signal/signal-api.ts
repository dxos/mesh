//
// Copyright 2020 DXOS.org
//

import debug from 'debug';
import { SignalData } from 'simple-peer';

import { Event } from '@dxos/async';
import { PublicKey } from '@dxos/crypto';

import { WebsocketRpc } from './websocket-rpc';

const log = debug('dxos:network-manager:signal-api');

/**
 * Establishes a websocket connection to signal server and provides RPC methods.
 */
export class SignalApi {
  private _state = SignalApi.State.NOT_CONNECTED;

  private _lastError?: Error;

  private _client: WebsocketRpc;

  readonly statusChanged = new Event<SignalApi.Status>();

  readonly commandTrace = new Event<SignalApi.CommandTrace>();

  /**
   * @param _host Signal server websocket URL.
   * @param _onOffer See `SignalApi.offer`.
   * @param _onSignal See `SignalApi.signal`.
   */
  constructor (
    private readonly _host: string,
    private readonly _onOffer: (message: SignalApi.SignalMessage) => Promise<SignalApi.Answer>,
    private readonly _onSignal: (message: SignalApi.SignalMessage) => Promise<void>
  ) {
    this._client = new WebsocketRpc(_host);
    this._client.addHandler('offer', (message: any) => this._onOffer({
      id: PublicKey.from(message.id),
      remoteId: PublicKey.from(message.remoteId),
      topic: PublicKey.from(message.topic),
      sessionId: PublicKey.from(message.sessionId),
      data: message.data
    }));
    this._client.subscribe('signal', (msg: SignalApi.SignalMessage) => this._onSignal({
      id: PublicKey.from(msg.id),
      remoteId: PublicKey.from(msg.remoteId),
      topic: PublicKey.from(msg.topic),
      sessionId: PublicKey.from(msg.sessionId),
      data: msg.data
    }));

    this._client.connected.on(() => this._setState(SignalApi.State.CONNECTED));
    this._client.error.on(error => {
      this._lastError = error;
      this._setState(SignalApi.State.ERROR);

      // TODO(marik-d): Reconnect.
      console.error(error);
    });
    this._client.disconnected.on(() => {
      this._setState(SignalApi.State.DISCONNECTED);
      // TODO(marik-d): Reconnect.
    });

    this._setState(SignalApi.State.CONNECTING);
  }

  private _setState (newState: SignalApi.State) {
    log(`Signal state changed ${this._host} ${newState}`);
    this._state = newState;
    this.statusChanged.emit(this.getStatus());
  }

  async close () {
    await this._client.close();
    this._setState(SignalApi.State.DISCONNECTED);
  }

  getStatus (): SignalApi.Status {
    return {
      host: this._host,
      state: this._state,
      error: this._lastError
    };
  }

  async join (topic: PublicKey, peerId: PublicKey): Promise<PublicKey[]> {
    const peers: Buffer[] = await this._client.call('join', {
      id: peerId.asBuffer(),
      topic: topic.asBuffer()
    });
    return peers.map(id => PublicKey.from(id));
  }

  async leave (topic: PublicKey, peerId: PublicKey): Promise<void> {
    await this._client.call('leave', {
      id: peerId.asBuffer(),
      topic: topic.asBuffer()
    });
  }

  async lookup (topic: PublicKey): Promise<PublicKey[]> {
    const peers: Buffer[] = await this._client.call('lookup', {
      topic: topic.asBuffer()
    });
    return peers.map(id => PublicKey.from(id));
  }

  /**
   * Routes an offer to the other peer's _onOffer callback.
   * @returns Other peer's _onOffer callback return value.
   */
  async offer (payload: SignalApi.SignalMessage): Promise<SignalApi.Answer> {
    return this._client.call('offer', {
      id: payload.id.asBuffer(),
      remoteId: payload.remoteId.asBuffer(),
      topic: payload.topic.asBuffer(),
      sessionId: payload.sessionId.asBuffer(),
      data: payload.data
    });
  }

  /**
   * Routes an offer to the other peer's _onSignal callback.
   */
  async signal (payload: SignalApi.SignalMessage): Promise<void> {
    return this._client.emit('signal', {
      id: payload.id.asBuffer(),
      remoteId: payload.remoteId.asBuffer(),
      topic: payload.topic.asBuffer(),
      sessionId: payload.sessionId.asBuffer(),
      data: payload.data
    });
  }
}

export namespace SignalApi {
  export enum State {
    NOT_CONNECTED = 'NOT_CONNECTED',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    ERROR = 'ERROR',
    DISCONNECTED = 'DISCONNECTED',
  }

  export interface Status {
    host: string,
    state: State,
    error?: Error
  }

  export interface CommandTrace {
    messageId: string
    host: string
    time: number
    method: string
    payload: any
    response?: any
    error?: string
  }

  // TODO(marik-d): Define more concrete types for offer/answer.
  export interface SignalMessage {
    id: PublicKey
    remoteId: PublicKey,
    topic: PublicKey,
    sessionId: PublicKey,
    data: SignalData,
  }

  export interface Answer {
    accept: boolean
  }
}
