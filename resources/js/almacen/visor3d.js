import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { normalizar } from "./compartido.js";

const contenedor = document.getElementById("visor-prenda");

const ALTO_VISOR = 420;
const PROFUNDIDAD = 8; // Grosor de la prenda (sin el bisel redondeado)
const BISEL = 3; // Redondeo de los bordes: da el aspecto "relleno" de una prenda

// ------------------------------------------------------------
// Colores: el nombre del color del producto se traduce a un color real.
// El orden importa: "azul marino" tiene que probarse antes que "azul".
// ------------------------------------------------------------
const COLORES = [
    ["azul marino", 0x1e3a8a],
    ["celeste", 0x7dd3fc],
    ["azul", 0x2563eb],
    ["negro", 0x1f2937],
    ["blanco", 0xf3f4f6],
    ["gris", 0x9ca3af],
    ["rojo", 0xdc2626],
    ["bordo", 0x7f1d1d],
    ["verde", 0x16a34a],
    ["amarillo", 0xfacc15],
    ["mostaza", 0xca8a04],
    ["naranja", 0xf97316],
    ["rosa", 0xf472b6],
    ["violeta", 0x8b5cf6],
    ["lila", 0xa78bfa],
    ["morado", 0x7c3aed],
    ["marron", 0x92400e],
    ["beige", 0xe7d5b3],
    ["crema", 0xf5efe0],
    ["caqui", 0xa8a07a],
    ["turquesa", 0x14b8a6],
    ["jean", 0x3b5b92],
    ["denim", 0x3b5b92],
];

function colorDePrenda(nombre) {
    const texto = normalizar(nombre);
    const hallado = COLORES.find(([clave]) => texto.includes(clave));

    return hallado ? hallado[1] : 0xcbd5e1;
}

// ------------------------------------------------------------
// Siluetas (vista de frente). Solo se define el lado derecho, de arriba hacia abajo;
// el izquierdo se arma como espejo. "cuello" es la abertura de arriba (null = recta).
// ------------------------------------------------------------
const FORMAS = {
    remera: {
        cuello: { x: 9, y: 35, hundimiento: 7 },
        derecha: [
            [24, 32],
            [45, 17],
            [38, 7],
            [25, 13],
            [25, -35],
        ],
    },
    mangaLarga: {
        cuello: { x: 9, y: 35, hundimiento: 7 },
        derecha: [
            [24, 32],
            [48, -14],
            [39, -17],
            [26, 8],
            [26, -35],
        ],
    },
    abrigo: {
        cuello: { x: 10, y: 38, hundimiento: 3 },
        derecha: [
            [26, 35],
            [50, -16],
            [40, -20],
            [28, 6],
            [28, -48],
        ],
    },
    pantalon: {
        cuello: null,
        derecha: [
            [20, 35],
            [24, -45],
            [6, -45],
            [3, -3],
        ],
    },
    short: {
        cuello: null,
        derecha: [
            [20, 35],
            [25, -10],
            [5, -10],
            [3, 0],
        ],
    },
    vestido: {
        cuello: { x: 9, y: 35, hundimiento: 5 },
        derecha: [
            [13, 34],
            [14, 8],
            [37, -45],
        ],
    },
};

function crearForma({ cuello, derecha }) {
    const forma = new THREE.Shape();

    if (cuello) {
        // Escote curvo entre los dos hombros
        forma.moveTo(-cuello.x, cuello.y);
        forma.quadraticCurveTo(
            0,
            cuello.y - cuello.hundimiento,
            cuello.x,
            cuello.y,
        );
    } else {
        forma.moveTo(-derecha[0][0], derecha[0][1]);
    }

    derecha.forEach(([x, y]) => forma.lineTo(x, y));
    [...derecha].reverse().forEach(([x, y]) => forma.lineTo(-x, y));
    forma.closePath();

    return forma;
}

// Convierte la silueta plana en un cuerpo con volumen (con los bordes redondeados)
function extruir(definicion, material) {
    const geometria = new THREE.ExtrudeGeometry(crearForma(definicion), {
        depth: PROFUNDIDAD,
        bevelEnabled: true,
        bevelThickness: BISEL,
        bevelSize: 2.5,
        bevelSegments: 5,
        curveSegments: 24,
    });
    geometria.translate(0, 0, -PROFUNDIDAD / 2); // Centrado: el frente queda en z = +7 y la espalda en z = -7

    const malla = new THREE.Mesh(geometria, material);
    malla.castShadow = true;

    return malla;
}

