import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import axios from "axios";
import { textoFicha, coincideConFiltro } from "./compartido.js";

// ------------------------------------------------------------
// Medidas y colores. Las posiciones del servidor (posicion_x, posicion_y, ancho, alto)
// se usan igual que en el 2D: 1 píxel del mapa = 1 unidad del mundo 3D.
// En 3D, "y" es la altura, así que la posicion_y del 2D pasa a ser el eje Z.
// ------------------------------------------------------------
const ALTO_ESCENARIO = 560;
const ALTURA_FILA = 46; // Altura de cada sección (fila) del estante
const GROSOR_TABLERO = 4;
const GROSOR_POSTE = 5;

const COLOR_VACIO = 0x9ca3af;
const COLOR_CON_ESPACIO = 0x22c55e;
const COLOR_CASI_LLENO = 0xeab308;
const COLOR_LLENO = 0xef4444;
const COLOR_SELECCION = 0x2563eb;
const COLOR_COINCIDENCIA = 0xf59e0b;
const COLOR_ZONA = 0xfed7aa;
const COLOR_ZONA_ACTIVA = 0xfb923c;

const contenedor = document.getElementById("mapa-almacen");
const medidas = contenedor ? JSON.parse(contenedor.dataset.medidas) : {};

// ------------------------------------------------------------
// Estado
// ------------------------------------------------------------
let escena, camara, renderizador, controles, lienzo;
let mundo; // Grupo que contiene TODO lo que se redibuja (estantes, prendas, suelo)
let globo; // El cuadro de texto que aparece al pasar el mouse
let interactivos = []; // Los objetos sobre los que se puede hacer click
let grupos = new Map(); // id de estante -> su grupo 3D
let baseSinUbicar = null; // La plataforma "Sin ubicar" (también es un destino al arrastrar prendas)

let datos = { estantes: [], sin_ubicar: [] };
let idSeleccionado = null;
let filtro = { texto: "", categoria: "" };
let modoEdicion = false;
let primeraVez = true;

// Interior de un estante
let idInterior = null; // Estante abierto (null = vista general del almacén)
let ranuras = []; // Los casilleros del estante abierto (zonas donde se puede soltar una prenda)
let ranuraResaltada = null;
let vistaGeneral = null; // Dónde estaba la cámara antes de entrar al estante
let transicion = null; // Animación de la cámara
let arrastre = null; // Lo que se está arrastrando (prenda o estante)

const rayo = new THREE.Raycaster();
const puntero = new THREE.Vector2();
const planoPiso = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // El suelo (y = 0)
const planoAltura = new THREE.Plane(new THREE.Vector3(0, 1, 0), -90); // Plano a y = 90 (las prendas "flotan" ahí)
const planoArrastre = new THREE.Plane();
const puntoArrastre = new THREE.Vector3();
const cargadorTexturas = new THREE.TextureLoader();
const texturas = new Map(); // url -> textura (para no cargar dos veces la misma imagen)
let inicioClick = null;

if (contenedor) {
    iniciar();
}

// ------------------------------------------------------------
// Arranque: escena, cámara, luces, controles y eventos
// ------------------------------------------------------------
async function iniciar() {
    contenedor.style.position = "relative";
    contenedor.style.height = ALTO_ESCENARIO + "px";

    escena = new THREE.Scene();
    escena.background = new THREE.Color(0xf9fafb);

    camara = new THREE.PerspectiveCamera(
        45,
        contenedor.clientWidth / ALTO_ESCENARIO,
        1,
        5000,
    );

    renderizador = new THREE.WebGLRenderer({ antialias: true });
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderizador.setSize(contenedor.clientWidth, ALTO_ESCENARIO);
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    contenedor.appendChild(renderizador.domElement);
    lienzo = renderizador.domElement;

    // Luces: una suave para todo el ambiente y una direccional que genera sombras
    escena.add(new THREE.HemisphereLight(0xffffff, 0x9ca3af, 1.7));

    const sol = new THREE.DirectionalLight(0xffffff, 1.8);
    sol.position.set(300, 700, 700);
    sol.target.position.set(470, 0, 280);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.camera.left = -800;
    sol.shadow.camera.right = 800;
    sol.shadow.camera.top = 800;
    sol.shadow.camera.bottom = -800;
    sol.shadow.camera.far = 2500;
    escena.add(sol, sol.target);

    // Controles orbitales: arrastrar gira, rueda acerca, clic derecho desplaza
    controles = new OrbitControls(camara, lienzo);
    controles.enableDamping = true;
    controles.maxPolarAngle = Math.PI / 2.1; // No deja pasar por debajo del piso
    controles.minDistance = 100;
    controles.maxDistance = 1800;

    mundo = new THREE.Group();
    escena.add(mundo);

    crearGlobo();
    conectarEventos();
    animar();

    avisar(
        "Arrastrá una prenda a otro estante o a “Sin ubicar” para moverla · girá con el mouse sobre el piso · rueda para acercar.",
        "info",
    );

    await cargarDatos();
}

// Bucle de dibujo: se repite en cada cuadro de la pantalla
function animar() {
    requestAnimationFrame(animar);

    if (transicion) {
        avanzarTransicion();
    }

    controles.update();
    renderizador.render(escena, camara);
}

// ------------------------------------------------------------
// Animación suave de la cámara (entrar y salir del estante)
// ------------------------------------------------------------
function moverCamara(posicion, objetivo, duracion = 700) {
    transicion = {
        inicio: performance.now(),
        duracion,
        posicionDesde: camara.position.clone(),
        objetivoDesde: controles.target.clone(),
        posicionHasta: posicion.clone(),
        objetivoHasta: objetivo.clone(),
    };
}

