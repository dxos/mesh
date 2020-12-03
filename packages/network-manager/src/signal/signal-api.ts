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
    private readonly _id: PublicKey,
    private readonly _onOffer: () => Promise<void>,
    private readonly _onSignal: () => Promise<void>,
  ) {
    this._rpc = nanomessagerpc({
      send: async (data: Uint8Array) => {
        await this._connectTrigger.wait();
        assert(this._socket, 'No socket');
        await promisify(this._socket.send.bind(this._socket))(data)
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
    })
  }

  async connect() {
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

  async join() {

  }

  async leave() {

  }

  async lookup(topic: PublicKey) {
    return this._rpc.send({
      id: this._id.asUint8Array(),
      topic: topic.asUint8Array(),
    })
  }

  async offer() {

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
}
