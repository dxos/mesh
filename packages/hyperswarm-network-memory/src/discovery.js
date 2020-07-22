//
// Copyright 2020 DXOS.org
//

import through from 'through2';
import duplexify from 'duplexify';

/**
 * Discovery
 *
 * Class in charge to do the lookup (in memory) of peers in the network with a topic in common.

 */
class Discovery {
  /**
   * constructor
   *
   * @returns {undefined}
   */
  constructor () {
    this._peersByTopic = new Map();
  }

  /**
   * Lookup process.
   *
   * When a new peer joins to a topic the lookup get the list of peers for that topic
   * and for each peer is going to try to establish a connection with the new peer.
   *
   * @param {Object} info
   * @param {Buffer} info.peerId
   * @param {Buffer} info.topic
   * @param {function(socket, details)} cb
   * @returns {undefined}
   */
  lookup (info, cb) {
    const { peerId, topic: bufferTopic } = info;

    const hexTopic = bufferTopic.toString('hex');

    let peers;
    if (this._peersByTopic.has(hexTopic)) {
      peers = this._peersByTopic.get(hexTopic);
    } else {
      peers = new Map();
      this._peersByTopic.set(hexTopic, peers);
    }

    if (peers.has(peerId)) {
      return;
    }

    peers.forEach((remoteCallback, remotePeerId) => {
      const socket1 = duplexify(through());
      const socket2 = duplexify(through());

      process.nextTick(() => {
        socket1.setReadable(socket2._writable);
        socket2.setReadable(socket1._writable);

        process.nextTick(() => {
          if (socket1.destroyed) return;

          cb(socket1, {
            id: remotePeerId,
            type: 'tcp',
            client: true, // Boolean. If true, the connection was initiated by this node.
            peer: {
              topic: bufferTopic
            }
          });
        });

        process.nextTick(() => {
          if (socket2.destroyed) return;

          remoteCallback(socket2, {
            id: peerId,
            type: 'tcp',
            client: false,
            peer: {
              topic: bufferTopic
            }
          });
        });
      });
    });

    peers.set(peerId, cb);
  }

  /**
   * Delete a peer from the lookup for a specific topic.
   *
   * @param {Object} info
   * @param {Buffer} info.peerId
   * @param {Buffer} info.topic
   * @returns {undefined}
   */
  leave (info) {
    const { peerId, topic: bufferTopic } = info;
    const hexTopic = bufferTopic.toString('hex');

    if (!this._peersByTopic.has(hexTopic)) {
      return;
    }

    const peers = this._peersByTopic.get(hexTopic);
    peers.delete(peerId);
  }
}

export { Discovery };