function avanzarTransicion() {
    const avance = Math.min(
        1,
        (performance.now() - transicion.inicio) / transicion.duracion,
    );
    const suave = 1 - Math.pow(1 - avance, 3); // Empieza rápido y frena al final

    camara.position.lerpVectors(
        transicion.posicionDesde,
        transicion.posicionHasta,
        suave,
    );
    controles.target.lerpVectors(
        transicion.objetivoDesde,
        transicion.objetivoHasta,
        suave,
    );

    if (avance >= 1) {
        transicion = null;
    }
}

// ------------------------------------------------------------
// Eventos del navegador y de la página (Alpine)
// ------------------------------------------------------------
function conectarEventos() {
    // "true" = fase de captura: este aviso llega ANTES que a los controles de la cámara,
    // así podemos arrastrar una prenda o un estante sin que además gire la cámara
    lienzo.addEventListener("pointerdown", alPresionar, true);
    lienzo.addEventListener("pointermove", alMoverPuntero);
    lienzo.addEventListener("pointerup", alSoltar);
    lienzo.addEventListener("pointerleave", ocultarGlobo);
    lienzo.addEventListener("dblclick", alHacerDobleClick);

    // Soltar una prenda de la lista "Sin ubicar" sobre una sección del estante
    lienzo.addEventListener("dragover", alArrastrarSobreEstante);
    lienzo.addEventListener("dragleave", () => resaltarRanura(null));
    lienzo.addEventListener("drop", soltarPrendaNueva);

    // El tamaño del contenedor cambió (ventana, panel lateral...)
    new ResizeObserver(() => {
        const ancho = contenedor.clientWidth;
        if (ancho === 0) return;
        renderizador.setSize(ancho, ALTO_ESCENARIO);
        camara.aspect = ancho / ALTO_ESCENARIO;
        camara.updateProjectionMatrix();
    }).observe(contenedor);

    // Eventos que manda la página
    window.addEventListener("inventario-actualizado", recargar);
    window.addEventListener("prenda-ubicada", recargar);

    window.addEventListener("estante-seleccionado", (evento) => {
        idSeleccionado = evento.detail.id;
        pintarSeleccion();
    });

    window.addEventListener("filtro-cambiado", (evento) => {
        filtro = evento.detail;
        dibujar();
    });

    window.addEventListener("modo-edicion", (evento) => {
        modoEdicion = evento.detail.activo;
    });

    // "Abrir estante" y "Volver al almacén"
    window.addEventListener("abrir-estante", (evento) =>
        entrarInterior(evento.detail),
    );
    window.addEventListener("cerrar-estante", salirInterior);
}

function recargar() {
    cargarDatos().catch((error) =>
        console.error("No se pudo recargar el mapa:", error),
    );
}

// ------------------------------------------------------------
// Pide los datos al servidor y redibuja
// ------------------------------------------------------------
async function cargarDatos() {
    try {
        const respuesta = await axios.get(contenedor.dataset.url, {
            params: { _: Date.now() }, // Evita que el navegador reutilice una respuesta vieja
        });
        datos = respuesta.data;
    } catch (error) {
        avisar("No se pudo cargar el almacén.", "error");
        return;
    }

    // Lista de categorías para el selector del filtro (sin repetir y ordenada)
    const categorias = [
        ...new Set([
            ...datos.estantes.flatMap((estante) =>
                estante.productos.map((producto) => producto.categoria),
            ),
            ...datos.sin_ubicar.map((producto) => producto.categoria),
        ]),
    ].sort((a, b) => a.localeCompare(b, "es"));

    window.dispatchEvent(
        new CustomEvent("categorias-cargadas", { detail: categorias }),
    );

    // La lista "Sin ubicar" de la página se mantiene al día
    enviarSinUbicar();

    dibujar();

    // Si hay un estante seleccionado, el panel lateral recibe sus datos actualizados
    const seleccionado = datos.estantes.find((e) => e.id === idSeleccionado);
    if (seleccionado) {
        window.dispatchEvent(
            new CustomEvent("estante-seleccionado", { detail: seleccionado }),
        );
    } else {
        idSeleccionado = null;
    }

    if (primeraVez) {
        primeraVez = false;
        acomodarCamara();
    }
}

function enviarSinUbicar() {
    window.dispatchEvent(
        new CustomEvent("sin-ubicar-cargadas", { detail: datos.sin_ubicar }),
    );
}

// Pone la cámara mirando todo el almacén desde arriba y un poco de frente
function acomodarCamara() {
    const { ancho, profundidad } = medidasSuelo();
    controles.target.set(ancho / 2, 0, profundidad / 2);
    camara.position.set(ancho / 2, 620, profundidad + 480);
    controles.update();
}

// ------------------------------------------------------------
// Interior de un estante: se ve SOLO ese estante, de frente
// ------------------------------------------------------------
function entrarInterior(estanteRecibido) {
    const estante = datos.estantes.find((e) => e.id === estanteRecibido?.id);
    if (!estante) return;

    // Se recuerda desde dónde se miraba, para volver ahí
    if (idInterior === null) {
        vistaGeneral = {
            posicion: camara.position.clone(),
            objetivo: controles.target.clone(),
        };
    }

    idInterior = estante.id;
    idSeleccionado = estante.id;

    avisarInterior(
        "Arrastrá una prenda a otra sección del estante para moverla.",
        "info",
    );
    enviarSinUbicar();
    dibujar(); // Con idInterior definido, solo se dibuja este estante

    // Distancia a la que entra todo el estante en pantalla
    const altura = altoDeEstante(estante);
    const alturaVisible = Math.max(
        altura * 1.4,
        (estante.ancho * 1.3) / camara.aspect,
    );
    const distancia =
        alturaVisible / (2 * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2))) +
        estante.alto / 2;

    const centro = new THREE.Vector3(
        estante.posicion_x + estante.ancho / 2,
        altura / 2,
        estante.posicion_y + estante.alto / 2,
    );

    moverCamara(
        new THREE.Vector3(centro.x, centro.y + altura * 0.15, centro.z + distancia),
        centro,
    );
}

