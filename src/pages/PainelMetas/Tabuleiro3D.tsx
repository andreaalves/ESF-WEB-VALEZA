import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, extend, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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
  casas: number; // 0..12
  cor: string;
};

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const CORES = {
  fundo: '#181b23',
  painel: '#1f2029',
  painel2: '#353646',
  borda: '#4b4d63',
  texto: '#eeeef2',
  textoSuave: '#b3b5c6',
  laranja: '#fe8026',
  estrada: '#e8720a',
  estradaBorda: '#b85500',
  grama: '#22433b',
  grama2: '#2f5a4d',
  tronco: '#6c4a2a',
  copa: '#2f8f69',
  copa2: '#59b88d',
  ceu: '#4f947f',
  luzCeu: '#9fd7c3',
  nuvem: '#f4f7fb',
  lago: '#5cb7d8',
  lagoBorda: '#2f8fa8',
  passaro: '#2f3b4d',
  pele: '#f2c9a1',
  pedra: '#c4c9c0',
  flor1: '#ffd15c',
  flor2: '#f1657a',
  flor3: '#f5f0d8',
  colina: '#3f7967',
  colina2: '#6fb795',
};

const MODELOS_3D = {
  vendedor: '', // exemplo: '/models/metas/vendedor.glb'
  placa: '', // exemplo: '/models/metas/placa.glb'
  arvore: '', // exemplo: '/models/metas/arvore.glb'
  vaca: '', // exemplo: '/models/metas/vaca.glb'
  lago: '', // exemplo: '/models/metas/lago.glb'
};

const MOSTRAR_CENARIO = false;
const MOSTRAR_INICIO_CHEGADA = true;

const INICIO = { x: -6.20, z: 12.71 };

const CASAS = [
  { i: 1, x: -4.52, z: 11.09 },
  { i: 2, x: -1.64, z: 9.41 },
  { i: 3, x: 2.36, z: 7.94 },
  { i: 4, x: 4.83, z: 5.16 },
  { i: 5, x: 0.80, z: 2.90 },
  { i: 6, x: -3.26, z: 0.51 },
  { i: 7, x: -0.89, z: -2.48 },
  { i: 8, x: 3.83, z: -4.58 },
  { i: 9, x: 6.41, z: -7.56 },
  { i: 10, x: 1.64, z: -9.92 },
  { i: 11, x: -2.73, z: -12.44 },
  { i: 12, x: 0.89, z: -15.44 },
];

const ARVORES = [
  [-5.4, 5.7], [-5.8, 3.8], [-4.75, 1.5], [-5.55, -1.15],
  [-4.35, -3.35], [-5.05, -5.55], [-3.8, -7.15], [4.8, 5.25],
  [5.55, 3.05], [4.7, 0.85], [5.6, -1.9], [4.55, -4.5],
  [5.25, -6.95], [2.9, -8.55],
] as Array<[number, number]>;

const NUVENS = [
  [-4.2, 5.45, -9.2], [-0.2, 5.95, -10.2], [4.15, 5.55, -9.1],
] as Array<[number, number, number]>;

const VACAS = [
  { x: -4.3, z: 0.15, delay: 0 },
  { x: 3.9, z: 3.85, delay: 1.6 },
  { x: 3.55, z: -5.65, delay: 3.1 },
];

const PASSAROS = [
  { x: -3.9, y: 4.95, z: -6.7, delay: 0 },
  { x: -1.2, y: 5.35, z: -7.9, delay: 1.1 },
  { x: 2.85, y: 5.05, z: -6.9, delay: 2.4 },
  { x: 4.45, y: 4.7, z: -4.8, delay: 3.2 },
];

const PEDRAS = [
  [-3.8, 4.8, 0.8], [2.45, 4.8, 0.65], [-2.9, 1.95, 0.55], [3.95, 0.1, 0.75],
  [-3.35, -2.6, 0.6], [2.95, -3.0, 0.55], [-2.85, -6.9, 0.78], [2.25, -7.8, 0.6],
] as Array<[number, number, number]>;