// Una pieza suelta (botón, cinturón, bolsillo...) ubicada en x, y, z
function pieza(geometria, material, x, y, z) {
    const malla = new THREE.Mesh(geometria, material);
    malla.position.set(x, y, z);
    malla.castShadow = true;

    return malla;
}

// ------------------------------------------------------------
// Accesorios: cada uno tiene su propia forma, según el nombre del producto
// ------------------------------------------------------------
function construirAccesorio(producto, { material, oscuro, claro, metal }) {
    const nombre = normalizar(producto.nombre);
    const g = new THREE.Group();

    if (nombre.includes("bufanda")) {
        // Anillo alrededor del cuello y dos puntas colgando (una más larga)
        const anillo = pieza(
            new THREE.TorusGeometry(13, 5, 14, 32),
            material,
            0,
            24,
            0,
        );
        anillo.rotation.x = Math.PI / 2;
        g.add(anillo);
        g.add(pieza(new THREE.BoxGeometry(11, 60, 4), material, -6, -6, 19));
        g.add(pieza(new THREE.BoxGeometry(11, 44, 4), material, 7, 2, 20));
        // Rayas y flecos
        g.add(pieza(new THREE.BoxGeometry(11.4, 4, 4.4), oscuro, -6, -22, 19));
        g.add(pieza(new THREE.BoxGeometry(11.4, 4, 4.4), oscuro, 7, -8, 20));
        for (let i = 0; i < 5; i++) {
            g.add(
                pieza(
                    new THREE.BoxGeometry(1.2, 6, 1.2),
                    material,
                    -10.4 + i * 2.1,
                    -39,
                    19,
                ),
            );
            g.add(
                pieza(
                    new THREE.BoxGeometry(1.2, 6, 1.2),
                    material,
                    3 + i * 2.1,
                    -25,
                    20,
                ),
            );
        }
        g.userData.sinFoto = true;
    } else if (nombre.includes("gorra")) {
        // Copa, botón, banda y visera
        const copa = pieza(
            new THREE.SphereGeometry(
                22,
                32,
                20,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2,
            ),
            material,
            0,
            0,
            0,
        );
        copa.scale.y = 0.9;
        g.add(copa);
        g.add(pieza(new THREE.SphereGeometry(2.2, 12, 12), oscuro, 0, 19.8, 0));
        g.add(
            pieza(
                new THREE.CylinderGeometry(22.3, 22.3, 3, 32),
                oscuro,
                0,
                1,
                0,
            ),
        );
        const visera = pieza(
            new THREE.CylinderGeometry(
                24,
                24,
                1.6,
                32,
                1,
                false,
                -Math.PI / 2,
                Math.PI,
            ),
            oscuro,
            0,
            0.8,
            10,
        );
        visera.scale.x = 0.85;
        g.add(visera);
        g.userData.sinFoto = true;
    } else if (nombre.includes("gorro")) {
        // Gorro de lana con puño y pompón
        const copa = pieza(
            new THREE.SphereGeometry(
                20,
                32,
                20,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2,
            ),
            material,
            0,
            4,
            0,
        );
        copa.scale.y = 1.1;
        g.add(copa);
        g.add(
            pieza(
                new THREE.CylinderGeometry(20.6, 20.6, 9, 32),
                oscuro,
                0,
                0,
                0,
            ),
        );
        g.add(pieza(new THREE.SphereGeometry(6, 16, 16), claro, 0, 28, 0));
        g.userData.sinFoto = true;
    } else if (nombre.includes("media")) {
        // Un par de medias: pierna, puño, pie, talón y punta
        [-12, 12].forEach((x, i) => {
            const z = i * 3;
            g.add(
                pieza(
                    new THREE.CylinderGeometry(6.5, 6.5, 40, 20),
                    material,
                    x,
                    8,
                    z,
                ),
            );
            g.add(
                pieza(
                    new THREE.CylinderGeometry(6.9, 6.9, 5, 20),
                    oscuro,
                    x,
                    26,
                    z,
                ),
            );
            g.add(
                pieza(
                    new THREE.BoxGeometry(13, 9, 26),
                    material,
                    x,
                    -13,
                    z + 9,
                ),
            );
            const talon = pieza(
                new THREE.SphereGeometry(6.5, 16, 12),
                material,
                x,
                -13,
                z - 4,
            );
            talon.scale.y = 0.7;
            g.add(talon);
            const punta = pieza(
                new THREE.SphereGeometry(6.5, 16, 12),
                oscuro,
                x,
                -13,
                z + 22,
            );
            punta.scale.y = 0.7;
            g.add(punta);
        });
        g.userData.sinFoto = true;
    } else if (nombre.includes("cinturon")) {
        // Cinturón enrollado con su hebilla
        const cuerpo = new THREE.Mesh(
            new THREE.CylinderGeometry(24, 24, 6, 48, 1, true),
            new THREE.MeshStandardMaterial({
                color: material.color,
                roughness: 0.7,
                side: THREE.DoubleSide,
            }),
        );
        cuerpo.castShadow = true;
        g.add(cuerpo);
        g.add(pieza(new THREE.BoxGeometry(9, 8, 1.6), metal, 0, 0, 24.5));
        g.add(pieza(new THREE.BoxGeometry(5, 4, 1.8), oscuro, 0, 0, 24.6));
        g.userData.sinFoto = true;
    } else if (nombre.includes("guante")) {
        // Guante: palma, cuatro dedos y pulgar
        g.add(pieza(new THREE.BoxGeometry(22, 24, 6), material, 0, 0, 0));
        g.add(pieza(new THREE.BoxGeometry(24, 8, 7), oscuro, 0, -14, 0)); // Puño
        [-8.25, -2.75, 2.75, 8.25].forEach((x, i) => {
            const largo = [16, 19, 18, 14][i];
            g.add(
                pieza(
                    new THREE.BoxGeometry(4.8, largo, 5.2),
                    material,
                    x,
                    12 + largo / 2,
                    0,
                ),
            );
        });
        const pulgar = pieza(
            new THREE.BoxGeometry(5, 14, 5.2),
            material,
            15,
            4,
            0,
        );
        pulgar.rotation.z = -0.7;
        g.add(pulgar);
        g.userData.sinFoto = true;
    } else {
        // Cualquier otro accesorio: un bolso
        g.add(pieza(new THREE.BoxGeometry(44, 34, 14), material, 0, 0, 0));
        g.add(pieza(new THREE.BoxGeometry(44.5, 3, 14.5), oscuro, 0, 12, 0));
        g.add(
            pieza(
                new THREE.TorusGeometry(12, 1.8, 12, 32, Math.PI),
                oscuro,
                0,
                17,
                0,
            ),
        );
    }

    return g;
}