function salirInterior() {
    if (idInterior === null) return;

    idInterior = null;
    dibujar(); // Vuelven a aparecer todos los estantes y la zona "Sin ubicar"

    if (vistaGeneral) {
        moverCamara(vistaGeneral.posicion, vistaGeneral.objetivo);
        vistaGeneral = null;
    }
}

// ------------------------------------------------------------
// Dibujo del mundo 3D
// ------------------------------------------------------------

// Tamaño del suelo: lo suficiente para que entren todos los estantes y la zona "Sin ubicar"
function medidasSuelo() {
    const finX = Math.max(
        medidas.ancho_mapa ?? 900,
        ...datos.estantes.map((e) => e.posicion_x + e.ancho),
    );
    const finZ = Math.max(
        medidas.limite_inferior ?? 420,
        ...datos.estantes.map((e) => e.posicion_y + e.alto),
    );

    return {
        ancho: finX + 40,
        zonaZ: finZ + 40, // Donde empieza la zona "Sin ubicar"
        profundidad: finZ + 40 + 120,
    };
}

function dibujar() {
    limpiarMundo();
    interactivos = [];
    ranuras = [];
    ranuraResaltada = null;
    arrastre = null;
    baseSinUbicar = null;
    controles.enabled = true;
    grupos = new Map();

    const { ancho, zonaZ, profundidad } = medidasSuelo();
    const enfoque = idInterior !== null;

    // Suelo y grilla
    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(ancho, profundidad),
        new THREE.MeshStandardMaterial({ color: 0xf3f4f6 }),
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.set(ancho / 2, 0, profundidad / 2);
    suelo.receiveShadow = true;
    mundo.add(suelo);
    mundo.add(crearGrilla(ancho, profundidad, 20));

    datos.estantes.forEach((estante) => {
        // Dentro de un estante solo se dibuja ese: los demás no tapan la vista
        if (enfoque && estante.id !== idInterior) return;
        mundo.add(crearEstante(estante));
    });

    if (!enfoque) {
        mundo.add(crearZonaSinUbicar(ancho, zonaZ));
    }

    pintarSeleccion();
    avisarResultado();
}

// Grilla de líneas finas sobre el suelo
function crearGrilla(ancho, profundidad, paso) {
    const puntos = [];
    for (let x = 0; x <= ancho; x += paso) {
        puntos.push(x, 0.3, 0, x, 0.3, profundidad);
    }
    for (let z = 0; z <= profundidad; z += paso) {
        puntos.push(0, 0.3, z, ancho, 0.3, z);
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(puntos, 3),
    );
    return new THREE.LineSegments(
        geometria,
        new THREE.LineBasicMaterial({ color: 0xe5e7eb }),
    );
}

// Mismos colores que la leyenda del 2D
function colorDeEstante(estante) {
    if (estante.ocupados === 0) return COLOR_VACIO;
    if (estante.ocupados >= estante.capacidad) return COLOR_LLENO;
    if (estante.ocupados / estante.capacidad >= 0.75) return COLOR_CASI_LLENO;
    return COLOR_CON_ESPACIO;
}

function altoDeEstante(estante) {
    const filas = Math.ceil(estante.capacidad / estante.por_fila);
    return filas * ALTURA_FILA + GROSOR_TABLERO;
}