const FLORES = [
  [-4.65, 2.95, 0], [-4.25, 2.55, 1], [-3.95, -0.95, 2], [3.95, 2.3, 1],
  [4.35, -0.85, 0], [3.25, -6.45, 2], [-3.4, -5.0, 1], [-4.95, -6.4, 0],
] as Array<[number, number, number]>;

const COLINAS = [
  [-5.8, -9.6, 4.2, CORES.colina],
  [-1.8, -10.4, 5.4, CORES.colina2],
  [3.9, -9.8, 4.7, CORES.colina],
] as Array<[number, number, number, string]>;

function casaPos(casas: number) {
  if (casas <= 0) return INICIO;
  const casa = CASAS[Math.min(Math.max(casas, 1), 12) - 1];
  return { x: casa.x, z: casa.z };
}

function iniciais(nome: string) {
  const p = String(nome || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

const ModeloGLB: React.FC<{
  url: string;
  escala?: number | [number, number, number];
  posicao?: [number, number, number];
  rotacao?: [number, number, number];
}> = ({ url, escala = 1, posicao = [0, 0, 0], rotacao = [0, 0, 0] }) => {
  const gltf = useLoader(GLTFLoader, url) as any;
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return clone;
  }, [gltf]);

  return <primitive object={scene} position={posicao} rotation={rotacao} scale={escala} />;
};

function criarTrilha() {
  const pontos = [INICIO, ...CASAS, { x: 3.26, z: -17.96 }].map((p) => new THREE.Vector3(p.x, 0.06, p.z));
  return new THREE.CatmullRomCurve3(pontos, false, 'centripetal', 0.38);
}

function criarFaixa(curva: THREE.CatmullRomCurve3, largura: number, y: number, deslocamento = 0) {
  const pts = curva.getPoints(180);
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

function texturaBandeira(n: number) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, CORES.laranja);
  grad.addColorStop(1, '#d95f11');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(26, 26);
  ctx.lineTo(448, 26);
  ctx.lineTo(492, 128);
  ctx.lineTo(448, 230);
  ctx.lineTo(26, 230);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = CORES.texto;
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = CORES.texto;
  ctx.font = 'bold 82px Arial';
  ctx.fillText(String(n), 145, 116);
  ctx.font = 'bold 68px Arial';
  ctx.fillText(MESES[n - 1], 280, 168);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

function texturaNome(texto: string, cor: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = 'rgba(24,27,35,0.88)';
  ctx.strokeStyle = cor;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect?.(18, 22, 220, 76, 18);
  if (!ctx.roundRect) {
    ctx.rect(18, 22, 220, 76);
  }
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

function texturaFaixa(texto: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = 'rgba(24,27,35,0.92)';
  ctx.beginPath();
  ctx.moveTo(30, 30);
  ctx.lineTo(482, 30);
  ctx.lineTo(448, 80);
  ctx.lineTo(482, 130);
  ctx.lineTo(30, 130);
  ctx.lineTo(64, 80);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = CORES.laranja;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = CORES.texto;
  ctx.textAlign = 'center';
  ctx.font = 'bold 62px Arial';
  ctx.fillText(texto, 256, 102);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function texturaCeu() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#c9e0fb');
  grad.addColorStop(0.48, '#a8cfcd');
  grad.addColorStop(1, CORES.ceu);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 2;
  return tex;
}

const Ceu: React.FC = () => {
  const tex = useMemo(texturaCeu, []);
  return (
    <mesh position={[0, 5.4, -16]} rotation={[0, 0, 0]}>
      <planeGeometry args={[34, 13]} />
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} />
    </mesh>
  );
};

const NUM_MARCAS = 28;