// Arma la prenda según su categoría y la pinta con el color del producto
function construirPrenda(producto) {
    const color = colorDePrenda(producto.color);
    const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0.02,
    });
    const oscuro = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).multiplyScalar(0.7),
        roughness: 0.9,
    });
    const claro = new THREE.MeshStandardMaterial({
        color: 0xf9fafb,
        roughness: 0.5,
    });
    const metal = new THREE.MeshStandardMaterial({
        color: 0xd1d5db,
        roughness: 0.3,
        metalness: 0.7,
    });

    const grupo = new THREE.Group();

    switch (normalizar(producto.categoria)) {
        case "camisas": {
            grupo.add(extruir(FORMAS.mangaLarga, material));
            // Botones al frente
            for (let y = 28; y >= -30; y -= 9.7) {
                grupo.add(
                    pieza(
                        new THREE.SphereGeometry(1.2, 12, 12),
                        claro,
                        0,
                        y,
                        7.6,
                    ),
                );
            }
            break;
        }
        case "buzos": {
            grupo.add(extruir(FORMAS.mangaLarga, material));
            grupo.add(
                pieza(new THREE.BoxGeometry(30, 13, 2), oscuro, 0, -18, 7.4),
            ); // Bolsillo canguro
            grupo.add(
                pieza(new THREE.BoxGeometry(57, 6, 15), oscuro, 0, -33, 0),
            ); // Elástico de la cintura
            break;
        }
        case "abrigos": {
            grupo.add(extruir(FORMAS.abrigo, material));
            grupo.add(
                pieza(new THREE.BoxGeometry(1, 84, 1.2), metal, 0, -6, 7.4),
            ); // Cierre
            grupo.add(
                pieza(new THREE.BoxGeometry(22, 5, 15), oscuro, 0, 37, 0),
            ); // Cuello
            break;
        }
        case "pantalones": {
            grupo.add(extruir(FORMAS.pantalon, material));
            grupo.add(
                pieza(new THREE.BoxGeometry(46, 4, 15), oscuro, 0, 33, 0),
            ); // Cinturón
            grupo.add(
                pieza(new THREE.BoxGeometry(0.6, 34, 0.6), oscuro, 0, 14, 7.3),
            ); // Costura del frente
            const boton = pieza(
                new THREE.CylinderGeometry(2, 2, 1, 16),
                metal,
                0,
                33,
                7.8,
            );
            boton.rotation.x = Math.PI / 2;
            grupo.add(boton);
            break;
        }
        case "shorts": {
            grupo.add(extruir(FORMAS.short, material));
            grupo.add(
                pieza(new THREE.BoxGeometry(46, 4, 15), oscuro, 0, 33, 0),
            );
            break;
        }
        case "vestidos": {
            grupo.add(extruir(FORMAS.vestido, material));
            grupo.add(pieza(new THREE.BoxGeometry(33, 3, 15), oscuro, 0, 8, 0)); // Cinta de la cintura
            break;
        }
        case "accesorios": {
            // La forma depende del nombre del producto (Accesorios es solo la categoría)
            grupo.add(
                construirAccesorio(producto, {
                    material,
                    oscuro,
                    claro,
                    metal,
                }),
            );
            grupo.userData.sinFoto =
                grupo.children[0].userData.sinFoto === true;
            break;
        }
        default: {
            // Remeras y cualquier categoría que no conozca
            grupo.add(extruir(FORMAS.remera, material));
        }
    }

    return grupo;
}