// Un estante real: tableros, postes, panel trasero, divisores (una sección por casillero)
// y las prendas guardadas adentro
function crearEstante(estante) {
    const grupo = new THREE.Group();
    const columnas = estante.por_fila;
    const filas = Math.ceil(estante.capacidad / columnas);
    const altura = altoDeEstante(estante);
    const ancho = estante.ancho;
    const fondo = estante.alto; // El "alto" del 2D es la profundidad en 3D

    const hayFiltro = filtroActivo();
    const hayCoincidencia = estante.productos.some((p) =>
        coincideConFiltro(p, filtro),
    );
    const apagado = hayFiltro && !hayCoincidencia;

    // El estante se acomoda al centro de su rectángulo del 2D
    grupo.position.set(
        estante.posicion_x + ancho / 2,
        0,
        estante.posicion_y + fondo / 2,
    );

    // Placa bajo el estante: azul si está seleccionado; verde o roja al arrastrar algo encima
    const placa = new THREE.Mesh(
        new THREE.PlaneGeometry(ancho + 18, fondo + 18),
        new THREE.MeshBasicMaterial({ color: COLOR_SELECCION }),
    );
    placa.rotation.x = -Math.PI / 2;
    placa.position.y = 0.6;
    placa.visible = false;
    grupo.add(placa);

    // Materiales del mueble (se apagan si hay búsqueda y no coincide ninguna prenda)
    const opciones = { transparent: apagado, opacity: apagado ? 0.3 : 1 };
    const madera = new THREE.MeshStandardMaterial({ color: 0xb08968, ...opciones });
    const metal = new THREE.MeshStandardMaterial({ color: 0x6b7280, ...opciones });
    const fondoPanel = new THREE.MeshStandardMaterial({ color: 0xe7d8c9, ...opciones });

    // Agrega una pieza del mueble (todas se pueden clickear para seleccionar el estante)
    const agregarPieza = (w, h, p, x, y, z, material) => {
        const pieza = new THREE.Mesh(new THREE.BoxGeometry(w, h, p), material);
        pieza.position.set(x, y, z);
        pieza.castShadow = true;
        pieza.receiveShadow = true;
        pieza.userData = { tipo: "estante", id: estante.id };
        grupo.add(pieza);
        interactivos.push(pieza);
    };

    // Tableros: uno por debajo de cada fila y uno arriba de todo
    for (let i = 0; i <= filas; i++) {
        agregarPieza(
            ancho, GROSOR_TABLERO, fondo,
            0, i * ALTURA_FILA + GROSOR_TABLERO / 2, 0,
            madera,
        );
    }

    // Cuatro postes en las esquinas
    [-1, 1].forEach((ladoX) => {
        [-1, 1].forEach((ladoZ) => {
            agregarPieza(
                GROSOR_POSTE, altura, GROSOR_POSTE,
                ladoX * (ancho / 2 - GROSOR_POSTE / 2),
                altura / 2,
                ladoZ * (fondo / 2 - GROSOR_POSTE / 2),
                metal,
            );
        });
    });

    // Panel trasero
    agregarPieza(ancho, altura, 2, 0, altura / 2, -fondo / 2 + 1, fondoPanel);

    // Divisores verticales: forman una sección (casillero) por cada prenda posible
    const anchoUtil = ancho - 2 * GROSOR_POSTE;
    const celdaX = anchoUtil / columnas;
    const altoSeccion = ALTURA_FILA - GROSOR_TABLERO;

    // Altura (centro) de cada fila; la fila 0 es la de arriba, como en el 2D
    const alturaDeFila = (fila) =>
        (filas - 1 - fila) * ALTURA_FILA + GROSOR_TABLERO + altoSeccion / 2;

    for (let fila = 0; fila < filas; fila++) {
        for (let columna = 1; columna < columnas; columna++) {
            agregarPieza(
                2, altoSeccion, fondo * 0.9,
                -anchoUtil / 2 + columna * celdaX,
                alturaDeFila(fila),
                0,
                madera,
            );
        }
    }

    // Prendas dentro de su casillero
    const lado = Math.min(celdaX * 0.8, altoSeccion - 8, fondo * 0.7);

    estante.productos.forEach((producto, indice) => {
        const numero = producto.casillero ?? indice;
        const columna = numero % columnas;
        const fila = Math.floor(numero / columnas);

        const caja = crearPrenda(producto, lado, estante.id);
        caja.position.set(
            -anchoUtil / 2 + (columna + 0.5) * celdaX,
            alturaDeFila(fila) - altoSeccion / 2 + lado / 2 + 0.5,
            0,
        );
        grupo.add(caja);
    });

    // Si es el estante abierto, se agregan los casilleros donde se puede soltar una prenda
    if (estante.id === idInterior) {
        for (let numero = 0; numero < estante.capacidad; numero++) {
            const columna = numero % columnas;
            const fila = Math.floor(numero / columnas);

            const ranura = new THREE.Mesh(
                new THREE.PlaneGeometry(celdaX - 4, altoSeccion - 2),
                new THREE.MeshBasicMaterial({
                    color: 0x22c55e,
                    transparent: true,
                    opacity: 0,
                    depthWrite: false,
                }),
            );
            ranura.position.set(
                -anchoUtil / 2 + (columna + 0.5) * celdaX,
                alturaDeFila(fila),
                fondo / 2 + 0.5,
            );
            ranura.userData = { tipo: "ranura", idEstante: estante.id, numero };
            grupo.add(ranura);
            ranuras.push(ranura);
        }
    }

    // Barra de capacidad sobre el estante
    const barra = crearBarraCapacidad(
        estante.nombre,
        estante.ocupados,
        estante.capacidad,
        colorDeEstante(estante),
    );
    barra.position.set(0, altura + 30, 0);
    grupo.add(barra);

    grupo.userData = { placa, fondo };
    grupos.set(estante.id, grupo);

    return grupo;
}

// Una prenda es un cubo con su foto (o gris si no tiene imagen)
function crearPrenda(producto, lado, idEstante) {
    const coincide = coincideConFiltro(producto, filtro);
    const hayFiltro = filtroActivo();

    const material = new THREE.MeshStandardMaterial({
        color: producto.imagen_url ? 0xffffff : 0xd1d5db,
        map: producto.imagen_url ? obtenerTextura(producto.imagen_url) : null,
        transparent: hayFiltro && !coincide,
        opacity: hayFiltro && !coincide ? 0.25 : 1,
        emissive: hayFiltro && coincide ? COLOR_COINCIDENCIA : 0x000000,
        emissiveIntensity: hayFiltro && coincide ? 0.5 : 0,
    });

    const profundidad = idEstante === null ? lado : lado * 0.8;
    const caja = new THREE.Mesh(
        new THREE.BoxGeometry(lado, lado, profundidad),
        material,
    );
    caja.castShadow = true;
    caja.userData = { tipo: "producto", producto, idEstante };
    interactivos.push(caja);

    return caja;
}

// Zona "Sin ubicar": una plataforma naranja con las prendas que no tienen estante
function crearZonaSinUbicar(ancho, zonaZ) {
    const grupo = new THREE.Group();
    const profundidad = 100;

    const base = new THREE.Mesh(
        new THREE.BoxGeometry(ancho - 40, 6, profundidad),
        new THREE.MeshStandardMaterial({ color: COLOR_ZONA }),
    );
    base.position.set(ancho / 2, 3, zonaZ + profundidad / 2 + 10);
    base.receiveShadow = true;
    base.userData = { tipo: "zona" }; // También sirve como destino al arrastrar una prenda
    grupo.add(base);
    interactivos.push(base);
    baseSinUbicar = base;

    const etiqueta = crearEtiqueta(
        "Sin ubicar",
        `${datos.sin_ubicar.length} prendas`,
    );
    etiqueta.position.set(100, 50, zonaZ + profundidad / 2 + 10);
    grupo.add(etiqueta);

    const lado = 40;
    const celda = 52;
    const columnas = Math.max(1, Math.floor((ancho - 120) / celda));

    datos.sin_ubicar.forEach((producto, indice) => {
        const caja = crearPrenda(producto, lado, null);
        caja.position.set(
            170 + (indice % columnas) * celda,
            6 + lado / 2,
            zonaZ + 30 + Math.floor(indice / columnas) * celda,
        );
        grupo.add(caja);
    });

    return grupo;
}

