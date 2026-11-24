import { formatearPrecio } from './utilidades.js';

// Texto que muestra el globo al pasar el mouse sobre una prenda
export function textoFicha(producto) {
    return [
        producto.nombre,
        `Código: ${producto.codigo}`,
        `Talle ${producto.talle} · ${producto.color}`,
        `Precio: ${formatearPrecio(producto.precio)}`,
        `Stock: ${producto.cantidad}`,
    ].join('\n');
}

// ------------------------------------------------------------
// Búsqueda y filtro
// ------------------------------------------------------------

// Pasa a minúsculas y quita las tildes, para que "Camísa" y "camisa" coincidan.
// normalize('NFD') separa cada letra de su tilde, y el replace borra las tildes sueltas.
export function normalizar(texto) {
    return String(texto ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// ¿La prenda coincide con el texto (en nombre o código) y con la categoría elegida?
// "filtro" tiene la forma { texto: 'jean', categoria: 'Pantalones' }
export function coincideConFiltro(producto, filtro) {
    const texto = normalizar(filtro.texto).trim();

    const coincideTexto = texto === ''
        || normalizar(producto.nombre).includes(texto)
        || normalizar(producto.codigo).includes(texto);

    const coincideCategoria = filtro.categoria === ''
        || producto.categoria === filtro.categoria;

    return coincideTexto && coincideCategoria;
}