// ------------------------------------------------------------
// Escena del visor
// ------------------------------------------------------------
let escena, camara, renderizador, controles;
let prenda = null;
let plataforma = null;
let activo = false; // El bucle de dibujo solo corre mientras el visor está abierto
let transicion = null;
let versionVisor = 0; // Para descartar una carga lenta si ya se abrió otra prenda
const vista = { centroY: 40, distancia: 150 };

if (contenedor) {
    conectarEventos();
}

function iniciar() {
    escena = new THREE.Scene();
    escena.background = new THREE.Color(0xf3f4f6);

    camara = new THREE.PerspectiveCamera(
        38,
        contenedor.clientWidth / ALTO_VISOR,
        1,
        2000,
    );

    renderizador = new THREE.WebGLRenderer({ antialias: true });
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderizador.setSize(contenedor.clientWidth, ALTO_VISOR);
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(renderizador.domElement);

    // Luz de frente (con sombra) y luz de atrás, para que la espalda también se vea bien
    escena.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 1.4));

    const luzFrente = new THREE.DirectionalLight(0xffffff, 1.6);
    luzFrente.position.set(70, 120, 110);
    luzFrente.castShadow = true;
    luzFrente.shadow.mapSize.set(1024, 1024);
    luzFrente.shadow.camera.left = -120;
    luzFrente.shadow.camera.right = 120;
    luzFrente.shadow.camera.top = 120;
    luzFrente.shadow.camera.bottom = -120;
    escena.add(luzFrente);

    const luzAtras = new THREE.DirectionalLight(0xffffff, 1.0);
    luzAtras.position.set(-70, 80, -120);
    escena.add(luzAtras);

    // Plataforma circular bajo la prenda
    plataforma = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 1.5, 48),
        new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.9 }),
    );
    plataforma.receiveShadow = true;
    escena.add(plataforma);

    controles = new OrbitControls(camara, renderizador.domElement);
    controles.enableDamping = true;
    controles.enablePan = false;
    controles.minDistance = 60;
    controles.maxDistance = 400;
    controles.autoRotate = true;
    controles.autoRotateSpeed = 2.5;

    // Si el usuario agarra la prenda, el giro automático se apaga solo
    controles.addEventListener("start", () => {
        controles.autoRotate = false;
        window.dispatchEvent(
            new CustomEvent("visor-giro-cambiado", { detail: false }),
        );
    });
}

function conectarEventos() {
    window.addEventListener("abrir-visor", (evento) => abrir(evento.detail));
    window.addEventListener("cerrar-visor", () => {
        activo = false;
    });
    window.addEventListener("visor-vista", (evento) => irAVista(evento.detail));
    window.addEventListener("visor-giro", (evento) => {
        if (controles) controles.autoRotate = evento.detail;
    });
}

function abrir(producto) {
    if (!renderizador) iniciar();

    // El modal ya es visible: se ajusta el tamaño al contenedor
    const ancho = contenedor.clientWidth;
    renderizador.setSize(ancho, ALTO_VISOR);
    camara.aspect = ancho / ALTO_VISOR;
    camara.updateProjectionMatrix();

    const version = ++versionVisor;

    controles.autoRotate = true;
    colocarPrenda(construirPrenda(producto));

    if (!activo) {
        activo = true;
        bucle();
    }

    // Si hay un modelo real (public/modelos/<categoria>.glb), reemplaza al generado
    intentarModeloReal(producto, version);
}