const MarcasAnimadas: React.FC<{ curva: THREE.CatmullRomCurve3 }> = ({ curva }) => {
  const refs = useRef<(THREE.Mesh | null)[]>(Array(NUM_MARCAS).fill(null));
  const tempo = useRef(0);

  useFrame((_, delta) => {
    tempo.current = (tempo.current + delta * 0.14) % 1;
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const param = ((i / NUM_MARCAS) + tempo.current) % 1;
      const p = curva.getPointAt(param);
      const tang = curva.getTangentAt(param);
      mesh.position.set(p.x, 0.12, p.z);
      mesh.rotation.y = Math.atan2(tang.x, tang.z);
    });
  });

  return (
    <>
      {Array.from({ length: NUM_MARCAS }, (_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} receiveShadow>
          <boxGeometry args={[0.10, 0.04, 0.48]} />
          <meshStandardMaterial color="#111111" transparent opacity={0.82} roughness={0.38} />
        </mesh>
      ))}
    </>
  );
};

const Estrada: React.FC = () => {
  const curva = useMemo(criarTrilha, []);
  const sombra = useMemo(() => criarFaixa(curva, 1.85, 0.028), [curva]);
  const estrada = useMemo(() => criarFaixa(curva, 1.42, 0.07), [curva]);
  const brilhoEsq = useMemo(() => criarFaixa(curva, 0.08, 0.092, -0.44), [curva]);
  const brilhoDir = useMemo(() => criarFaixa(curva, 0.08, 0.092, 0.44), [curva]);

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
      <MarcasAnimadas curva={curva} />
    </>
  );
};

const BandeiraCasa: React.FC<{ i: number }> = ({ i }) => {
  const casa = CASAS[i];
  const tex = useMemo(() => texturaBandeira(i + 1), [i]);
  const lado = i % 2 === 0 ? -1 : 1;
  const x = casa.x + lado * 0.95;
  const z = casa.z + (i < 4 ? -0.2 : i > 8 ? 0.25 : 0);

  return (
    <group position={[x, 0.08, z]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.12, 24]} />
        <meshStandardMaterial color={CORES.painel} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.5, 12]} />
        <meshStandardMaterial color={CORES.texto} roughness={0.45} />
      </mesh>
      {MODELOS_3D.placa && (
        <ModeloGLB url={MODELOS_3D.placa} posicao={[0.48 * lado, 1.2, -0.03]} escala={0.58} />
      )}
      <sprite position={[0.48 * lado, 1.34, 0]} scale={[1.55, 0.78, 1]}>
        <spriteMaterial map={tex} transparent />
      </sprite>
    </group>
  );
};

function texturaBanner(tipo: 'INICIO' | 'CHEGADA') {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const ctx = c.getContext('2d')!;
  const isChegada = tipo === 'CHEGADA';

  // fundo branco
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, 1024, 320);

  // blocos xadrez nas pontas (esquerda e direita)
  const xadrezLargura = 160;
  const tamBloco = 40;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < xadrezLargura / tamBloco; col++) {
      if ((row + col) % 2 === 0) {
        // esquerda
        ctx.fillStyle = '#111';
        ctx.fillRect(col * tamBloco, row * tamBloco, tamBloco, tamBloco);
        // direita
        ctx.fillRect(1024 - xadrezLargura + col * tamBloco, row * tamBloco, tamBloco, tamBloco);
      }
    }
  }

  // borda preta
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 1010, 306);

  // texto central
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111';
  ctx.font = `bold 148px Arial Black, Arial`;
  ctx.fillText(isChegada ? 'CHEGADA' : 'PARTIDA', 512, 160);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

