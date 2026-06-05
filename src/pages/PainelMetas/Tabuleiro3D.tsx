import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import './Tabuleiro3D.css';

extend({ OrbitControls });

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      orbitControls: any;
    }
  }
}

export type VendedorProgresso = {
  id: string;
  nome: string;
  casas: number; // 0..12 - posicao continua = (% da meta do mes) * 12
  cor: string;
};

const CORES = {
  fundo: '#161b27',
  ceuTopo: '#161b27',
  ceuHorizonte: '#2e3a4e',
  painel: '#1f2029',
  texto: '#eeeef2',
  textoSuave: '#b3b5c6',
  laranja: '#fe8026',
  estrada: '#e8720a',
  estradaBorda: '#b85500',
  grama: '#252d3d',
  luzCeu: '#8896a9',
  pele: '#f2c9a1',
  rocha: '#3a4d65',
  rocha2: '#2e3a4e',
  neve: '#b8c0cd',
};

const INICIO = { x: -6.2, z: 12.71 };
const CASAS = [
  { x: -4.52, z: 11.09 }, { x: -1.64, z: 9.41 }, { x: 2.36, z: 7.94 },
  { x: 4.83, z: 5.16 }, { x: 0.8, z: 2.9 }, { x: -3.26, z: 0.51 },
  { x: -0.89, z: -2.48 }, { x: 3.83, z: -4.58 }, { x: 6.41, z: -7.56 },
  { x: 1.64, z: -9.92 }, { x: -2.73, z: -12.44 }, { x: 0.89, z: -15.44 },
];
const FIM = { x: 1.05, z: -18.45 };
const SUBIDA = 6.65;
const Y_BASE = 0.3;
const NUM_MARCAS = 26;
const TOTAL_PONTOS = CASAS.length + 2;
const MONTANHA = {
  x: FIM.x,
  z: FIM.z - 0.25,
  altura: SUBIDA + Y_BASE + 0.85,
  raio: 6.35,
};

function pct(casas: number) {
  return Math.min(Math.max((Number(casas) || 0) / 12, 0), 1);
}

function alturaEm(i: number, total: number) {
  const t = i / (total - 1);
  return Y_BASE + Math.pow(t, 1.35) * SUBIDA;
}

