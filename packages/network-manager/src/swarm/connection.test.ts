import { sleep } from "@dxos/async"
import { PublicKey } from "@dxos/crypto"
import { Protocol } from "@dxos/protocol"
import { expect } from "earljs"
import { Connection } from "./connection"

describe('Connection', () => {
  // This doesn't clean up correctly and crashes with SIGSEGV at the end. Probably an issue with wrtc package.
  it('open and close', async () => {
    const connection = new Connection(
      true,
      new Protocol(),
      PublicKey.random(),
      PublicKey.random(),
      PublicKey.random(),
      PublicKey.random(),
      async msg => {},
    )

    expect(connection.state).toEqual(Connection.State.INITIATING_CONNECTION);

    await sleep(10); // Let simple-peer process events 
    await connection.close();

    expect(connection.state).toEqual(Connection.State.CLOSED);
  });
});
