import { Event, Lock, Trigger } from '@dxos/async';
import { throws } from 'assert';
import WebSocket from 'isomorphic-ws'
import nanomessagerpc from 'nanomessage-rpc';
import assert from 'assert';
import { promisify } from 'util'
import { PublicKey } from '@dxos/crypto';
import { SignalData } from 'simple-peer';

/**
 * Establishes a websocket connection to signal server and provides RPC methods.
 */
export class SignalApi {
  private _state = SignalApi.State.NOT_CONNECTED;

  private _socket?: WebSocket;

  private _lastError?: Error;

  private readonly _rpc: any;

  private readonly _connectTrigger = new Trigger();

  /**
   * @param _host Signal server websocket URL.
   * @param _onOffer See `SignalApi.offer`.
   * @param _onSignal See `SignalApi.signal`.
   */
  constructor(
    private readonly _host: string,
    private readonly _onOffer: (message: SignalApi.SignalMessage) => Promise<SignalData>,
    private readonly _onSignal: (message: SignalApi.SignalMessage) => Promise<void>,
  ) {
    this._rpc = nanomessagerpc({
      send: async (data: Uint8Array) => {
        await this._connectTrigger.wait();
        assert(this._socket, 'No socket');
        await promisify(this._socket.send.bind(this._socket) as any)(data)
      },
      subscribe: (next: (data: Uint8Array) => void) => {
        this._connectTrigger.wait().then(() => {
          assert(this._socket, 'No socket');
          this._socket.onmessage = e => {
            assert(e.data instanceof Uint8Array);
            next(e.data);
          }
        });

        return () => {
          if(this._socket) {
            this._socket.onmessage = () => {};
          }
        };
      }
    });
    this._rpc.on('error', console.log)
    this._rpc.actions({
      offer: (message: any) => this._onOffer({
        id: PublicKey.from(message.id),
        remoteId: PublicKey.from(message.remoteId),
        topic: PublicKey.from(message.topic),
        sessionId: PublicKey.from(message.sessionId),
        data: message.data
      }),
    })
    this._rpc.on('signal', (msg: SignalApi.SignalMessage) => this._onSignal({
      id: PublicKey.from(msg.id),
      remoteId: PublicKey.from(msg.remoteId),
      topic: PublicKey.from(msg.topic),
      sessionId: PublicKey.from(msg.sessionId),
      data: msg.data
    }))
    // TODO(marik-d): Bind offer/signal events.
  }

  connect() {
    if(this._state !== SignalApi.State.NOT_CONNECTED) {
      throw new Error('Invalid state');
    }
    this._state = SignalApi.State.CONNECTING;

    this._socket = new WebSocket(this._host);
    this._socket.onopen = () => {
      this._state = SignalApi.State.CONNECTED;
      this._connectTrigger.wake();
    }
    this._socket.onclose = () => {
      this._state = SignalApi.State.DISCONNECTED;
      // TODO(marik-d): Reconnect.
    }
    this._socket.onerror = e => {
      this._state = SignalApi.State.ERROR;
      this._lastError = e.error;
      // TODO(marik-d): Reconnect.
    }
  }

  async close() {
    await this._rpc.close();
    this._socket?.close();
  }

  async join(topic: PublicKey, peerId: PublicKey): Promise<PublicKey[]> {
    await this._rpc.open();
    const peers: Buffer[] = await this._rpc.call('join', {
      id: peerId.asBuffer(),
      topic: topic.asBuffer(),
    })
    return peers.map(id => PublicKey.from(id))
  }

  async leave(topic: PublicKey, peerId: PublicKey): Promise<void> {
    await this._rpc.open();
    await this._rpc.call('leave', {
      id: peerId.asBuffer(),
      topic: topic.asBuffer(),
    })
  }

  async lookup(topic: PublicKey): Promise<PublicKey[]> {
    await this._rpc.open();
    const peers: Buffer[] = await this._rpc.call('lookup', {
      topic: topic.asBuffer(),
    })
    return peers.map(id => PublicKey.from(id))
  }

  /**
   * Routes an offer to the other peer's _onOffer callback.
   * @returns Other peer's _onOffer callback return value.
   */
  async offer(payload: SignalApi.SignalMessage): Promise<SignalData> {
    await this._rpc.open();
    return this._rpc.call('offer', {
      id: payload.id.asBuffer(),
      remoteId: payload.remoteId.asBuffer(),
      topic: payload.topic.asBuffer(),
      sessionId: payload.sessionId.asBuffer(),
      data: payload.data,
    })
  }

  /**
   * Routes an offer to the other peer's _onSignal callback.
   */
  async signal(payload: SignalApi.SignalMessage): Promise<void> {
    await this._rpc.open();
    return this._rpc.emit('signal', {
      id: payload.id.asBuffer(),
      remoteId: payload.remoteId.asBuffer(),
      topic: payload.topic.asBuffer(),
      sessionId: payload.sessionId.asBuffer(),
      data: payload.data,
    })
  }
}

export namespace SignalApi {
  export enum State {
    NOT_CONNECTED,
    CONNECTING,
    CONNECTED,
    ERROR,
    DISCONNECTED,
  }

  // TODO(marik-d): Define more concrete types for offer/answer.
  export interface SignalMessage {
    id: PublicKey
    remoteId: PublicKey,
    topic: PublicKey,
    sessionId: PublicKey,
    data: SignalData,
  }
}