function iniciais(nome: string) {
  const p = String(nome || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

function criarTrilha() {
  const seq = [INICIO, ...CASAS, FIM];
  const pts = seq.map((p, i) => new THREE.Vector3(p.x, alturaEm(i, seq.length), p.z));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.38);
}

function criarFaixaGeo(curva: THREE.CatmullRomCurve3, largura: number, yOff: number, deslocamento = 0) {
  const pts = curva.getPoints(200);
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  pts.forEach((p, idx) => {
    const ant = pts[Math.max(0, idx - 1)];
    const prox = pts[Math.min(pts.length - 1, idx + 1)];
    const dx = prox.x - ant.x;
    const dz = prox.z - ant.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const metade = largura / 2;
    const cx = p.x + nx * deslocamento;
    const cz = p.z + nz * deslocamento;
    const y = p.y + yOff;

    vertices.push(cx + nx * metade, y, cz + nz * metade);
    vertices.push(cx - nx * metade, y, cz - nz * metade);
    uvs.push(0, idx / (pts.length - 1), 1, idx / (pts.length - 1));

    if (idx < pts.length - 1) {
      const a = idx * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function pontoLateral(curva: THREE.CatmullRomCurve3, t: number, deslocamento: number, yOff = 0) {
  const p = curva.getPointAt(t);
  const tang = curva.getTangentAt(t);
  const len = Math.sqrt(tang.x * tang.x + tang.z * tang.z) || 1;
  const nx = -tang.z / len;
  const nz = tang.x / len;
  return new THREE.Vector3(p.x + nx * deslocamento, p.y + yOff, p.z + nz * deslocamento);
}

function texturaCeu() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, CORES.ceuTopo);
  grad.addColorStop(0.58, '#1b2231');
  grad.addColorStop(1, CORES.ceuHorizonte);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  const estrelas = [
    [120, 190, 2.2], [260, 130, 1.4], [390, 240, 2], [610, 160, 1.6],
    [770, 230, 2.2], [930, 170, 1.5], [180, 420, 1.8], [350, 390, 1.4],
    [520, 470, 1.7], [720, 410, 1.8], [900, 490, 1.4], [460, 650, 1.2],
    [820, 680, 1.5],
  ];
  estrelas.forEach(([x, y, r], i) => {
    const brilho = 0.55 + (i % 3) * 0.16;
    ctx.fillStyle = `rgba(238,238,242,${brilho})`;
    ctx.shadowColor = 'rgba(238,238,242,0.65)';
    ctx.shadowBlur = r * 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function texturaPlaca(texto: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#ffb15e');
  grad.addColorStop(1, CORES.laranja);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(26, 26);
  ctx.lineTo(448, 26);
  ctx.lineTo(492, 128);
  ctx.lineTo(448, 230);
  ctx.lineTo(26, 230);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffd8a6';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CORES.texto;
  ctx.font = 'bold 82px Arial';
  ctx.fillText(texto, 248, 130);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

function texturaNome(texto: string, cor: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(31,32,41,0.9)';
  ctx.strokeStyle = cor;
  ctx.lineWidth = 8;
  const rr = (ctx as any).roundRect?.bind(ctx);
  ctx.beginPath();
  if (rr) rr(18, 22, 220, 76, 18);
  else ctx.rect(18, 22, 220, 76);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = CORES.texto;
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px Arial';
  ctx.fillText(texto, 128, 72);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function texturaBanner(texto: string) {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 240;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(31,32,41,0.94)';
  ctx.fillRect(0, 0, c.width, c.height);

  if (texto === 'META') {
    const t = 30;
    for (let y = 0; y < c.height; y += t) {
      for (let x = 0; x < c.width; x += t) {
        ctx.fillStyle = ((x + y) / t) % 2 === 0 ? '#f7f7f7' : '#161616';
        ctx.fillRect(x, y, t, t);
      }
    }
  }

  ctx.strokeStyle = CORES.laranja;
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, c.width - 12, c.height - 12);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = texto === 'META' ? '#111111' : CORES.texto;
  ctx.font = `bold ${texto === 'META' ? 76 : 92}px Arial`;
  ctx.fillText(texto, c.width / 2, c.height / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

const SceneBackground: React.FC = () => {
  const { scene } = useThree();
  const tex = useMemo(texturaCeu, []);

  useEffect(() => {
    scene.background = tex;
    scene.fog = null;
    return () => {
      if (scene.background === tex) scene.background = null;
      tex.dispose();
    };
  }, [scene, tex]);

  return null;
};

const MarcasAnimadas: React.FC<{ curva: THREE.CatmullRomCurve3 }> = ({ curva }) => {
  const refs = useRef<(THREE.Mesh | null)[]>(Array(NUM_MARCAS).fill(null));
  const tempo = useRef(0);

  useFrame((_, delta) => {
    tempo.current = (tempo.current + delta * 0.12) % 1;
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const param = ((i / NUM_MARCAS) + tempo.current) % 1;
      const p = curva.getPointAt(param);
      const tang = curva.getTangentAt(param);
      mesh.position.set(p.x, p.y + 0.06, p.z);
      mesh.rotation.y = Math.atan2(tang.x, tang.z);
    });
  });

  return (
    <>
      {Array.from({ length: NUM_MARCAS }, (_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} receiveShadow>
          <boxGeometry args={[0.1, 0.04, 0.48]} />
          <meshStandardMaterial color="#111111" transparent opacity={0.82} roughness={0.38} />
        </mesh>
      ))}
    </>
  );
};

const PilaresPonte: React.FC<{ curva: THREE.CatmullRomCurve3 }> = ({ curva }) => (
  <>
    {Array.from({ length: 19 }, (_, i) => {
      const t = 0.07 + (i / 18) * 0.86;
      const centro = curva.getPointAt(t);
      const altura = centro.y - 0.16;
      if (altura < 0.72) return null;
      const tang = curva.getTangentAt(t);
      const angY = Math.atan2(tang.x, tang.z);
      return (
        <group key={i} position={[centro.x, 0, centro.z]} rotation={[0, angY, 0]}>
          {[-0.64, 0.64].map((x) => (
            <mesh key={x} position={[x, altura / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.08, 0.11, altura, 14]} />
              <meshStandardMaterial color="#8896a9" roughness={0.88} />
            </mesh>
          ))}
          <mesh position={[0, altura + 0.02, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.55, 0.12, 0.28]} />
            <meshStandardMaterial color="#5a6a7e" roughness={0.94} />
          </mesh>
          {altura > 1.8 && (
            <mesh position={[0, 0.04, 0]} receiveShadow>
              <boxGeometry args={[1.45, 0.08, 0.36]} />
              <meshStandardMaterial color="#5a6a7e" roughness={0.94} />
            </mesh>
          )}
        </group>
      );
    })}
  </>
);

const GuardaCorpo: React.FC<{ curva: THREE.CatmullRomCurve3; deslocamento: number }> = ({ curva, deslocamento }) => {
  const trilho = useMemo(() => {
    const pontos = Array.from({ length: 90 }, (_, i) => pontoLateral(curva, i / 89, deslocamento, 0.34));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pontos, false, 'centripetal', 0.22), 150, 0.035, 8, false);
  }, [curva, deslocamento]);

  return (
    <>
      <mesh geometry={trilho} castShadow>
        <meshStandardMaterial color="#f4f0e8" roughness={0.36} metalness={0.28} />
      </mesh>
      {Array.from({ length: 25 }, (_, i) => {
        const t = 0.02 + (i / 24) * 0.96;
        const p = pontoLateral(curva, t, deslocamento, 0.18);
        return (
          <mesh key={i} position={[p.x, p.y, p.z]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.46, 10]} />
            <meshStandardMaterial color="#f4f0e8" roughness={0.36} metalness={0.28} />
          </mesh>
        );
      })}
    </>
  );
};

const Estrada: React.FC<{ curva: THREE.CatmullRomCurve3 }> = ({ curva }) => {
  const sombra = useMemo(() => criarFaixaGeo(curva, 1.85, -0.04), [curva]);
  const estrada = useMemo(() => criarFaixaGeo(curva, 1.42, 0), [curva]);
  const brilhoEsq = useMemo(() => criarFaixaGeo(curva, 0.08, 0.02, -0.44), [curva]);
  const brilhoDir = useMemo(() => criarFaixaGeo(curva, 0.08, 0.02, 0.44), [curva]);

  return (
    <>
      <mesh geometry={sombra} receiveShadow>
        <meshStandardMaterial color={CORES.estradaBorda} roughness={0.86} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={estrada} receiveShadow>
        <meshStandardMaterial color={CORES.estrada} roughness={0.62} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={brilhoEsq}>
        <meshStandardMaterial color="#ffd690" transparent opacity={0.38} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={brilhoDir}>
        <meshStandardMaterial color="#ffd690" transparent opacity={0.28} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      <PilaresPonte curva={curva} />
      <GuardaCorpo curva={curva} deslocamento={-0.86} />
      <GuardaCorpo curva={curva} deslocamento={0.86} />
      <MarcasAnimadas curva={curva} />
    </>
  );
};

const Montanha: React.FC = () => {
  const texMeta = useMemo(() => texturaPlaca('META 100%'), []);
  const { x, z, altura: h, raio: r } = MONTANHA;

  return (
    <group>
      <mesh position={[x, h / 2, z]} castShadow receiveShadow>
        <coneGeometry args={[r, h, 64, 1]} />
        <meshStandardMaterial color={CORES.rocha} roughness={0.96} flatShading />
      </mesh>
      <mesh position={[x, (h * 0.4) / 2, z]} receiveShadow>
        <coneGeometry args={[r * 1.05, h * 0.4, 64, 1]} />
        <meshStandardMaterial color={CORES.rocha2} roughness={0.98} flatShading />
      </mesh>
      <mesh position={[x, h - (h * 0.18) / 2 + 0.06, z]} castShadow>
        <coneGeometry args={[r * 0.22, h * 0.18, 64, 1]} />
        <meshStandardMaterial color={CORES.neve} roughness={0.85} flatShading polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      <mesh position={[x, h + 0.9, z]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 10]} />
        <meshStandardMaterial color={CORES.texto} roughness={0.4} metalness={0.3} />
      </mesh>
      <sprite position={[x, h + 2.1, z]} scale={[2.2, 0.78, 1]}>
        <spriteMaterial map={texMeta} transparent />
      </sprite>
    </group>
  );
};

const PortalMeta: React.FC<{ curva: THREE.CatmullRomCurve3 }> = ({ curva }) => {
  const tex = useMemo(() => texturaBanner('META'), []);
  const ponto = curva.getPointAt(0.985);
  const tang = curva.getTangentAt(0.985);
  const angY = Math.atan2(tang.x, tang.z);

  return (
    <group position={[ponto.x, ponto.y + 0.06, ponto.z]} rotation={[0, angY, 0]}>
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.72, 0.18, 48]} />
        <meshStandardMaterial color="#20362f" roughness={0.85} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * 2.4) / 2, 1.95 / 2, -0.08]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 1.95, 12]} />
          <meshStandardMaterial color={CORES.texto} roughness={0.42} metalness={0.32} />
        </mesh>
      ))}
      <mesh position={[0, 1.7, -0.08]}>
        <planeGeometry args={[2.35, 0.62]} />
        <meshStandardMaterial map={tex} roughness={0.55} side={THREE.DoubleSide} transparent />
      </mesh>
    </group>
  );
};