// Cartel con el nombre del estante y una barra de capacidad (verde, amarilla o roja según el estado)
function crearBarraCapacidad(nombre, ocupados, capacidad, color) {
    const lienzoTexto = document.createElement("canvas");
    lienzoTexto.width = 512;
    lienzoTexto.height = 160;
    const c = lienzoTexto.getContext("2d");

    c.fillStyle = "rgba(17, 24, 39, 0.88)";
    c.beginPath();
    c.roundRect(0, 0, 512, 160, 28);
    c.fill();

    // Nombre a la izquierda y "ocupados / capacidad" a la derecha
    c.fillStyle = "#ffffff";
    c.textAlign = "left";
    c.font = "bold 46px sans-serif";
    c.fillText(nombre, 28, 62);

    c.fillStyle = "#d1d5db";
    c.textAlign = "right";
    c.font = "bold 40px sans-serif";
    c.fillText(`${ocupados} / ${capacidad}`, 484, 62);

    // Pista gris y relleno de color proporcional a la ocupación
    c.fillStyle = "#374151";
    c.beginPath();
    c.roundRect(28, 92, 456, 38, 19);
    c.fill();

    const proporcion = capacidad > 0 ? Math.min(1, ocupados / capacidad) : 0;
    if (proporcion > 0) {
        c.fillStyle = "#" + color.toString(16).padStart(6, "0");
        c.beginPath();
        c.roundRect(28, 92, Math.max(38, 456 * proporcion), 38, 19);
        c.fill();
    }

    const textura = new THREE.CanvasTexture(lienzoTexto);
    textura.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura }));
    sprite.scale.set(120, 37.5, 1);

    return sprite;
}

// Cartel de texto que siempre mira a la cámara (se dibuja en un canvas 2D y se usa como textura)
function crearEtiqueta(titulo, subtitulo) {
    const lienzoTexto = document.createElement("canvas");
    lienzoTexto.width = 512;
    lienzoTexto.height = 128;
    const c = lienzoTexto.getContext("2d");

    c.fillStyle = "rgba(17, 24, 39, 0.85)";
    c.beginPath();
    c.roundRect(0, 0, 512, 128, 24);
    c.fill();

    c.fillStyle = "#ffffff";
    c.textAlign = "center";
    c.font = "bold 52px sans-serif";
    c.fillText(titulo, 256, 62);
    c.fillStyle = "#d1d5db";
    c.font = "34px sans-serif";
    c.fillText(subtitulo, 256, 108);

    const textura = new THREE.CanvasTexture(lienzoTexto);
    textura.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura }));
    sprite.scale.set(110, 27.5, 1);

    return sprite;
}

// Carga cada imagen una sola vez
function obtenerTextura(url) {
    if (!texturas.has(url)) {
        const textura = cargadorTexturas.load(url);
        textura.colorSpace = THREE.SRGBColorSpace;
        texturas.set(url, textura);
    }
    return texturas.get(url);
}

// Antes de redibujar se libera la memoria de lo anterior (las texturas de imágenes se conservan)
function limpiarMundo() {
    for (const hijo of [...mundo.children]) {
        hijo.traverse((objeto) => {
            objeto.geometry?.dispose();

            if (objeto.isSprite) {
                objeto.material.map?.dispose();
            }
            if (objeto.material) {
                [].concat(objeto.material).forEach((m) => m.dispose());
            }
        });
        mundo.remove(hijo);
    }
}

// ------------------------------------------------------------
// Selección y búsqueda
// ------------------------------------------------------------

// Deja todo en su estado normal: solo el estante seleccionado muestra su placa azul
function pintarSeleccion() {
    grupos.forEach((grupo, id) => {
        grupo.userData.placa.visible = id === idSeleccionado;
        grupo.userData.placa.material.color.setHex(COLOR_SELECCION);
    });

    if (baseSinUbicar) {
        baseSinUbicar.material.color.setHex(COLOR_ZONA);
    }
}

function filtroActivo() {
    return filtro.texto.trim() !== "" || filtro.categoria !== "";
}

// Cuenta las coincidencias y se las avisa a la página (igual que en el 2D)
function avisarResultado() {
    let coincidencias = 0;
    let estantesConCoincidencia = 0;

    datos.estantes.forEach((estante) => {
        const cantidad = estante.productos.filter((p) =>
            coincideConFiltro(p, filtro),
        ).length;
        coincidencias += cantidad;
        if (cantidad > 0) estantesConCoincidencia++;
    });

    const enSinUbicar = datos.sin_ubicar.filter((p) =>
        coincideConFiltro(p, filtro),
    ).length;
    coincidencias += enSinUbicar;

    window.dispatchEvent(
        new CustomEvent("filtro-resultado", {
            detail: {
                activo: filtroActivo(),
                coincidencias,
                estantes: estantesConCoincidencia,
                sinUbicar: enSinUbicar,
            },
        }),
    );
}

// ------------------------------------------------------------
// Mouse: qué hay bajo el puntero
// ------------------------------------------------------------

// Apunta el rayo hacia donde está el mouse
function actualizarRayo(evento) {
    const caja = lienzo.getBoundingClientRect();
    puntero.x = ((evento.clientX - caja.left) / caja.width) * 2 - 1;
    puntero.y = -((evento.clientY - caja.top) / caja.height) * 2 + 1;
    rayo.setFromCamera(puntero, camara);
}

function objetoBajoPuntero(evento) {
    actualizarRayo(evento);
    const impactos = rayo.intersectObjects(interactivos, false);

    return impactos.length > 0 ? impactos[0].object : null;
}

