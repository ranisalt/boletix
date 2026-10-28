/**
 * Reads `read` after every `wait`, forever, yielding a value only when it differs from the last
 * one yielded, so a live stream sends nothing while the data stays the same.
 */
export async function* changes<T>(read: () => Promise<T>, wait: () => Promise<void>) {
  let last: string | undefined;
  while (true) {
    const value = await read();
    const json = JSON.stringify(value);
    if (json !== last) {
      last = json;
      yield value;
    }
    await wait();
  }
}
