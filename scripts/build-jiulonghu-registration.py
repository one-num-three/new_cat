"""Build versioned reference controls; preserve original art and historical models."""
from pathlib import Path
import copy, hashlib, json, math, sys
import numpy as np
from scipy.spatial import Delaunay
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent.parent
manifest = sys.argv[sys.argv.index('--controls') + 1] if '--controls' in sys.argv else 'design/maps/seu-jiulonghu-registration-v3/controls.json'
folder = (root / manifest).parent
controls = json.loads((folder / 'controls.json').read_text(encoding='utf8'))
base_bytes = (root / controls['base']).read_bytes()
m = json.loads(base_bytes)
features = json.loads((root / 'design/maps/seu-campuses-v1/jiulonghu-reference.geojson').read_text(encoding='utf8'))['features']
by_id = {f['id']: f for f in features}
xml_nodes = None

def reference(item):
    global xml_nodes
    if item['osmId'].startswith('node/'):
        if xml_nodes is None:
            xml_nodes = {n.attrib['id']: [float(n.attrib['lon']), float(n.attrib['lat'])]
                         for n in ET.parse(root / 'design/maps/seu-campuses-v1/jiulonghu.osm').findall('node')}
        return xml_nodes[item['osmId'].split('/')[1]]
    f = by_id[item['osmId']]
    assert f['geometry']['type'] == 'Polygon'
    ring = f['geometry']['coordinates'][0]
    assert ring[0] == ring[-1]
    return [sum(p[k] for p in ring[:-1]) / (len(ring) - 1) for k in (0, 1)]

def world(ll):
    return [6378137 * math.radians(ll[0]) - m['origin'][0],
            6378137 * math.log(math.tan(math.pi / 4 + math.radians(ll[1]) / 2)) - m['origin'][1]]

anchors = copy.deepcopy(m['anchors'])
for item in controls['additional']:
    ll = reference(item)
    method = ('manual original-art road junction/bridge matched to preserved OSM node; field unverified'
              if item['osmId'].startswith('node/') else
              'manual original-art roof/track centre matched to preserved OSM vertex-mean; field unverified')
    anchors.append(dict(item, id='A' + str(len(anchors) + 1).zfill(2), wgs84=ll, method=method))
worlds = np.array([world(a['wgs84']) for a in anchors])
pixels = np.array([a['pixel'] for a in anchors], dtype=float)
assert np.all(pixels >= 0) and np.all(pixels[:,0] <= m['image']['width']) and np.all(pixels[:,1] <= m['image']['height']), 'Control outside art image'
tri = Delaunay(worlds)
triangles = tri.simplices.tolist()
def det(points):
    return float(np.linalg.det(np.column_stack((points[1] - points[0], points[2] - points[0]))))
folds = [i for i,t in enumerate(triangles) if det(worlds[t]) * det(pixels[t]) >= 0]
assert not folds, folds
edges = sorted({tuple(sorted((t[i],t[(i+1)%3]))) for t in triangles for i in range(3)})
def crosses(e,f):
    if set(e) & set(f):
        return False
    a,b = pixels[list(e)];c,d = pixels[list(f)]
    def side(p,q,r):
        return float((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))
    return side(a,b,c)*side(a,b,d) < -1e-8 and side(c,d,a)*side(c,d,b) < -1e-8
assert not any(crosses(e,f) for i,e in enumerate(edges) for f in edges[i+1:]), 'Image mesh overlaps'
checks = []
for item in controls['checks']:
    q = np.array(world(reference(item)))
    i = int(tri.find_simplex(q))
    assert i >= 0, item['name']
    transform = tri.transform[i]
    bary = transform[:2] @ (q - transform[2])
    predicted = np.r_[bary, 1 - bary.sum()] @ pixels[tri.simplices[i]]
    error = float(np.linalg.norm(predicted - item['pixel']))
    assert error <= item['estimatedManualUncertaintyPx'], (item['name'], error)
    checks.append(dict(item, wgs84=reference(item), predicted=predicted.tolist(), errorPx=error))
m.update(anchors=anchors, world=worlds.tolist(), pixels=pixels.tolist(), triangles=triangles,
         registrationVersion=controls['version'], fieldVerified=False, extrapolation=False,
         sourceBaseSha256=hashlib.sha256(base_bytes).hexdigest(),
         quality=dict(folds=folds, independentImageChecks=checks,
                      note='Two extra image/OSM checks excluded from fitting; NOT independent field GPS validation.'))

if 'coverage' in controls:
    c = controls['coverage']
    ring = np.array([world(ll) for ll in by_id[c['osmId']]['geometry']['coordinates'][0]])
    def inside(p):
        yes = False
        for a,b in zip(ring[:-1],ring[1:]):
            if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]:
                yes = not yes
        return yes
    scale = math.cos(math.radians(float(np.mean([a['wgs84'][1] for a in anchors]))))
    boundary = []
    for a,b in zip(ring[:-1],ring[1:]):
        count = max(1, math.ceil(float(np.linalg.norm(b-a))*scale/c['boundarySamplingM']))
        boundary.extend(a+(b-a)*i/count for i in range(count))
    step = c['interiorGridM']/scale
    interior = [np.array([x,y]) for x in np.arange(ring[:,0].min(),ring[:,0].max()+step,step)
                for y in np.arange(ring[:,1].min(),ring[:,1].max()+step,step) if inside([x,y])]
    samples = np.array([*ring[:-1],*boundary,*interior])
    indices = tri.find_simplex(samples, tol=1e-8)
    assert np.all(indices >= 0), ('Campus uncovered', samples[indices < 0][:10].tolist())
    q = tri.transform[indices,:2] @ (samples-tri.transform[indices,2])[:,:,None]
    b = np.concatenate((q[:,:,0], 1-q[:,:,0].sum(axis=1,keepdims=True)),axis=1)
    mapped = (b[:,:,None]*pixels[tri.simplices[indices]]).sum(axis=1)
    assert np.all(mapped >= 0) and np.all(mapped <= 1254), ('Campus maps outside image', mapped.min(axis=0),mapped.max(axis=0))
    m['quality']['campusCoverage'] = dict(c, sourceSha256=hashlib.sha256((root/c['reference']).read_bytes()).hexdigest(),
        osmXmlSha256=hashlib.sha256((root/'design/maps/seu-campuses-v1/jiulonghu.osm').read_bytes()).hexdigest(),
        boundaryVertices=len(ring)-1, boundarySamples=len(boundary), interiorSamples=len(interior),
        uncovered=0, outsideImage=0, crossingImageEdges=0, mappedBounds=[*mapped.min(axis=0).tolist(),*mapped.max(axis=0).tolist()],
        proof='Every polygon vertex lies inside convex triangulation hull; hence entire polygon is covered. No folds. Dense samples additionally check image bounds; not a GPS accuracy measurement.')
target = folder / 'jiulonghu-registration.json'
content = json.dumps(m, ensure_ascii=False, indent=2) + '\n'
if '--verify' in sys.argv:
    assert target.read_text(encoding='utf8') == content, 'Generated model differs'
else:
    target.write_text(content, encoding='utf8')
print(json.dumps(dict(anchors=len(anchors), triangles=len(triangles), folds=folds, checks=checks,
                     coverage=m['quality'].get('campusCoverage'), fieldVerified=False), ensure_ascii=False))
