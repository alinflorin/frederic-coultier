/// <reference lib="webworker" />
import { BufferAttribute, BufferGeometry } from "three";
import { MeshBVH } from "three-mesh-bvh";

export interface BvhRequest {
  id: number;
  position: Float32Array;
  index: Uint32Array | null;
}

export interface BvhReply {
  id: number;
  serialized: ReturnType<typeof MeshBVH.serialize>;
}

// Builds a raycast BVH off the UI thread. Indirect, so the index order of the geometry is untouched.
self.onmessage = ({ data }: MessageEvent<BvhRequest>) => {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(data.position, 3));
  if (data.index) g.setIndex(new BufferAttribute(data.index, 1));
  const serialized = MeshBVH.serialize(new MeshBVH(g, { indirect: true }), { cloneBuffers: false });
  const transfer: Transferable[] = [...serialized.roots];
  if (serialized.indirectBuffer) transfer.push(serialized.indirectBuffer.buffer);
  const reply: BvhReply = { id: data.id, serialized };
  (self as unknown as Worker).postMessage(reply, transfer);
};