const PortalLargada: React.FC<{ curva: THREE.CatmullRomCurve3 }> = ({ curva }) => {
  const tex = useMemo(() => texturaBanner('LARGADA'), []);
  const t = 0.02;
  const ponto = curva.getPointAt(t);
  const tang = curva.getTangentAt(t);
  const angY = Math.atan2(tang.x, tang.z);
  const largura = 2.2;
  const alturaPoste = 2.4;

  return (
    <group position={[ponto.x, ponto.y, ponto.z]} rotation={[0, angY, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * largura) / 2, alturaPoste / 2, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, alturaPoste, 16]} />
          <meshStandardMaterial color="#aab0bc" roughness={0.35} metalness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, alturaPoste, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, largura + 0.1, 12]} />
        <meshStandardMaterial color="#aab0bc" roughness={0.35} metalness={0.6} />
      </mesh>
      {[0, Math.PI].map((ry) => (
        <mesh key={ry} position={[0, alturaPoste - 0.36, -0.02]} rotation={[0, ry, 0]}>
          <planeGeometry args={[largura - 0.12, 0.7]} />
          <meshStandardMaterial map={tex} roughness={0.55} side={THREE.FrontSide} transparent />
        </mesh>
      ))}
    </group>
  );
};

const PlacaCasa: React.FC<{ i: number }> = ({ i }) => {
  const casa = CASAS[i];
  const tex = useMemo(() => texturaPlaca(`${Math.round(((i + 1) / 12) * 100)}%`), [i]);
  const lado = i % 2 === 0 ? -1 : 1;
  const y = alturaEm(i + 1, TOTAL_PONTOS);

  return (
    <group position={[casa.x + lado * 0.95, y, casa.z]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.12, 24]} />
        <meshStandardMaterial color={CORES.painel} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.5, 12]} />
        <meshStandardMaterial color={CORES.texto} roughness={0.45} />
      </mesh>
      <sprite position={[0.48 * lado, 1.34, 0]} scale={[1.5, 0.75, 1]}>
        <spriteMaterial map={tex} transparent />
      </sprite>
    </group>
  );
};