function texturaXadrezChao() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 256, 256);
  const t = 32;
  for (let r = 0; r < 256 / t; r++) {
    for (let col = 0; col < 256 / t; col++) {
      if ((r + col) % 2 === 0) {
        ctx.fillStyle = '#111';
        ctx.fillRect(col * t, r * t, t, t);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

// Calcula o ângulo da estrada num ponto da curva (para orientar o portal perpendicular à pista)
function anguloEstradaEm(curva: THREE.CatmullRomCurve3, t: number) {
  const tang = curva.getTangentAt(t);
  return Math.atan2(tang.x, tang.z);
}

const PortalInicioChegada: React.FC<{ tipo: 'INICIO' | 'CHEGADA'; curva: THREE.CatmullRomCurve3 }> = ({ tipo, curva }) => {
  const texBanner = useMemo(() => texturaBanner(tipo), [tipo]);
  const texChao = useMemo(texturaXadrezChao, []);

  // INICIO fica antes da casa 1 (t≈0.03), CHEGADA depois da casa 12 (t≈0.97)
  const t = tipo === 'INICIO' ? 0.025 : 0.975;
  const ponto = curva.getPointAt(t);
  const angY = anguloEstradaEm(curva, t);

  // largura da porta (perpendicular à estrada)
  const largura = 2.2;
  const alturaPoste = 2.6;
  const rPoste = 0.07;

  return (
    <group position={[ponto.x, 0, ponto.z]} rotation={[0, angY, 0]}>
      {/* Faixa xadrez no chão */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largura * 1.1, 0.9]} />
        <meshStandardMaterial map={texChao} roughness={0.65} transparent opacity={0.92} />
      </mesh>

      {/* Poste esquerdo */}
      <mesh position={[-largura / 2, alturaPoste / 2, 0]} castShadow>
        <cylinderGeometry args={[rPoste, rPoste, alturaPoste, 16]} />
        <meshStandardMaterial color="#aab0bc" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* Base poste esquerdo */}
      <mesh position={[-largura / 2, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.16, 16]} />
        <meshStandardMaterial color="#888e9a" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Topo poste esquerdo */}
      <mesh position={[-largura / 2, alturaPoste + 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.1, rPoste, 0.12, 16]} />
        <meshStandardMaterial color="#aab0bc" roughness={0.35} metalness={0.6} />
      </mesh>

      {/* Poste direito */}
      <mesh position={[largura / 2, alturaPoste / 2, 0]} castShadow>
        <cylinderGeometry args={[rPoste, rPoste, alturaPoste, 16]} />
        <meshStandardMaterial color="#aab0bc" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* Base poste direito */}
      <mesh position={[largura / 2, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.16, 16]} />
        <meshStandardMaterial color="#888e9a" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Topo poste direito */}
      <mesh position={[largura / 2, alturaPoste + 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.1, rPoste, 0.12, 16]} />
        <meshStandardMaterial color="#aab0bc" roughness={0.35} metalness={0.6} />
      </mesh>

      {/* Barra horizontal superior */}
      <mesh position={[0, alturaPoste, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, largura + 0.1, 12]} />
        <meshStandardMaterial color="#aab0bc" roughness={0.35} metalness={0.6} />
      </mesh>

      {/* Banner */}
      <mesh position={[0, alturaPoste - 0.38, -0.02]} castShadow receiveShadow>
        <planeGeometry args={[largura - 0.12, 0.72]} />
        <meshStandardMaterial map={texBanner} roughness={0.55} side={THREE.DoubleSide} transparent />
      </mesh>
    </group>
  );
};

