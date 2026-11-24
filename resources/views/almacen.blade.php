@extends('layouts.principal')

@section('titulo', 'Almacén')

@section('contenido')
    {{--
    Todo el estado y el comportamiento de la página viven en resources/js/almacen/pagina.js ("almacen").
    Las direcciones del servidor se leen desde estos atributos data-.
    --}}
    <div x-data="almacen" data-url-stock="{{ route('productos.stock', ['producto' => '__ID__']) }}"
        data-url-crear="{{ route('productos.guardar') }}"
        data-url-producto="{{ route('productos.actualizar', ['producto' => '__ID__']) }}"
        data-url-proveedores="{{ route('productos.proveedores', ['producto' => '__ID__']) }}"
        data-url-proveedor-quitar="{{ route('productos.proveedores.desvincular', ['producto' => '__ID__', 'proveedor' => '__PROV__']) }}"
        data-url-estante="{{ route('estantes.actualizar', ['estante' => '__ID__']) }}"
        data-url-estante-nuevo="{{ route('estantes.guardar') }}">

        {{-- Cabecera --}}
        <div class="flex flex-wrap items-start gap-3 mb-4">
            {{-- flex-1 hace que el texto ocupe solo el espacio sobrante y se acomode en varias líneas --}}
            <div class="flex-1 min-w-64">
                <h1 class="text-2xl font-bold mb-1">Almacén</h1>
                 <p class="text-gray-600">
                    Arrastrá una prenda a otro estante o a la plataforma "Sin ubicar" para moverla. Girá el almacén
                    arrastrando el piso y acercá con la rueda. Pasá el mouse sobre una prenda para ver su código y
                    precio, y hacé doble clic para abrir su ficha.
                </p>
            </div>

            {{-- ml-auto empuja los botones a la derecha, incluso si bajan a otra línea en pantallas chicas --}}
            @can("administrar")
                <div class="ml-auto flex flex-wrap gap-2">
                    <button @click="alternarEdicion()" :class="modoEdicion
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                        : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'"
                        class="px-4 py-2 rounded-lg whitespace-nowrap"
                        x-text="modoEdicion ? 'Salir del modo edición' : 'Editar mapa'"></button>

                    <button @click="abrirFormulario()"
                        class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg whitespace-nowrap">
                        + Nuevo producto
                    </button>
                </div>
            @endcan
        </div>

        {{-- Aviso del modo edición --}}
        <div x-show="modoEdicion" x-cloak
            class="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
            <strong>Modo edición.</strong>
            Arrastrá un estante por el piso para moverlo (se acomoda a una grilla de 20 y no puede pisar a otro).
            Elegí un estante para editar su nombre, capacidad o prendas por fila, o eliminarlo.
            En el panel lateral podés crear estantes nuevos.
        </div>

        {{-- md:flex-row: el panel lateral queda al costado desde 768 px de ancho (con las herramientas
        del navegador abiertas la ventana suele ser más angosta que 1024 px) --}}
        <div class="flex flex-col md:flex-row gap-4">

            {{-- Zona del mapa --}}
            <div class="flex-1 min-w-0 bg-white rounded-lg shadow overflow-hidden">

                {{-- Barra de búsqueda y filtro --}}
                <div class="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100">
                    <input type="search" x-model="busqueda" @input.debounce.250ms="filtrar()"
                        placeholder="Buscar por nombre o código..."
                        class="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">

                    <select x-model="categoria" @change="filtrar()"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                        <option value="">Todas las categorías</option>
                        <template x-for="nombre in categorias" :key="nombre">
                            <option :value="nombre" x-text="nombre"></option>
                        </template>
                    </select>

                    <button x-show="busqueda !== '' || categoria !== ''" @click="limpiar()"
                        class="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                        Limpiar
                    </button>

                    {{-- Contador de resultados (solo aparece si hay búsqueda) --}}
                    <p x-show="resultado.activo" x-text="textoResultado()" class="w-full text-sm text-gray-600"></p>
                </div>

                {{-- Aquí Three.js dibuja el almacén en 3D. data-medidas lleva la grilla y los límites del modo edición --}}
                <div id="mapa-almacen" data-url="{{ route('almacen.estantes') }}"
                    data-url-mover="{{ route('productos.mover', ['producto' => '__ID__']) }}"
                    data-url-geometria="{{ route('estantes.geometria', ['estante' => '__ID__']) }}"
                    data-url-casillero="{{ route('productos.casillero', ['producto' => '__ID__']) }}"
                    data-url-ubicar="{{ route('productos.ubicar', ['producto' => '__ID__']) }}"
                    data-medidas="{{ json_encode($medidas) }}" class="w-full"></div>

                                    {{-- Barra del interior: aparece al abrir un estante --}}
                <div x-show="modalAbierto" x-cloak class="border-t border-gray-100 p-3 bg-blue-50">
                    <div class="flex items-center justify-between gap-3 mb-1">
                        <h2 class="font-semibold"
                            x-text="estante ? 'Interior de ' + estante.nombre + ' (' + estante.ocupados + ' / ' + estante.capacidad + ')' : ''">
                        </h2>
                        <button @click="cerrar()"
                            class="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            ← Volver al almacén
                        </button>
                    </div>

                    <p class="text-xs text-gray-500 mb-2">
                        Arrastrá una prenda a otra sección para moverla (si está ocupada, se intercambian).
                        Para ubicar una prenda sin estante, arrastrala desde acá hasta una sección libre.
                    </p>

                    <p class="text-sm font-medium mb-1">Sin ubicar (<span x-text="sinUbicar.length"></span>)</p>
                    <p x-show="sinUbicar.length === 0" class="text-sm text-gray-500">Todas las prendas están ubicadas.</p>

                    <ul class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        <template x-for="producto in sinUbicar" :key="producto.id">
                            <li draggable="true" @dragstart="empezarArrastre($event, producto)"
                                class="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg cursor-grab hover:bg-blue-100">
                                <img x-show="producto.imagen_url" :src="producto.imagen_url" draggable="false"
                                    class="w-10 h-10 object-contain" alt="">
                                <div x-show="!producto.imagen_url" class="w-10 h-10 bg-gray-300 rounded"></div>
                                <div class="min-w-0 text-xs">
                                    <p class="font-semibold truncate max-w-32" x-text="producto.nombre"></p>
                                    <p class="text-gray-500" x-text="producto.talle + ' · ' + producto.color"></p>
                                </div>
                            </li>
                        </template>
                    </ul>

                    <p class="mt-2 text-sm min-h-5" x-text="estado.mensaje" :class="{
                                'text-green-600': estado.tipo === 'ok',
                                'text-red-600': estado.tipo === 'error',
                                'text-gray-500': estado.tipo === 'info'
                            }"></p>
                </div>

                {{-- Mensajes del mapa (movimientos correctos o rechazados) --}}
                <p class="px-4 py-2 text-sm min-h-9 border-t border-gray-100" x-text="estadoMapa.mensaje" :class="{
                    'text-green-600': estadoMapa.tipo === 'ok',
                    'text-red-600': estadoMapa.tipo === 'error',
                    'text-gray-500': estadoMapa.tipo === 'info'
                }"></p>
            </div>

            {{-- Panel lateral --}}
            <aside class="md:w-72 md:shrink-0 space-y-4">

                {{-- Información del estante seleccionado --}}
                <div class="bg-white rounded-lg shadow p-4">
                    <h2 class="font-semibold mb-2">Estante seleccionado</h2>
                    <p x-show="!estante" class="text-sm text-gray-500">Ninguno todavía.</p>

                    <div x-show="estante" class="space-y-1 text-sm">
                        <p class="text-lg font-bold" x-text="estante?.nombre"></p>
                        <p>Ocupación: <span x-text="estante?.ocupados"></span> de <span x-text="estante?.capacidad"></span>
                            productos</p>
                        <p>Espacio libre: <span x-text="estante ? estante.capacidad - estante.ocupados : ''"></span></p>

                        <button @click="abrir()"
                            class="mt-3 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                            Abrir estante
                        </button>
                    </div>
                </div>

                {{-- Panel del modo edición --}}
                <div x-show="modoEdicion" x-cloak
                    class="bg-white rounded-lg shadow p-4 space-y-5 border-2 border-amber-300">

                    {{-- Estante nuevo --}}
                    <div>
                        <h2 class="font-semibold mb-2">Estante nuevo</h2>

                        <div class="space-y-2 text-sm">
                            <div>
                                <label class="block font-medium mb-1">Nombre</label>
                                <input type="text" x-model="nuevo.nombre" placeholder="Ej: Estante F"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresNuevo, 'nombre')"></p>
                            </div>

                            <div class="flex gap-2">
                                <div class="flex-1">
                                    <label class="block font-medium mb-1">Capacidad</label>
                                    <input type="number" min="1" max="{{ $limites['capacidad'] }}"
                                        x-model.number="nuevo.capacidad"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                    <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresNuevo, 'capacidad')">
                                    </p>
                                </div>
                                <div class="flex-1">
                                    <label class="block font-medium mb-1">Por fila</label>
                                    <input type="number" min="1" max="{{ $limites['por_fila'] }}"
                                        x-model.number="nuevo.por_fila"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                    <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresNuevo, 'por_fila')"></p>
                                </div>
                            </div>

                            <p class="text-xs text-red-600" x-text="primerError(erroresNuevo, 'general')"></p>

                            <button @click="crearEstante()" :disabled="guardandoEstante"
                                class="w-full px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg">
                                Crear estante
                            </button>
                        </div>
                    </div>

                    {{-- Editar el estante seleccionado --}}
                    <div x-show="estante" class="border-t border-gray-200 pt-4">
                        <h2 class="font-semibold mb-2">Editar <span x-text="estante?.nombre"></span></h2>

                        <div class="space-y-2 text-sm">
                            <div>
                                <label class="block font-medium mb-1">Nombre</label>
                                <input type="text" x-model="edicion.nombre"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresEstante, 'nombre')"></p>
                            </div>

                            <div class="flex gap-2">
                                <div class="flex-1">
                                    <label class="block font-medium mb-1">Capacidad</label>
                                    <input type="number" min="1" max="{{ $limites['capacidad'] }}"
                                        x-model.number="edicion.capacidad"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                    <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresEstante, 'capacidad')">
                                    </p>
                                </div>
                                <div class="flex-1">
                                    <label class="block font-medium mb-1">Por fila</label>
                                    <input type="number" min="1" max="{{ $limites['por_fila'] }}"
                                        x-model.number="edicion.por_fila"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400">
                                    <p class="text-xs text-red-600 mt-1" x-text="primerError(erroresEstante, 'por_fila')">
                                    </p>
                                </div>
                            </div>

                            <p class="text-xs text-red-600" x-text="primerError(erroresEstante, 'general')"></p>

                            <div class="flex gap-2">
                                <button @click="guardarCambiosEstante()" :disabled="guardandoEstante"
                                    class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
                                    Guardar cambios
                                </button>
                                <button @click="eliminarEstante()"
                                    class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {{-- Leyenda de colores --}}
                <div class="bg-white rounded-lg shadow p-4">
                    <h2 class="font-semibold mb-2">Leyenda</h2>
                    <ul class="space-y-2 text-sm">
                        <li class="flex items-center gap-2"><span
                                class="w-4 h-4 rounded bg-gray-200 border-2 border-gray-400"></span> Vacío</li>
                        <li class="flex items-center gap-2"><span
                                class="w-4 h-4 rounded bg-green-200 border-2 border-green-600"></span> Con espacio</li>
                        <li class="flex items-center gap-2"><span
                                class="w-4 h-4 rounded bg-yellow-200 border-2 border-yellow-600"></span> Casi lleno (75% o
                            más)</li>
                        <li class="flex items-center gap-2"><span
                                class="w-4 h-4 rounded bg-red-200 border-2 border-red-600"></span> Lleno</li>
                    </ul>
                </div>
            </aside>
        </div>

        {{-- ================= Ventana: producto nuevo ================= --}}
        <div x-show="formularioAbierto" x-cloak @click.self="cerrarFormulario()"
            class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5 my-auto">

                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-xl font-bold" x-text="editandoId ? 'Editar producto' : 'Nuevo producto'"></h2>
                    <button @click="cerrarFormulario()" class="text-gray-500 hover:text-gray-800 text-2xl leading-none"
                        title="Cerrar">&times;</button>
                </div>

                <form @submit.prevent="guardarProducto()" class="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium mb-1">Nombre</label>
                        <input type="text" x-model="formulario.nombre" placeholder="Ej: Remera básica"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('nombre')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Categoría</label>
                        <select x-model="formulario.categoria"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Elige una categoría</option>
                            @foreach ($categorias as $nombreCategoria)
                                <option value="{{ $nombreCategoria }}">{{ $nombreCategoria }}</option>
                            @endforeach
                        </select>
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('categoria')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Talle</label>
                        <input type="text" x-model="formulario.talle" placeholder="Ej: M, 42, Único"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('talle')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Color</label>
                        <input type="text" x-model="formulario.color" placeholder="Ej: Negro"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('color')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Precio</label>
                        <input type="number" min="0" step="0.01" x-model="formulario.precio" placeholder="Ej: 12500"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('precio')"></p>
                    </div>

                    <div x-show="!editandoId">
                        <label class="block text-sm font-medium mb-1">Cantidad inicial</label>
                        <input type="number" min="0" x-model.number="formulario.cantidad"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('cantidad')"></p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium mb-1">Código <span
                                class="text-gray-400 font-normal">(opcional)</span></label>
                        <input type="text" x-model="formulario.codigo" placeholder="Se genera solo, ej: REM-NEG-M"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('codigo')"></p>
                    </div>

                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium mb-1">Imagen <span
                                class="text-gray-400 font-normal">(opcional, PNG, JPG o WEBP de hasta 2 MB)</span></label>

                        <div class="flex items-center gap-3">
                            <input type="file" accept="image/png,image/jpeg,image/webp" @change="elegirImagen($event)"
                                class="flex-1 text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200">

                            {{-- Vista previa de la imagen elegida --}}
                            <img x-show="vistaPrevia" :src="vistaPrevia" alt="Vista previa"
                                class="w-16 h-16 object-contain rounded border border-gray-200">
                        </div>
                        <p class="text-xs text-red-600 mt-1" x-text="errorDe('imagen')"></p>
                    </div>

                    <p class="sm:col-span-2 text-sm text-red-600" x-text="errorDe('general')"></p>

                    <div class="sm:col-span-2 flex justify-end gap-2 mt-2">
                        <button type="button" @click="cerrarFormulario()"
                            class="px-4 py-2 text-gray-600 hover:text-gray-900">
                            Cancelar
                        </button>
                        <button type="submit" :disabled="guardando"
                            class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg">
                            <span
                                x-text="guardando ? 'Guardando...' : (editandoId ? 'Guardar cambios' : 'Crear producto')"></span>
                        </button>
                    </div>
                </form>

                <p x-show="!editandoId" class="text-xs text-gray-500 mt-3">El producto nuevo aparece en la zona "Sin ubicar"
                    del mapa, listo para
                    arrastrarlo a un estante.</p>
            </div>
        </div>
    </div>
@endsection

{{-- Scripts de esta página: el mapa y el estante ampliado --}}
@push('scripts')
    @vite(['resources/js/almacen/mapa3d.js'])
@endpush