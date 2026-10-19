import type * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import type { BvhReply, BvhRequest } from "./bvhWorker";

/**
 * Builds raycast BVHs in a worker. The geometry's buffers are views over the whole IPC reply, so
 * only the position and index are copied out (transferring them would detach everything else).
 */
export class BvhBuilder {
  private worker = new Worker(new URL("./bvhWorker.ts", import.meta.url), { type: "module" });
  private pending = new Map<number, (r: BvhReply["serialized"] | null) => void>();
  private next = 0;

  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<BvhReply>) => {
      this.pending.get(data.id)?.(data.serialized);
      this.pending.delete(data.id);
    };
  }

  /** Resolves with a BVH for `geometry` (which is left untouched), or null if disposed meanwhile. */
  build(geometry: THREE.BufferGeometry): Promise<MeshBVH | null> {
    const position = (geometry.getAttribute("position").array as Float32Array).slice();
    const index = geometry.index ? (geometry.index.array as Uint32Array).slice() : null;
    const id = this.next++;
    const request: BvhRequest = { id, position, index };
    const transfer = [position.buffer, ...(index ? [index.buffer] : [])];
    return new Promise((resolve) => {
      this.pending.set(id, (s) => resolve(s && MeshBVH.deserialize(s, geometry, { setIndex: false })));
      this.worker.postMessage(request, transfer);
    });
  }

  dispose() {
    this.worker.terminate();
    for (const done of this.pending.values()) done(null);
    this.pending.clear();
  }
}