const BonecoVendedor: React.FC<{ v: VendedorProgresso; x: number; z: number; onClick?: () => void }> = ({
  v,
  x,
  z,
  onClick,
}) => {
  const [hover, setHover] = React.useState(false);
  const etiqueta = useMemo(() => texturaNome(iniciais(v.nome), v.cor), [v.nome, v.cor]);

  return (
    <group
      position={[x, 0.34, z]}
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
      {MODELOS_3D.vendedor && <ModeloGLB url={MODELOS_3D.vendedor} escala={0.58} posicao={[0, -0.2, 0]} />}
      {!MODELOS_3D.vendedor && (
        <>
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
      <mesh position={[-0.18, 0.28, 0]} rotation={[0, 0, 0.35]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.34, 12]} />
        <meshStandardMaterial color={CORES.pele} roughness={0.5} />
      </mesh>
      <mesh position={[0.18, 0.28, 0]} rotation={[0, 0, -0.35]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.34, 12]} />
        <meshStandardMaterial color={CORES.pele} roughness={0.5} />
      </mesh>
      <mesh position={[-0.08, -0.1, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.34, 12]} />
        <meshStandardMaterial color={CORES.texto} roughness={0.6} />
      </mesh>
      <mesh position={[0.08, -0.1, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.34, 12]} />
        <meshStandardMaterial color={CORES.texto} roughness={0.6} />
      </mesh>
        </>
      )}
      <sprite position={[0, 1.28, 0]} scale={[0.9, 0.45, 1]}>
        <spriteMaterial map={etiqueta} transparent />
      </sprite>
    </group>
  );
};

const Arvore: React.FC<{ x: number; z: number; escala?: number }> = ({ x, z, escala = 1 }) => (
  <group position={[x, 0.02, z]} scale={[escala, escala, escala]}>
    {MODELOS_3D.arvore ? (
      <ModeloGLB url={MODELOS_3D.arvore} escala={0.62} />
    ) : (
      <>
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.55, 12]} />
          <meshStandardMaterial color={CORES.tronco} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.72, 0]} castShadow>
          <coneGeometry args={[0.34, 0.72, 24]} />
          <meshStandardMaterial color={CORES.copa} roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.05, 0]} castShadow>
          <coneGeometry args={[0.26, 0.56, 24]} />
          <meshStandardMaterial color={CORES.copa2} roughness={0.55} />
        </mesh>
      </>
    )}
  </group>
);

const Colina: React.FC<{ x: number; z: number; escala: number; cor: string }> = ({ x, z, escala, cor }) => (
  <mesh position={[x, 0.05, z]} scale={[escala, 0.55, escala * 0.55]} castShadow receiveShadow>
    <sphereGeometry args={[1, 24, 12]} />
    <meshStandardMaterial color={cor} roughness={0.86} />
  </mesh>
);

const Pedra: React.FC<{ x: number; z: number; escala: number }> = ({ x, z, escala }) => (
  <mesh
    position={[x, 0.11, z]}
    rotation={[0.24, x * 0.3, 0.16]}
    scale={[escala, escala * 0.66, escala * 0.9]}
    castShadow
    receiveShadow
  >
    <dodecahedronGeometry args={[0.24, 0]} />
    <meshStandardMaterial color={CORES.pedra} roughness={0.78} />
  </mesh>
);

const Flor: React.FC<{ x: number; z: number; tipo: number }> = ({ x, z, tipo }) => {
  const cor = tipo === 0 ? CORES.flor1 : tipo === 1 ? CORES.flor2 : CORES.flor3;
  return (
    <group position={[x, 0.08, z]} scale={[0.82, 0.82, 0.82]}>
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.16, 8]} />
        <meshStandardMaterial color={CORES.copa} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.18, 0]} castShadow>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color={cor} roughness={0.55} />
      </mesh>
    </group>
  );
};

const Nuvem: React.FC<{ x: number; y: number; z: number }> = ({ x, y, z }) => (
  <group position={[x, y, z]}>
    <mesh>
      <sphereGeometry args={[0.34, 18, 18]} />
      <meshStandardMaterial color={CORES.nuvem} roughness={0.95} transparent opacity={0.82} />
    </mesh>
    <mesh position={[0.38, 0.06, 0]}>
      <sphereGeometry args={[0.27, 18, 18]} />
      <meshStandardMaterial color={CORES.nuvem} roughness={0.95} transparent opacity={0.82} />
    </mesh>
    <mesh position={[-0.38, 0.02, 0.02]}>
      <sphereGeometry args={[0.25, 18, 18]} />
      <meshStandardMaterial color={CORES.nuvem} roughness={0.95} transparent opacity={0.82} />
    </mesh>
    <mesh position={[0.05, -0.08, 0]}>
      <sphereGeometry args={[0.28, 18, 18]} />
      <meshStandardMaterial color={CORES.nuvem} roughness={0.95} transparent opacity={0.82} />
    </mesh>
  </group>
);