// El casillero que está bajo el puntero (solo existen en el estante abierto)
function ranuraBajoPuntero() {
    const impactos = rayo.intersectObjects(ranuras, false);

    return impactos.length > 0 ? impactos[0].object : null;
}

// El estante o la zona "Sin ubicar" que hay bajo el puntero (sin contar la prenda que se arrastra)
function destinoBajoPuntero(prendaArrastrada) {
    const candidatos = interactivos.filter(
        (objeto) =>
            objeto !== prendaArrastrada &&
            (objeto.userData.tipo === "estante" || objeto.userData.tipo === "zona"),
    );
    const impactos = rayo.intersectObjects(candidatos, false);

    return impactos.length > 0 ? impactos[0].object.userData : null;
}

// ------------------------------------------------------------
// Arrastres con el mouse
// ------------------------------------------------------------
function alPresionar(evento) {
    inicioClick = { x: evento.clientX, y: evento.clientY };

    if (evento.button !== 0) return;

    const objeto = objetoBajoPuntero(evento);
    if (!objeto) return;

    const info = objeto.userData;

    // Dentro de un estante: se puede arrastrar una de sus prendas a otro casillero
    if (idInterior !== null) {
        if (info.tipo === "producto" && info.idEstante === idInterior) {
            empezarArrastre(evento, {
                tipo: "interior",
                caja: objeto,
                producto: info.producto,
                origen: objeto.position.clone(),
            });
        }
        return;
    }

    // Modo edición: se arrastra el estante entero por el piso
    if (modoEdicion) {
        if (info.tipo === "estante") {
            const estante = datos.estantes.find((e) => e.id === info.id);

            actualizarRayo(evento);
            const agarre = new THREE.Vector3();
            if (!estante || !rayo.ray.intersectPlane(planoPiso, agarre)) return;

            empezarArrastre(evento, {
                tipo: "estante",
                estante,
                grupo: grupos.get(estante.id),
                agarre,
                nuevoX: estante.posicion_x,
                nuevoY: estante.posicion_y,
                valido: true,
            });
        }
        return;
    }

    // Vista general: se arrastra una prenda hacia otro estante o hacia "Sin ubicar"
    if (info.tipo === "producto") {
        empezarArrastre(evento, {
            tipo: "prenda",
            caja: objeto,
            producto: info.producto,
            idOrigen: info.idEstante,
        });
    }
}

function empezarArrastre(evento, datosArrastre) {
    evento.stopImmediatePropagation(); // La cámara no debe girar mientras se arrastra
    controles.enabled = false;
    lienzo.setPointerCapture(evento.pointerId);

    arrastre = {
        ...datosArrastre,
        inicio: { x: evento.clientX, y: evento.clientY },
        activo: false,
    };
}

function alMoverPuntero(evento) {
    if (arrastre) {
        moverArrastre(evento);
        return;
    }

    const objeto = objetoBajoPuntero(evento);

    if (!objeto) {
        lienzo.style.cursor = "grab";
        ocultarGlobo();
        return;
    }

    const info = objeto.userData;
    let texto;

    if (info.tipo === "producto") {
        lienzo.style.cursor = "grab";
        texto = textoFicha(info.producto);
    } else if (info.tipo === "zona") {
        lienzo.style.cursor = "default";
        texto = `Zona "Sin ubicar"\n${datos.sin_ubicar.length} prendas\nSoltá una prenda acá para sacarla de su estante`;
    } else {
        lienzo.style.cursor = modoEdicion ? "move" : "pointer";
        const estante = datos.estantes.find((e) => e.id === info.id);
        texto = `${estante.nombre}\n${estante.ocupados} de ${estante.capacidad} casilleros ocupados`;
    }

    const caja = lienzo.getBoundingClientRect();
    mostrarGlobo(texto, evento.clientX - caja.left, evento.clientY - caja.top);
}

function moverArrastre(evento) {
    if (!arrastre.activo) {
        // Hasta moverse unos píxeles, se considera un click y no un arrastre
        const distancia = Math.hypot(
            evento.clientX - arrastre.inicio.x,
            evento.clientY - arrastre.inicio.y,
        );
        if (distancia < 5) return;

        arrastre.activo = true;
        ocultarGlobo();
        lienzo.style.cursor = "grabbing";

        // La prenda sale de su estante y pasa a "flotar" libre sobre el mundo
        if (arrastre.tipo === "prenda") {
            mundo.attach(arrastre.caja);
        }
    }

    actualizarRayo(evento);

    if (arrastre.tipo === "interior") {
        moverPrendaInterior();
    } else if (arrastre.tipo === "prenda") {
        moverPrendaMapa();
    } else {
        moverEstante();
    }
}

// ----- Interior: la prenda sigue al mouse y se ilumina el casillero de destino -----
function moverPrendaInterior() {
    const grupo = grupos.get(idInterior);
    const frente = grupo.localToWorld(
        new THREE.Vector3(0, 0, grupo.userData.fondo / 2 + 12),
    );
    planoArrastre.set(new THREE.Vector3(0, 0, 1), -frente.z);

    if (rayo.ray.intersectPlane(planoArrastre, puntoArrastre)) {
        arrastre.caja.position.copy(grupo.worldToLocal(puntoArrastre.clone()));
    }

    const ranura = ranuraBajoPuntero();
    resaltarRanura(ranura, ranura ? colorDeRanura(ranura, true) : null);
}