const BonecoVendedor: React.FC<{
  v: VendedorProgresso;
  position: [number, number, number];
  onClick?: () => void;
}> = ({ v, position, onClick }) => {
  const [hover, setHover] = React.useState(false);
  const etiqueta = useMemo(() => texturaNome(iniciais(v.nome), v.cor), [v.nome, v.cor]);

  return (
    <group
      position={position}
      onClick={onClick}
      onPointerOver={(e: any) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = 'default';
      }}
      scale={hover ? 1.12 : 1}
    >
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.12, 30]} />
        <meshStandardMaterial color={CORES.painel} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.26, 0.56, 24]} />
        <meshStandardMaterial color={v.cor} roughness={0.42} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color={CORES.pele} roughness={0.5} />
      </mesh>
      {[-0.18, 0.18].map((x) => (
        <mesh key={`braco-${x}`} position={[x, 0.28, 0]} rotation={[0, 0, x < 0 ? 0.35 : -0.35]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.34, 12]} />
          <meshStandardMaterial color={CORES.pele} roughness={0.5} />
        </mesh>
      ))}
      {[-0.08, 0.08].map((x) => (
        <mesh key={`perna-${x}`} position={[x, -0.1, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.34, 12]} />
          <meshStandardMaterial color={CORES.texto} roughness={0.6} />
        </mesh>
      ))}
      <sprite position={[0, 1.28, 0]} scale={[0.9, 0.45, 1]}>
        <spriteMaterial map={etiqueta} transparent />
      </sprite>
    </group>
  );
};