const ManchaVaca: React.FC<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = ({
  x,
  y,
  z,
  sx,
  sy,
  sz,
}) => (
  <mesh position={[x, y, z]} scale={[sx, sy, sz]} castShadow>
    <sphereGeometry args={[0.12, 14, 14]} />
    <meshStandardMaterial color="#20242d" roughness={0.7} />
  </mesh>
);

const Vaca: React.FC<{ x: number; z: number; delay: number }> = ({ x, z, delay }) => {
  const grupo = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + delay;
    if (!grupo.current) return;
    grupo.current.position.x = x + Math.sin(t * 0.45) * 0.42;
    grupo.current.position.z = z + Math.cos(t * 0.45) * 0.18;
    grupo.current.rotation.y = Math.sin(t * 0.45) * 0.18;
  });

  return (
    <group ref={grupo} position={[x, 0.25, z]} scale={[0.85, 0.85, 0.85]}>
      {MODELOS_3D.vaca && <ModeloGLB url={MODELOS_3D.vaca} escala={0.46} posicao={[0, -0.22, 0]} />}
      {!MODELOS_3D.vaca && (
        <>
      <mesh position={[0, 0.32, 0]} scale={[1.25, 0.72, 0.72]} castShadow receiveShadow>
        <sphereGeometry args={[0.34, 24, 24]} />
        <meshStandardMaterial color="#f4f1e8" roughness={0.68} />
      </mesh>
      <ManchaVaca x={-0.18} y={0.48} z={0.27} sx={1.25} sy={0.75} sz={0.5} />
      <ManchaVaca x={0.26} y={0.28} z={-0.28} sx={1.1} sy={0.7} sz={0.55} />
      <mesh position={[0.62, 0.42, 0]} scale={[0.72, 0.58, 0.58]} castShadow>
        <sphereGeometry args={[0.25, 22, 22]} />
        <meshStandardMaterial color="#f4f1e8" roughness={0.7} />
      </mesh>
      <mesh position={[0.74, 0.48, 0.1]} castShadow>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshStandardMaterial color="#20242d" roughness={0.6} />
      </mesh>
      <mesh position={[0.74, 0.48, -0.1]} castShadow>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshStandardMaterial color="#20242d" roughness={0.6} />
      </mesh>
      <mesh position={[0.86, 0.36, 0]} scale={[0.8, 0.45, 0.45]} castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#f0c7b0" roughness={0.72} />
      </mesh>
      <mesh position={[0.55, 0.72, 0.17]} rotation={[0, 0, -0.45]} castShadow>
        <coneGeometry args={[0.06, 0.18, 12]} />
        <meshStandardMaterial color="#f1e6c8" roughness={0.5} />
      </mesh>
      <mesh position={[0.55, 0.72, -0.17]} rotation={[0, 0, -0.45]} castShadow>
        <coneGeometry args={[0.06, 0.18, 12]} />
        <meshStandardMaterial color="#f1e6c8" roughness={0.5} />
      </mesh>
      {[-0.38, -0.12, 0.2, 0.44].map((lx, i) => (
        <mesh key={i} position={[lx, -0.05, i % 2 === 0 ? 0.22 : -0.22]} castShadow>
          <cylinderGeometry args={[0.045, 0.055, 0.42, 10]} />
          <meshStandardMaterial color="#20242d" roughness={0.68} />
        </mesh>
      ))}
      <mesh position={[-0.66, 0.42, 0]} rotation={[0, 0, 1.2]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.42, 8]} />
        <meshStandardMaterial color="#20242d" roughness={0.65} />
      </mesh>
        </>
      )}
    </group>
  );
};

