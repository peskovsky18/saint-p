import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Opaque Lambert/Standard materials that look identical can share one draw
 * call even when they are separate objects (many builders create a fresh
 * material per box). Transparent / basic materials are often animated through
 * a shared reference, so those only merge with their own instance.
 */
function materialKey(mat: THREE.Material): string {
  const m = mat as THREE.MeshLambertMaterial;
  if ((m.isMeshLambertMaterial || (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) && !m.transparent) {
    return [
      mat.type,
      m.color?.getHexString(),
      m.emissive?.getHexString(),
      m.flatShading,
      m.map?.uuid ?? '',
      m.side,
      m.vertexColors
    ].join(':');
  }
  return mat.uuid;
}

/**
 * Bake every static descendant mesh of `root` into one mesh per material and
 * shadow setup, in `root`'s local space. Subtrees listed in `keep` (moving
 * bridge wings, animated effects) and hidden subtrees are left untouched.
 *
 * Hand-modelled ensembles are built from thousands of boxes; merging them cuts
 * draw calls by orders of magnitude without changing a single pixel.
 * Returns the number of meshes that were merged away.
 */
export function mergeStaticMeshes(root: THREE.Object3D, keep: Set<THREE.Object3D> = new Set()): number {
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const local = new THREE.Matrix4();

  const buckets = new Map<string, { material: THREE.Material; mesh: THREE.Mesh; geos: THREE.BufferGeometry[]; sources: THREE.Mesh[] }>();
  const mergedSet = new Set<THREE.Object3D>();

  const visit = (o: THREE.Object3D) => {
    if (keep.has(o) || !o.visible) return;
    for (const c of o.children) visit(c);

    const mesh = o as THREE.Mesh;
    if (o === root || !mesh.isMesh) return;
    // Removing this mesh would also drop any child that stays separate
    if (!o.children.every((c) => mergedSet.has(c))) return;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (Array.isArray(mesh.material) || mesh.morphTargetInfluences) return;

    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    g.clearGroups(); // single material: per-face groups (BoxGeometry has six) are irrelevant
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();

    local.multiplyMatrices(rootInv, mesh.matrixWorld);
    g.applyMatrix4(local);
    if (local.determinant() < 0) {
      // Mirrored transform: restore counter-clockwise winding
      for (const attr of Object.values(g.attributes) as THREE.BufferAttribute[]) {
        const a = attr.array as Float32Array, s = attr.itemSize;
        for (let t = 0; t < attr.count; t += 3) {
          for (let k = 0; k < s; k++) {
            const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k;
            const tmp = a[i1]; a[i1] = a[i2]; a[i2] = tmp;
          }
        }
      }
    }

    const attrs = Object.keys(g.attributes).sort().join(',');
    const key = `${materialKey(mesh.material)}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}|${attrs}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: mesh.material, mesh, geos: [], sources: [] };
      buckets.set(key, bucket);
    }
    bucket.geos.push(g);
    bucket.sources.push(mesh);
    mergedSet.add(mesh);
  };
  visit(root);

  let removed = 0;
  for (const { material, mesh, geos, sources } of buckets.values()) {
    const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!geo) continue; // incompatible attributes: leave the originals in place
    if (geos.length > 1) geos.forEach((g) => g.dispose());
    const out = new THREE.Mesh(geo, material);
    out.name = `${root.name || 'group'}-merged`;
    out.castShadow = mesh.castShadow;
    out.receiveShadow = mesh.receiveShadow;
    out.renderOrder = mesh.renderOrder;
    root.add(out);
    for (const m of sources) m.removeFromParent();
    removed += sources.length;
  }
  return removed;
}

/**
 * Split one city-wide static Mesh / LineSegments into square ground tiles so
 * frustum culling (camera and shadow camera) can skip what is off screen.
 * Primitives are assigned to the tile containing their centroid. Material and
 * shadow flags are shared; the source geometry is disposed.
 */
export function splitIntoTiles(obj: THREE.Mesh | THREE.LineSegments, tileSize = 600): THREE.Group {
  const out = new THREE.Group();
  out.name = `${obj.name || 'mesh'}-tiles`;
  const src = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry;
  const per = (obj as THREE.LineSegments).isLineSegments ? 2 : 3;
  const pos = src.attributes.position;
  const prims = Math.floor(pos.count / per);

  const tiles = new Map<string, number[]>();
  for (let p = 0; p < prims; p++) {
    let x = 0, z = 0;
    for (let k = 0; k < per; k++) {
      x += pos.getX(p * per + k);
      z += pos.getZ(p * per + k);
    }
    const key = `${Math.floor(x / per / tileSize)},${Math.floor(z / per / tileSize)}`;
    let list = tiles.get(key);
    if (!list) tiles.set(key, (list = []));
    list.push(p);
  }

  const names = Object.keys(src.attributes);
  for (const [key, list] of tiles) {
    const geo = new THREE.BufferGeometry();
    for (const name of names) {
      const a = src.attributes[name] as THREE.BufferAttribute;
      const s = a.itemSize;
      const arr = new (a.array.constructor as Float32ArrayConstructor)(list.length * per * s);
      let o = 0;
      for (const p of list) {
        const start = p * per * s;
        arr.set((a.array as Float32Array).subarray(start, start + per * s), o);
        o += per * s;
      }
      geo.setAttribute(name, new THREE.BufferAttribute(arr, s, a.normalized));
    }
    const part = (obj as THREE.LineSegments).isLineSegments
      ? new THREE.LineSegments(geo, obj.material)
      : new THREE.Mesh(geo, obj.material);
    part.name = `${obj.name || 'tile'}:${key}`;
    part.castShadow = obj.castShadow;
    part.receiveShadow = obj.receiveShadow;
    part.renderOrder = obj.renderOrder;
    out.add(part);
  }
  if (src !== obj.geometry) src.dispose();
  obj.geometry.dispose();
  return out;
}

/** Same as splitIntoTiles, for InstancedMesh: instances are grouped by position. */
export function splitInstancesIntoTiles(mesh: THREE.InstancedMesh, tileSize = 600): THREE.Group {
  const out = new THREE.Group();
  out.name = `${mesh.name || 'instances'}-tiles`;
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const tiles = new Map<string, number[]>();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    v.setFromMatrixPosition(m);
    const key = `${Math.floor(v.x / tileSize)},${Math.floor(v.z / tileSize)}`;
    let list = tiles.get(key);
    if (!list) tiles.set(key, (list = []));
    list.push(i);
  }
  const c = new THREE.Color();
  for (const [key, list] of tiles) {
    const part = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
    list.forEach((src, i) => {
      mesh.getMatrixAt(src, m);
      part.setMatrixAt(i, m);
      if (mesh.instanceColor) {
        mesh.getColorAt(src, c);
        part.setColorAt(i, c);
      }
    });
    part.name = `${mesh.name || 'inst'}:${key}`;
    part.castShadow = mesh.castShadow;
    part.receiveShadow = mesh.receiveShadow;
    part.computeBoundingSphere(); // instanced culling needs the spread of all instances
    out.add(part);
  }
  return out;
}