// Reemplaza la prenda de la escena, la apoya en la plataforma y acomoda la cámara
function colocarPrenda(nueva) {
    if (prenda) {
        escena.remove(prenda);
        prenda.traverse((objeto) => {
            objeto.geometry?.dispose();
            if (objeto.material)
                [].concat(objeto.material).forEach((m) => m.dispose());
        });
    }

    prenda = nueva;
    escena.add(prenda);

    // Se apoya sobre la plataforma (su punto más bajo queda en y = 0)
    const caja = new THREE.Box3().setFromObject(prenda);
    prenda.position.y -= caja.min.y;

    const tamano = caja.getSize(new THREE.Vector3());
    const radio = Math.max(tamano.x, tamano.z) * 0.6 + 6;

    plataforma.scale.set(radio, 1, radio);
    plataforma.position.y = -0.75;

    // Distancia a la que la prenda entra completa en pantalla
    const mayor = Math.max(tamano.y, tamano.x / camara.aspect);
    vista.centroY = tamano.y / 2;
    vista.distancia =
        (mayor / 2 / Math.tan(THREE.MathUtils.degToRad(camara.fov / 2))) * 1.4 +
        tamano.z;

    controles.target.set(0, vista.centroY, 0);
    camara.position.set(
        vista.distancia * 0.7,
        vista.centroY + vista.distancia * 0.2,
        vista.distancia * 0.7,
    );
    controles.update();
}

// Botones Frente / Costado / Espalda / 3/4: la cámara se desliza hasta esa posición
function irAVista(nombre) {
    const d = vista.distancia;
    const y = vista.centroY;

    const posiciones = {
        frente: [0, y, d],
        costado: [d, y, 0],
        espalda: [0, y, -d],
        tres_cuartos: [d * 0.72, y + d * 0.28, d * 0.72],
    };

    const destino = posiciones[nombre];
    if (!destino || !controles) return;

    controles.autoRotate = false;
    window.dispatchEvent(
        new CustomEvent("visor-giro-cambiado", { detail: false }),
    );

    transicion = {
        inicio: performance.now(),
        duracion: 600,
        desde: camara.position.clone(),
        hasta: new THREE.Vector3(...destino),
    };
}

function bucle() {
    if (!activo) return;
    requestAnimationFrame(bucle);

    if (transicion) {
        const avance = Math.min(
            1,
            (performance.now() - transicion.inicio) / transicion.duracion,
        );
        const suave = 1 - Math.pow(1 - avance, 3);
        camara.position.lerpVectors(transicion.desde, transicion.hasta, suave);
        if (avance >= 1) transicion = null;
    }

    controles.update();
    renderizador.render(escena, camara);
}

// ------------------------------------------------------------
// Modelo real opcional: public/modelos/remeras.glb, pantalones.glb, etc.
// Si el archivo no existe, se queda la prenda generada.
// ------------------------------------------------------------
async function intentarModeloReal(producto, version) {
    // Primero un modelo propio del producto (por código); si no hay, el de la categoría
    const candidatas = [
        `/modelos/${String(producto.codigo).toLowerCase()}.glb`,
        `/modelos/${normalizar(producto.categoria)}.glb`,
    ];
    let ruta = null;

    try {
        for (const candidata of candidatas) {
            const comprobacion = await fetch(candidata, { method: "HEAD" });
            if (comprobacion.ok) {
                ruta = candidata;
                break;
            }
        }
        if (!ruta) return;

        const gltf = await new GLTFLoader().loadAsync(ruta);
        if (version !== versionVisor) return; // Mientras cargaba, se abrió otra prenda

        // Se escala a la altura de las prendas generadas y se centra
        const modelo = gltf.scene;
        const caja = new THREE.Box3().setFromObject(modelo);
        const tamano = caja.getSize(new THREE.Vector3());
        const centro = caja.getCenter(new THREE.Vector3());

        modelo.scale.setScalar(80 / tamano.y);
        modelo.position.set(
            -centro.x * (80 / tamano.y),
            0,
            -centro.z * (80 / tamano.y),
        );

        const envoltorio = new THREE.Group();
        envoltorio.add(modelo);
        colocarPrenda(envoltorio);
    } catch (error) {
        // Sin modelo real: queda la prenda generada por código
    }
}