const AguaLago: React.FC = () => {
  const ref = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.opacity = 0.78 + Math.sin(clock.getElapsedTime() * 1.5) * 0.08;
  });

  return (
    <mesh position={[0, 0, 0.012]}>
      <circleGeometry args={[1.14, 48]} />
      <meshStandardMaterial
        ref={ref}
        color={CORES.lago}
        roughness={0.25}
        metalness={0.08}
        transparent
        opacity={0.82}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const Lago: React.FC = () => (
  <group position={[-4.4, 0.018, -5.25]} rotation={[-Math.PI / 2, 0, -0.18]}>
    {MODELOS_3D.lago ? (
      <ModeloGLB url={MODELOS_3D.lago} escala={0.9} />
    ) : (
      <>
        <mesh receiveShadow>
          <circleGeometry args={[1.35, 48]} />
          <meshStandardMaterial color={CORES.lagoBorda} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
        <AguaLago />
        <mesh position={[0.18, 0.25, 0.018]} scale={[0.52, 0.12, 1]}>
          <circleGeometry args={[1, 32]} />
          <meshStandardMaterial color={CORES.texto} roughness={0.3} transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.35, -0.18, 0.02]} scale={[0.32, 0.08, 1]}>
          <circleGeometry args={[1, 32]} />
          <meshStandardMaterial color={CORES.texto} roughness={0.3} transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      </>
    )}
  </group>
);

const Passaro: React.FC<{ x: number; y: number; z: number; delay: number }> = ({ x, y, z, delay }) => {
  const grupo = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + delay;
    if (!grupo.current) return;
    grupo.current.position.x = x + Math.sin(t * 0.55) * 0.32;
    grupo.current.position.y = y + Math.sin(t * 1.2) * 0.08;
    grupo.current.rotation.z = Math.sin(t * 1.8) * 0.12;
  });

  return (
    <group ref={grupo} position={[x, y, z]} rotation={[0.2, 0, 0]} scale={[0.62, 0.62, 0.62]}>
      <mesh position={[-0.16, 0, 0]} rotation={[0, 0, -0.42]}>
        <boxGeometry args={[0.42, 0.045, 0.045]} />
        <meshStandardMaterial color={CORES.passaro} roughness={0.6} />
      </mesh>
      <mesh position={[0.16, 0, 0]} rotation={[0, 0, 0.42]}>
        <boxGeometry args={[0.42, 0.045, 0.045]} />
        <meshStandardMaterial color={CORES.passaro} roughness={0.6} />
      </mesh>
    </group>
  );
};

const Controls: React.FC<{ controlsRef: React.MutableRefObject<any> }> = ({ controlsRef }) => {
  const { camera, gl } = useThree();
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, -2.0);
      controlsRef.current.update();
    }
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
      maxDistance={38}
      minPolarAngle={Math.PI / 5.8}
      maxPolarAngle={Math.PI / 2.15}
      autoRotate
      autoRotateSpeed={0.32}
    />
  );
};