const Controls: React.FC<{ controlsRef: React.MutableRefObject<any>; autoRot: boolean }> = ({ controlsRef, autoRot }) => {
  const { camera, gl } = useThree();

  useFrame(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.set(0, 1.6, -3);
    controlsRef.current.autoRotate = autoRot;
    controlsRef.current.update();
  });

  return (
    <orbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      enableZoom
      minDistance={14}
      maxDistance={44}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2.1}
      autoRotate={autoRot}
      autoRotateSpeed={0.55}
    />
  );
};

const Cena: React.FC<{
  vendedores: VendedorProgresso[];
  onVendedorClick?: (id: string) => void;
  controlsRef: React.MutableRefObject<any>;
  autoRot: boolean;
}> = ({ vendedores, onVendedorClick, controlsRef, autoRot }) => {
  const curva = useMemo(criarTrilha, []);
  const grupos = new Map<number, VendedorProgresso[]>();

  vendedores.forEach((v) => {
    const bucket = Math.round(pct(v.casas) * 16);
    if (!grupos.has(bucket)) grupos.set(bucket, []);
    grupos.get(bucket)!.push(v);
  });

  return (
    <>
      <SceneBackground />
      <ambientLight intensity={0.78} />
      <hemisphereLight args={[CORES.luzCeu, CORES.grama, 0.45]} />
      <directionalLight
        position={[6, 14, 9]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={18}
        shadow-camera-bottom={-22}
        shadow-camera-far={55}
      />
      <directionalLight position={[-6, 5, -4]} intensity={0.22} />

      <mesh position={[0, -0.08, -5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[54, 46]} />
        <shadowMaterial color="#000000" opacity={0.16} transparent />
      </mesh>

      <Montanha />
      <Estrada curva={curva} />
      <PortalLargada curva={curva} />
      <PortalMeta curva={curva} />
      {CASAS.map((_, i) => <PlacaCasa key={i} i={i} />)}

      {Array.from(grupos.entries()).map(([, lista]) => {
        const n = lista.length;
        return lista.map((v, k) => {
          const t = 0.02 + pct(v.casas) * 0.96;
          const lateral = (k - (n - 1) / 2) * 0.48;
          const p = pontoLateral(curva, t, lateral, 0.26);
          return (
            <BonecoVendedor
              key={v.id}
              v={v}
              position={[p.x, p.y, p.z]}
              onClick={onVendedorClick ? () => onVendedorClick(v.id) : undefined}
            />
          );
        });
      })}

      <Controls controlsRef={controlsRef} autoRot={autoRot} />
    </>
  );
};

export const Tabuleiro3D: React.FC<{
  vendedores: VendedorProgresso[];
  onVendedorClick?: (id: string) => void;
}> = ({ vendedores, onVendedorClick }) => {
  const controlsRef = useRef<any>(null);
  const [autoRot, setAutoRot] = React.useState(true);

  function zoomIn() {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    ctrl.object.position.multiplyScalar(0.85);
    ctrl.update();
  }

  function zoomOut() {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    ctrl.object.position.multiplyScalar(1.18);
    ctrl.update();
  }

  function toggleRot() {
    setAutoRot((atual) => !atual);
  }

  return (
    <div className="tabuleiro3d-wrap">
      <div className="tabuleiro3d-botoes">
        <button type="button" className="tabuleiro3d-btn" title="Zoom in" onClick={zoomIn}>＋</button>
        <button type="button" className="tabuleiro3d-btn" title="Zoom out" onClick={zoomOut}>－</button>
        <button
          type="button"
          className={`tabuleiro3d-btn${autoRot ? ' tabuleiro3d-btn--ativo' : ''}`}
          title={autoRot ? 'Parar rotação' : 'Girar automaticamente'}
          onClick={toggleRot}
        >
          ↻
        </button>
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 16, 30], fov: 46, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}>
          <Cena
            vendedores={vendedores}
            onVendedorClick={onVendedorClick}
            controlsRef={controlsRef}
            autoRot={autoRot}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