// ----- Vista general: la prenda sigue al mouse y se ilumina el estante de destino -----
function moverPrendaMapa() {
    if (rayo.ray.intersectPlane(planoAltura, puntoArrastre)) {
        arrastre.caja.position.copy(puntoArrastre);
    }

    pintarSeleccion(); // Limpia el resaltado anterior
    const destino = destinoBajoPuntero(arrastre.caja);

    if (destino?.tipo === "estante") {
        const estante = datos.estantes.find((e) => e.id === destino.id);
        const lleno = estante.ocupados >= estante.capacidad;
        const mismo = destino.id === arrastre.idOrigen;
        const placa = grupos.get(destino.id).userData.placa;

        placa.visible = true;
        placa.material.color.setHex(
            mismo ? COLOR_SELECCION : lleno ? COLOR_LLENO : COLOR_CON_ESPACIO,
        );
    } else if (destino?.tipo === "zona" && baseSinUbicar) {
        baseSinUbicar.material.color.setHex(
            arrastre.idOrigen === null ? COLOR_ZONA : COLOR_ZONA_ACTIVA,
        );
    }
}

// ----- Modo edición: el estante se desliza por el piso, pegado a la grilla de 20 -----
function moverEstante() {
    if (!rayo.ray.intersectPlane(planoPiso, puntoArrastre)) return;

    const estante = arrastre.estante;
    const grilla = medidas.grilla ?? 20;
    const maxX = Math.max(0, (medidas.ancho_mapa ?? 900) - estante.ancho);
    const maxY = Math.max(0, (medidas.limite_inferior ?? 420) - estante.alto);

    const ajustar = (valor, maximo) =>
        Math.min(maximo, Math.max(0, Math.round(valor / grilla) * grilla));

    const x = ajustar(
        estante.posicion_x + (puntoArrastre.x - arrastre.agarre.x),
        maxX,
    );
    const y = ajustar(
        estante.posicion_y + (puntoArrastre.z - arrastre.agarre.z),
        maxY,
    );

    arrastre.nuevoX = x;
    arrastre.nuevoY = y;
    arrastre.grupo.position.set(x + estante.ancho / 2, 0, y + estante.alto / 2);

    // Verde si el lugar está libre; rojo si pisa a otro estante
    arrastre.valido = !datos.estantes.some(
        (otro) =>
            otro.id !== estante.id &&
            sePisan(x, y, estante.ancho, estante.alto, otro),
    );

    const placa = arrastre.grupo.userData.placa;
    placa.visible = true;
    placa.material.color.setHex(arrastre.valido ? COLOR_CON_ESPACIO : COLOR_LLENO);
}

// Misma regla que usa el servidor para detectar choques
function sePisan(x, y, ancho, alto, otro) {
    return (
        x < otro.posicion_x + otro.ancho &&
        x + ancho > otro.posicion_x &&
        y < otro.posicion_y + otro.alto &&
        y + alto > otro.posicion_y
    );
}

function alSoltar(evento) {
    if (arrastre) {
        const actual = arrastre;
        arrastre = null;
        controles.enabled = true;

        if (actual.activo) {
            actualizarRayo(evento);
            lienzo.style.cursor = "grab";
            inicioClick = null;

            if (actual.tipo === "interior") {
                soltarEnInterior(actual);
            } else if (actual.tipo === "prenda") {
                soltarPrendaEnMapa(actual);
            } else {
                soltarEstante(actual);
            }
            return;
        }
        // Si no se movió, fue un click común: sigue abajo
    }

    if (!inicioClick) return;

    const distancia = Math.hypot(
        evento.clientX - inicioClick.x,
        evento.clientY - inicioClick.y,
    );
    inicioClick = null;

    // Si arrastró, el usuario estaba girando la cámara: no cuenta como click
    if (distancia < 5 && evento.button === 0) {
        alHacerClick(evento);
    }
}

function soltarEnInterior(actual) {
    const ranura = ranuraBajoPuntero();

    resaltarRanura(null);

    // La prenda vuelve a su lugar; si el servidor acepta el cambio, el redibujado la acomoda
    actual.caja.position.copy(actual.origen);

    if (ranura && ranura.userData.numero !== actual.producto.casillero) {
        moverACasillero(actual.producto, ranura.userData.numero);
    }
}

function soltarPrendaEnMapa(actual) {
    const destino = destinoBajoPuntero(actual.caja);

    dibujar(); // Todo vuelve a su lugar; si el servidor acepta, se recarga con la prenda ya movida

    if (!destino) return;

    if (destino.tipo === "estante" && destino.id !== actual.idOrigen) {
        moverDeEstante(actual.producto, destino.id);
    } else if (destino.tipo === "zona" && actual.idOrigen !== null) {
        moverDeEstante(actual.producto, null);
    }
}

function soltarEstante(actual) {
    const estante = actual.estante;

    if (!actual.valido) {
        dibujar();
        avisar("El estante no puede pisar a otro.", "error");
        return;
    }

    if (
        actual.nuevoX === estante.posicion_x &&
        actual.nuevoY === estante.posicion_y
    ) {
        dibujar();
        return;
    }

    guardarPosicionEstante(estante, actual.nuevoX, actual.nuevoY);
}

// Un click sobre un estante (o una prenda que está en él) lo selecciona
function alHacerClick(evento) {
    const objeto = objetoBajoPuntero(evento);
    if (!objeto) return;

    const info = objeto.userData;
    if (info.tipo === "zona") return;

    const idEstante = info.tipo === "estante" ? info.id : info.idEstante;

    if (idEstante !== null) {
        const estante = datos.estantes.find((e) => e.id === idEstante);
        if (estante) {
            window.dispatchEvent(
                new CustomEvent("estante-seleccionado", { detail: estante }),
            );
        }
    }
}

// Doble click sobre una prenda: abre su ficha (stock, proveedores, editar)
function alHacerDobleClick(evento) {
    const objeto = objetoBajoPuntero(evento);

    if (objeto?.userData.tipo === "producto") {
        window.dispatchEvent(
            new CustomEvent("abrir-ficha", { detail: objeto.userData.producto }),
        );
    }
}

// ------------------------------------------------------------
// Peticiones al servidor
// ------------------------------------------------------------