const Cena: React.FC<{
  vendedores: VendedorProgresso[];
  onVendedorClick?: (id: string) => void;
  controlsRef: React.MutableRefObject<any>;
}> = ({ vendedores, onVendedorClick, controlsRef }) => {
  const curva = useMemo(criarTrilha, []);
  const grupos = new Map<number, VendedorProgresso[]>();
  vendedores.forEach((v) => {
    const c = Math.min(Math.max(v.casas, 0), 12);
    if (!grupos.has(c)) grupos.set(c, []);
    grupos.get(c)!.push(v);
  });

  return (
    <>
      <ambientLight intensity={0.78} />
      <hemisphereLight args={[CORES.luzCeu, CORES.grama, 0.42]} />
      <directionalLight
        position={[4.5, 10, 6.5]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5, 4, -4]} intensity={0.22} />

      <Estrada />

      {MOSTRAR_CENARIO && (
        <>
          <Ceu />
          {COLINAS.map(([x, z, escala, cor], i) => (
            <Colina key={`colina-${i}`} x={x} z={z} escala={escala} cor={cor} />
          ))}
          <Lago />
          {PEDRAS.map(([x, z, escala], i) => <Pedra key={`pedra-${i}`} x={x} z={z} escala={escala} />)}
          {FLORES.map(([x, z, tipo], i) => <Flor key={`flor-${i}`} x={x} z={z} tipo={tipo} />)}
          {ARVORES.map(([x, z], i) => <Arvore key={i} x={x} z={z} escala={i % 3 === 0 ? 1.15 : 0.95} />)}
          {NUVENS.map(([x, y, z], i) => <Nuvem key={`nuvem-${i}`} x={x} y={y} z={z} />)}
          {VACAS.map((vaca, i) => <Vaca key={`vaca-${i}`} x={vaca.x} z={vaca.z} delay={vaca.delay} />)}
          {PASSAROS.map((passaro, i) => (
            <Passaro key={`passaro-${i}`} x={passaro.x} y={passaro.y} z={passaro.z} delay={passaro.delay} />
          ))}
        </>
      )}
      {MOSTRAR_INICIO_CHEGADA && (
        <>
          <PortalInicioChegada tipo="INICIO" curva={curva} />
          <PortalInicioChegada tipo="CHEGADA" curva={curva} />
        </>
      )}
      {CASAS.map((_, i) => <BandeiraCasa key={`bandeira-${i}`} i={i} />)}

      {Array.from(grupos.entries()).map(([casa, lista]) => {
        const base = casaPos(casa);
        const n = lista.length;
        return lista.map((v, k) => {
          const ox = (k - (n - 1) / 2) * 0.46;
          const oz = n > 1 ? (k % 2 === 0 ? -0.82 : 0.82) : -0.78;
          return (
            <BonecoVendedor
              key={v.id}
              v={v}
              x={base.x + ox}
              z={base.z + oz}
              onClick={onVendedorClick ? () => onVendedorClick(v.id) : undefined}
            />
          );
        });
      })}

      <Controls controlsRef={controlsRef} />
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
    if (!controlsRef.current) return;
    const next = !autoRot;
    controlsRef.current.autoRotate = next;
    setAutoRot(next);
  }

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 8,
    border: '1px solid #4b4d63',
    background: 'rgba(31,32,41,0.88)',
    color: '#eeeef2',
    cursor: 'pointer',
    fontSize: 20,
    userSelect: 'none',
    backdropFilter: 'blur(4px)',
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 760, overflow: 'hidden', background: 'transparent' }}>
      {/* Botões flutuantes */}
      <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button style={btnStyle} title="Zoom in" onClick={zoomIn}>＋</button>
        <button style={btnStyle} title="Zoom out" onClick={zoomOut}>－</button>
        <button
          style={{ ...btnStyle, borderColor: autoRot ? '#fe8026' : '#4b4d63', color: autoRot ? '#fe8026' : '#eeeef2' }}
          title={autoRot ? 'Parar rotação' : 'Girar automaticamente'}
          onClick={toggleRot}
        >
          ↻
        </button>
      </div>
      <Canvas
        shadows
        camera={{ position: [0, 15.5, 29.5], fov: 46, near: 0.1, far: 160 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={[CORES.fundo]} />
        <fog attach="fog" args={[CORES.fundo, 32, 62]} />
        <Suspense fallback={null}>
          <Cena vendedores={vendedores} onVendedorClick={onVendedorClick} controlsRef={controlsRef} />
        </Suspense>
      </Canvas>
    </div>
  );
};
