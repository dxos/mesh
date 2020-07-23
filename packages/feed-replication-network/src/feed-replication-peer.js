//
// Copyright 2020 DXOS.org
//

import debug from 'debug';
import eos from 'end-of-stream';
import ram from 'random-access-memory';
import pify from 'pify';

import { discoveryKey } from '@dxos/crypto';
import { FeedStore } from '@dxos/feed-store';
import { Protocol } from '@dxos/protocol';
import { DefaultReplicator } from '@dxos/protocol-plugin-replicator';

const log = debug('dxos:feed-replication-network');

class FeedReplicationPeer {
  // TODO(dboreham): Rewrite to be a class (code copied from @dxos/protocol test), factor out message handling code into test class.

  /**
   *
   * @param topic {Key}
   * @param peerId {Key}
   * @returns {Promise<FeedReplicationPeer>}
   */
  static async create (topic, peerId) {
    // TODO(dboreham): Allow specification of storage type
    const feedStore = await FeedStore.create(ram, { feedOptions: { valueEncoding: 'json' } });
    const feed = await feedStore.openFeed('/feed', { metadata: { topic: topic.toString('hex') } });
    const append = pify(feed.append.bind(feed));
    let closed = false;

    const replicator = new DefaultReplicator({
      feedStore,
      onLoad: () => [feed],
      onUnsubscribe: () => {
        closed = true;
      }
    });

    return {
      id: peerId,
      getFeeds () {
        return feedStore.getOpenFeeds();
      },
      getDescriptors () {
        return feedStore.getDescriptors();
      },
      createStream () {
        return new Protocol({
          streamOptions: {
            live: true
          }
        })
          .setSession({ id: 'session1' })
          .setContext({ name: 'foo' })
          .setExtensions([replicator.createExtension()])
          .init(discoveryKey(topic))
          .stream;
      },
      append (msg) {
        return append(msg);
      },
      getMessages () {
        const messages = [];
        const stream = feedStore.createReadStream();
        stream.on('data', (data) => {
          log(`Got data: ${JSON.stringify(data)}`);
          messages.push(data);
        });
        return new Promise((resolve, reject) => {
          eos(stream, (err) => {
            if (err) {
              reject(err);
            } else {
              log(`Returning ${messages.length} messages`);
              resolve(messages);
            }
          });
        });
      },
      isClosed () {
        return closed;
      }
    };
  }
}

export const FeedReplicationPeerFactory = async (topic, peerId) => {
  const result = await FeedReplicationPeer.create(topic, peerId);
  return result;
};