// Mueve una prenda a otro estante (idEstante = null la deja "sin ubicar").
// El servidor elige el primer casillero libre.
async function moverDeEstante(producto, idEstante) {
    try {
        const url = contenedor.dataset.urlMover.replace("__ID__", producto.id);
        const respuesta = await axios.patch(url, { estante_id: idEstante });

        avisar(respuesta.data.mensaje + " ✔", "ok");
        window.dispatchEvent(new CustomEvent("inventario-actualizado"));
    } catch (error) {
        avisar(
            error.response?.data?.mensaje ?? "No se pudo mover la prenda.",
            "error",
        );
    }
}

// Guarda la nueva posición de un estante (el tamaño no cambia)
async function guardarPosicionEstante(estante, x, y) {
    try {
        const url = contenedor.dataset.urlGeometria.replace("__ID__", estante.id);
        const respuesta = await axios.patch(url, {
            posicion_x: x,
            posicion_y: y,
            ancho: estante.ancho,
            alto: estante.alto,
        });

        avisar(respuesta.data.mensaje + " ✔", "ok");
        window.dispatchEvent(new CustomEvent("inventario-actualizado"));
    } catch (error) {
        dibujar();
        avisar(
            error.response?.data?.mensaje ?? "No se pudo mover el estante.",
            "error",
        );
    }
}

// ------------------------------------------------------------
// Casilleros del estante abierto: resaltado y movimientos al servidor
// ------------------------------------------------------------

// Verde = libre · naranja = se intercambian · rojo = ocupado (no se puede soltar ahí)
function colorDeRanura(ranura, moviendoDentro) {
    const estante = datos.estantes.find((e) => e.id === idInterior);
    const ocupante = estante?.productos.find(
        (p) => p.casillero === ranura.userData.numero,
    );

    if (!ocupante) return 0x22c55e;

    return moviendoDentro ? 0xf59e0b : 0xef4444;
}

function resaltarRanura(ranura, color) {
    if (ranuraResaltada && ranuraResaltada !== ranura) {
        ranuraResaltada.material.opacity = 0;
    }

    ranuraResaltada = ranura ?? null;

    if (ranura) {
        ranura.material.color.setHex(color);
        ranura.material.opacity = 0.45;
    }
}

// Mover una prenda a otro casillero del mismo estante (si está ocupado, se intercambian)
async function moverACasillero(producto, numero) {
    try {
        const url = contenedor.dataset.urlCasillero.replace("__ID__", producto.id);
        const respuesta = await axios.patch(url, { casillero: numero });

        avisarInterior(respuesta.data.mensaje + " ✔", "ok");
        window.dispatchEvent(new CustomEvent("inventario-actualizado"));
    } catch (error) {
        avisarInterior(
            error.response?.data?.mensaje ?? "No se pudo mover la prenda.",
            "error",
        );
    }
}

// Mientras se arrastra una prenda de la lista "Sin ubicar" por encima del estante
function alArrastrarSobreEstante(evento) {
    if (idInterior === null) return;

    evento.preventDefault(); // Sin esto el navegador no permite soltar
    evento.dataTransfer.dropEffect = "copy";

    actualizarRayo(evento);
    const ranura = ranuraBajoPuntero();
    resaltarRanura(ranura, ranura ? colorDeRanura(ranura, false) : null);
}

// Se soltó una prenda de la lista "Sin ubicar" sobre un casillero
async function soltarPrendaNueva(evento) {
    if (idInterior === null) return;

    evento.preventDefault();
    resaltarRanura(null);

    let producto;
    try {
        producto = JSON.parse(evento.dataTransfer.getData("application/json"));
    } catch (error) {
        return;
    }

    actualizarRayo(evento);
    const ranura = ranuraBajoPuntero();

    if (!ranura) {
        avisarInterior("Soltá la prenda sobre una sección del estante.", "error");
        return;
    }

    try {
        const url = contenedor.dataset.urlUbicar.replace("__ID__", producto.id);
        const respuesta = await axios.patch(url, {
            estante_id: idInterior,
            casillero: ranura.userData.numero,
        });

        avisarInterior(respuesta.data.mensaje + " ✔", "ok");
        window.dispatchEvent(
            new CustomEvent("prenda-ubicada", {
                detail: { id: producto.id, ocupados: respuesta.data.ocupados },
            }),
        );
    } catch (error) {
        avisarInterior(
            error.response?.data?.mensaje ?? "No se pudo ubicar la prenda.",
            "error",
        );
    }
}

// ------------------------------------------------------------
// Globo de información (un div HTML que sigue al mouse)
// ------------------------------------------------------------
function crearGlobo() {
    globo = document.createElement("div");
    globo.className =
        "absolute pointer-events-none px-3 py-2 rounded-lg bg-gray-900/90 text-white text-xs leading-5 whitespace-pre-line z-10";
    globo.style.display = "none";
    contenedor.appendChild(globo);
}

function mostrarGlobo(texto, x, y) {
    globo.textContent = texto;
    globo.style.display = "block";

    // Se acomoda para que no se salga del mapa por la derecha
    const ancho = globo.offsetWidth;
    const izquierda = Math.min(x + 14, contenedor.clientWidth - ancho - 8);
    globo.style.left = Math.max(8, izquierda) + "px";
    globo.style.top = y + 16 + "px";
}

function ocultarGlobo() {
    globo.style.display = "none";
}

// Mensaje bajo el mapa (lo muestra la página con Alpine)
function avisar(mensaje, tipo) {
    window.dispatchEvent(
        new CustomEvent("mapa-estado", { detail: { mensaje, tipo } }),
    );
}

// Mensaje de la barra del estante abierto
function avisarInterior(mensaje, tipo) {
    window.dispatchEvent(
        new CustomEvent("interior-estado", { detail: { mensaje, tipo } }),
    );
}