import { Event, Lock, Trigger } from '@dxos/async';
import { throws } from 'assert';
import WebSocket from 'isomorphic-ws'
import nanomessagerpc from 'nanomessage-rpc';
import assert from 'assert';
import { promisify } from 'util'
import { PublicKey } from '@dxos/crypto';

export class SignalApi {
  private _state = SignalApi.State.NOT_CONNECTED;

  private _socket?: WebSocket;

  private _lastError?: Error;

  private readonly _rpc: any;

  private readonly _connectTrigger = new Trigger();

  constructor(
    private readonly _host: string,
    private readonly _onOffer: (message: any) => Promise<void>,
    private readonly _onSignal: () => Promise<void>,
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
      offer: (message: any) => this._onOffer(message),
    })
    // TODO(marik-d): Bind offer/signal events.
  }

  connect() {
    if(this._state !== SignalApi.State.NOT_CONNECTED) {
      throw new Error('Invalid state');
    }
    this._state = SignalApi.State.CONNECTING;

    this._socket = new WebSocket(this._host);
    this._socket.onopen = () => {
      console.log('OPEN')
      this._state = SignalApi.State.CONNECTED;
      this._connectTrigger.wake();
    }
    this._socket.onclose = () => {
      console.log('CLOSE')
      this._state = SignalApi.State.DISCONNECTED;
      // TODO(marik-d): Reconnect.
    }
    this._socket.onerror = e => {
      console.log('ERROR', e)
      this._state = SignalApi.State.ERROR;
      this._lastError = e.error;
      // TODO(marik-d): Reconnect.
    }
  }

  async join(topic: PublicKey, peerId: PublicKey): Promise<PublicKey[]> {
    await this._rpc.open();
    const peers: Buffer[] = await this._rpc.call('join', {
      id: peerId.asBuffer(),
      topic: topic.asBuffer(),
    })
    return peers.map(id => PublicKey.from(id))
  }

  async leave() {

  }

  async lookup(topic: PublicKey): Promise<PublicKey[]> {
    await this._rpc.open();
    const peers: Buffer[] = await this._rpc.call('lookup', {
      topic: topic.asBuffer(),
    })
    return peers.map(id => PublicKey.from(id))
  }

  async offer(payload: SignalApi.OfferPayload) {
    // await this._rpc.open();
    // return this._rpc.call('offer', )
  }

  async signal() {

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

  export interface OfferPayload {
    remoteId: Uint8Array,
    topic: Uint8Array,
    sessionId: Uint8Array,
    data: any[],
  }
}
