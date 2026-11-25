import { formatearPrecio } from "./utilidades.js";

// Un formulario de producto vacío (valores iniciales)
function formularioVacio() {
    return {
        nombre: "",
        categoria: "",
        talle: "",
        color: "",
        precio: "",
        cantidad: 1,
        codigo: "",
        imagen: null,
    };
}

// Componente de Alpine para la página del almacén.
// En la vista se usa con x-data="almacen".
export default function almacen() {
    return {
        // ---------- Estante seleccionado y estante ampliado ----------
        estante: null,
        modalAbierto: false,
        estado: { mensaje: "", tipo: "info" }, // Mensaje bajo el estante ampliado
        sinUbicar: [], // Prendas del panel "Sin ubicar"
        estadoMapa: { mensaje: "", tipo: "info" }, // Mensaje bajo el mapa

        // ---------- Búsqueda y filtro ----------
        busqueda: "",
        categoria: "",
        categorias: [],
        resultado: {
            activo: false,
            coincidencias: 0,
            estantes: 0,
            sinUbicar: 0,
        },

        // ---------- Ficha de una prenda (para manejar el stock) ----------
        ficha: null,
        cantidadMovimiento: 1,
        estadoFicha: { mensaje: "", tipo: "info" },
        proveedoresFicha: [], // Proveedores de la prenda abierta en la ficha
        vinculo: { proveedor_id: "", precio_costo: "", codigo_proveedor: "" },
        vinculoAbierto: false, // ¿Está desplegado el formulario "Agregar proveedor"?
        // ---------- Visor 3D de la prenda ----------
        visorAbierto: false,
        visorGiro: true, // ¿Está activado el giro automático?
        formatearPrecio, // Para usarla en la vista (viene de utilidades.js)

        // ---------- Formulario de producto nuevo ----------
        formularioAbierto: false,
        editandoId: null, // null = creando un producto; un id = editando ese producto
        formulario: formularioVacio(),
        errores: {},
        guardando: false,
        vistaPrevia: null,
        // ---------- Modo edición de estantes ----------
        modoEdicion: false,
        nuevo: { nombre: "", capacidad: 6, por_fila: 3 }, // Formulario "Estante nuevo"
        edicion: { nombre: "", capacidad: 1, por_fila: 5 }, // Formulario "Editar estante seleccionado"
        erroresNuevo: {},
        erroresEstante: {},
        guardandoEstante: false,

        // ----------------------------------------------------------
        // Alpine ejecuta init() solo, al iniciar el componente.
        // Aquí escuchamos los avisos que mandan mapa.js e interior.js.
        // ----------------------------------------------------------
        init() {
            window.addEventListener("estante-seleccionado", (evento) => {
                this.estante = evento.detail;
                this.cargarEdicion();
            });
            window.addEventListener("interior-estado", (evento) => {
                this.estado = evento.detail;
            });
            window.addEventListener("mapa-estado", (evento) => {
                this.estadoMapa = evento.detail;
            });
            window.addEventListener("sin-ubicar-cargadas", (evento) => {
                this.sinUbicar = evento.detail;
            });
            window.addEventListener("prenda-ubicada", (evento) => {
                this.marcarUbicada(evento.detail);
            });
            window.addEventListener("categorias-cargadas", (evento) => {
                this.categorias = evento.detail;
            });
            window.addEventListener("filtro-resultado", (evento) => {
                this.resultado = evento.detail;
            });
            window.addEventListener("abrir-ficha", (evento) => {
                this.abrirFicha(evento.detail);
            });
            // Doble clic sobre un estante del mapa 3D: se selecciona y se abre
            window.addEventListener("solicitar-abrir-estante", (evento) => {
                this.estante = evento.detail;
                this.cargarEdicion();
                this.abrir();
            });
            // El visor avisa si el giro automático se apagó (al agarrar la prenda con el mouse)
            window.addEventListener("visor-giro-cambiado", (evento) => {
                this.visorGiro = evento.detail;
            });

            // Tecla Esc: cierra lo que esté más arriba
            window.addEventListener("keydown", (evento) => {
                if (evento.key !== "Escape") return;

                if (this.visorAbierto) {
                    this.cerrarVisor();
                } else if (this.formularioAbierto) {
                    this.cerrarFormulario();
                } else if (this.ficha) {
                    this.cerrarFicha();
                } else if (this.modalAbierto) {
                    this.cerrar();
                }
            });
        },

        // ---------- Estante ampliado ----------
        abrir() {
            this.estado = { mensaje: "", tipo: "info" };
            this.sinUbicar = [];
            this.modalAbierto = true;

            // $nextTick espera a que el modal sea visible y avisa al mapa 3D para que acerque la cámara al estante
            this.$nextTick(() => this.$dispatch("abrir-estante", this.estante));
        },

        cerrar() {
            this.modalAbierto = false;
            this.$dispatch("cerrar-estante");
        },

        // Al empezar a arrastrar una prenda del panel, sus datos viajan dentro del arrastre
        empezarArrastre(evento, producto) {
            evento.dataTransfer.setData(
                "application/json",
                JSON.stringify(producto),
            );
            evento.dataTransfer.effectAllowed = "copy";
        },

        // Una prenda se ubicó con éxito: la sacamos de la lista y actualizamos el contador
        marcarUbicada(detalle) {
            this.sinUbicar = this.sinUbicar.filter(
                (producto) => producto.id !== detalle.id,
            );

            if (this.estante) {
                this.estante.ocupados = detalle.ocupados;
            }
        },

        // ---------- Búsqueda y filtro ----------
        filtrar() {
            this.$dispatch("filtro-cambiado", {
                texto: this.busqueda,
                categoria: this.categoria,
            });
        },

        limpiar() {
            this.busqueda = "";
            this.categoria = "";
            this.filtrar();
        },

        textoResultado() {
            const r = this.resultado;

            if (!r.activo) return "";
            if (r.coincidencias === 0)
                return "Ninguna prenda coincide con la búsqueda.";

            let texto =
                r.coincidencias +
                (r.coincidencias === 1
                    ? " prenda encontrada"
                    : " prendas encontradas");
            texto +=
                " · " +
                r.estantes +
                (r.estantes === 1 ? " estante" : " estantes");
            if (r.sinUbicar > 0) texto += " · " + r.sinUbicar + " sin ubicar";

            return texto;
        },

        // ---------- Ficha de la prenda y stock ----------
        abrirFicha(producto) {
            this.ficha = { ...producto }; // Una copia, para no modificar el original
            this.vinculoAbierto = false;
            this.cantidadMovimiento = 1;
            this.estadoFicha = { mensaje: "", tipo: "info" };
            this.proveedoresFicha = [];
            this.vinculo = {
                proveedor_id: "",
                precio_costo: "",
                codigo_proveedor: "",
            };
            this.cargarProveedoresFicha();
        },

        cerrarFicha() {
            this.ficha = null;
        },

        precioFicha() {
            return this.ficha ? formatearPrecio(this.ficha.precio) : "";
        },

        // tipo: 'entrada' (suma) o 'salida' (resta)
        async ajustarStock(tipo) {
            const cantidad = parseInt(this.cantidadMovimiento, 10);

            if (!Number.isInteger(cantidad) || cantidad < 1) {
                this.estadoFicha = {
                    mensaje: "Ingresa una cantidad de 1 o más.",
                    tipo: "error",
                };
                return;
            }

            try {
                const url = this.$root.dataset.urlStock.replace(
                    "__ID__",
                    this.ficha.id,
                );
                const respuesta = await window.axios.patch(url, {
                    tipo: tipo,
                    cantidad: cantidad,
                });

                this.ficha.cantidad = respuesta.data.cantidad;
                this.estadoFicha = {
                    mensaje: respuesta.data.mensaje,
                    tipo: "ok",
                };

                // Avisamos al mapa y al estante ampliado que el inventario cambió
                window.dispatchEvent(new CustomEvent("inventario-actualizado"));
            } catch (error) {
                this.estadoFicha = {
                    mensaje:
                        error.response?.data?.mensaje ??
                        "No se pudo actualizar el stock.",
                    tipo: "error",
                };
            }
        },

        // ---------- Formulario de producto nuevo ----------
        abrirFormulario() {
            this.quitarVistaPrevia();
            this.editandoId = null;
            this.formulario = formularioVacio();
            this.errores = {};
            this.formularioAbierto = true;
        },

        // Abre el mismo formulario, cargado con los datos de la prenda de la ficha
        abrirEdicionProducto() {
            if (!this.ficha) return;

            this.quitarVistaPrevia();
            this.editandoId = this.ficha.id;
            this.formulario = {
                nombre: this.ficha.nombre,
                categoria: this.ficha.categoria,
                talle: this.ficha.talle,
                color: this.ficha.color,
                precio: this.ficha.precio,
                cantidad: this.ficha.cantidad, // Solo informativo: al editar no se envía
                codigo: this.ficha.codigo,
                imagen: null,
            };
            // Si ya tenía imagen, se muestra como vista previa (no se vuelve a subir)
            this.vistaPrevia = this.ficha.imagen_url ?? null;
            this.errores = {};
            this.cerrarFicha();
            this.formularioAbierto = true;
        },

        cerrarFormulario() {
            this.formularioAbierto = false;
            this.quitarVistaPrevia();
            this.editandoId = null;
        },

        // El usuario eligió un archivo de imagen
        elegirImagen(evento) {
            const archivo = evento.target.files[0] ?? null;

            // Comprobación rápida en el navegador (el servidor la repite)
            if (archivo && archivo.size > 2 * 1024 * 1024) {
                this.errores = {
                    imagen: ["La imagen no puede pesar más de 2 MB."],
                };
                evento.target.value = "";
                return;
            }

            this.quitarVistaPrevia();
            this.formulario.imagen = archivo;
            this.vistaPrevia = archivo ? URL.createObjectURL(archivo) : null;
        },

        // Libera la memoria de la vista previa anterior
        quitarVistaPrevia() {
            if (this.vistaPrevia && this.vistaPrevia.startsWith("blob:")) {
                URL.revokeObjectURL(this.vistaPrevia);
            }
            this.vistaPrevia = null;
        },

        // Primer mensaje de error de un campo (o vacío si no hay)
        errorDe(campo) {
            return this.errores[campo]?.[0] ?? "";
        },

        // Crea un producto nuevo o guarda los cambios de uno existente
        async guardarProducto() {
            this.errores = {};
            this.guardando = true;

            const editando = this.editandoId !== null;

            // FormData es la forma de enviar texto y archivos juntos
            const datos = new FormData();
            Object.entries(this.formulario).forEach(([campo, valor]) => {
                if (valor === null || valor === "") return;
                if (editando && campo === "cantidad") return; // El stock se maneja con entradas y salidas
                datos.append(campo, valor);
            });

            // Un archivo no viaja en un PATCH real: se envía por POST y Laravel lo trata como PATCH
            let url = this.$root.dataset.urlCrear;
            if (editando) {
                datos.append("_method", "PATCH");
                url = this.$root.dataset.urlProducto.replace(
                    "__ID__",
                    this.editandoId,
                );
            }

            try {
                const respuesta = await window.axios.post(url, datos);

                this.estadoMapa = {
                    mensaje: respuesta.data.mensaje + " ✔",
                    tipo: "ok",
                };
                this.cerrarFormulario();

                window.dispatchEvent(new CustomEvent("inventario-actualizado"));
            } catch (error) {
                if (error.response?.status === 422) {
                    // Errores de validación: { campo: ['mensaje', ...] }
                    this.errores = error.response.data.errors ?? {};
                } else {
                    this.errores = {
                        general: [
                            "No se pudo crear el producto. Intenta de nuevo.",
                        ],
                    };
                }
            } finally {
                this.guardando = false;
            }
        },

        // Pide al servidor los proveedores de la prenda de la ficha
        async cargarProveedoresFicha() {
            if (!this.ficha) return;

            try {
                const url = this.$root.dataset.urlProveedores.replace(
                    "__ID__",
                    this.ficha.id,
                );
                const respuesta = await window.axios.get(url);
                this.proveedoresFicha = respuesta.data;
            } catch (error) {
                this.proveedoresFicha = [];
            }
        },

        // attach: vincula el proveedor elegido a la prenda
        async vincularProveedor() {
            if (!this.ficha) return;

            try {
                const url = this.$root.dataset.urlProveedores.replace(
                    "__ID__",
                    this.ficha.id,
                );
                const respuesta = await window.axios.post(url, this.vinculo);

                this.proveedoresFicha = respuesta.data.proveedores;
                this.vinculo = {
                    proveedor_id: "",
                    precio_costo: "",
                    codigo_proveedor: "",
                };
                this.vinculoAbierto = false;
                this.estadoFicha = {
                    mensaje: respuesta.data.mensaje,
                    tipo: "ok",
                };
            } catch (error) {
                // Primer error de validación (422) o el mensaje del servidor
                const errores = error.response?.data?.errors;
                const primero = errores ? Object.values(errores)[0][0] : null;

                this.estadoFicha = {
                    mensaje:
                        primero ??
                        error.response?.data?.mensaje ??
                        "No se pudo vincular el proveedor.",
                    tipo: "error",
                };
            }
        },

        // detach: quita el vínculo con un proveedor
        async desvincularProveedor(proveedor) {
            if (!this.ficha) return;

            try {
                const url = this.$root.dataset.urlProveedorQuitar
                    .replace("__ID__", this.ficha.id)
                    .replace("__PROV__", proveedor.id);
                const respuesta = await window.axios.delete(url);

                this.proveedoresFicha = respuesta.data.proveedores;
                this.estadoFicha = {
                    mensaje: respuesta.data.mensaje,
                    tipo: "ok",
                };
            } catch (error) {
                this.estadoFicha = {
                    mensaje:
                        error.response?.data?.mensaje ??
                        "No se pudo quitar el proveedor.",
                    tipo: "error",
                };
            }
        },

        // ---------- Visor 3D de la prenda ----------
        abrirVisor() {
            if (!this.ficha) return;

            this.visorGiro = true;
            this.visorAbierto = true;

            // $nextTick espera a que la ventana sea visible para medir su tamaño
            this.$nextTick(() => this.$dispatch("abrir-visor", this.ficha));
        },

        cerrarVisor() {
            this.visorAbierto = false;
            this.$dispatch("cerrar-visor");
        },

        alternarGiro() {
            this.visorGiro = !this.visorGiro;
            this.$dispatch("visor-giro", this.visorGiro);
        },

        // Elimina la prenda que se muestra en la ficha
        async eliminarProducto() {
            if (!this.ficha) return;

            const pregunta = `¿Eliminar "${this.ficha.nombre}" (${this.ficha.codigo})? Esta acción no se puede deshacer.`;
            if (!window.confirm(pregunta)) return;

            try {
                const url = this.$root.dataset.urlProducto.replace(
                    "__ID__",
                    this.ficha.id,
                );
                const respuesta = await window.axios.delete(url);

                this.estadoMapa = {
                    mensaje: respuesta.data.mensaje + " ✔",
                    tipo: "ok",
                };
                this.cerrarFicha();

                window.dispatchEvent(new CustomEvent("inventario-actualizado"));
            } catch (error) {
                this.estadoFicha = {
                    mensaje:
                        error.response?.data?.mensaje ??
                        "No se pudo eliminar el producto.",
                    tipo: "error",
                };
            }
        },

        // ---------- Modo edición de estantes ----------

        // Activa o desactiva el modo edición y se lo avisa al mapa
        alternarEdicion() {
            this.modoEdicion = !this.modoEdicion;
            this.erroresNuevo = {};
            this.erroresEstante = {};
            this.cargarEdicion();
            this.$dispatch("modo-edicion", { activo: this.modoEdicion });
        },

        // Copia los datos del estante seleccionado al formulario de edición
        cargarEdicion() {
            if (!this.estante) return;

            this.edicion = {
                nombre: this.estante.nombre,
                capacidad: this.estante.capacidad,
                por_fila: this.estante.por_fila,
            };
            this.erroresEstante = {};
        },

        // Primer mensaje de error de un campo, dentro de un grupo de errores
        primerError(errores, campo) {
            return errores[campo]?.[0] ?? "";
        },

        // Guarda en this[destino] los errores de validación (422) o un mensaje general
        manejarErrores(error, destino) {
            if (error.response?.status === 422) {
                this[destino] = error.response.data.errors ?? {
                    general: [
                        error.response.data.mensaje ??
                            "Revisa los datos ingresados.",
                    ],
                };
            } else {
                this[destino] = {
                    general: [
                        error.response?.data?.mensaje ??
                            "No se pudo completar la acción.",
                    ],
                };
            }
        },

        // Crea un estante nuevo (el servidor elige el lugar libre del mapa)
        async crearEstante() {
            this.erroresNuevo = {};
            this.guardandoEstante = true;

            try {
                const respuesta = await window.axios.post(
                    this.$root.dataset.urlEstanteNuevo,
                    this.nuevo,
                );

                this.estadoMapa = {
                    mensaje: respuesta.data.mensaje + " ✔",
                    tipo: "ok",
                };
                this.nuevo = { nombre: "", capacidad: 6, por_fila: 3 };

                window.dispatchEvent(new CustomEvent("inventario-actualizado"));
            } catch (error) {
                this.manejarErrores(error, "erroresNuevo");
            } finally {
                this.guardandoEstante = false;
            }
        },

        // Guarda nombre, capacidad y prendas por fila del estante seleccionado
        async guardarCambiosEstante() {
            if (!this.estante) return;

            this.erroresEstante = {};
            this.guardandoEstante = true;

            try {
                const url = this.$root.dataset.urlEstante.replace(
                    "__ID__",
                    this.estante.id,
                );
                const respuesta = await window.axios.patch(url, this.edicion);

                this.estadoMapa = {
                    mensaje: respuesta.data.mensaje + " ✔",
                    tipo: "ok",
                };

                window.dispatchEvent(new CustomEvent("inventario-actualizado"));
            } catch (error) {
                this.manejarErrores(error, "erroresEstante");
            } finally {
                this.guardandoEstante = false;
            }
        },

        // Elimina el estante seleccionado (sus prendas quedan sin ubicar)
        async eliminarEstante() {
            if (!this.estante) return;

            const cantidad = this.estante.ocupados;
            const pregunta =
                cantidad > 0
                    ? `¿Eliminar ${this.estante.nombre}? Sus ${cantidad} prendas quedarán sin ubicar.`
                    : `¿Eliminar ${this.estante.nombre}?`;

            if (!window.confirm(pregunta)) return;

            try {
                const url = this.$root.dataset.urlEstante.replace(
                    "__ID__",
                    this.estante.id,
                );
                const respuesta = await window.axios.delete(url);

                this.estadoMapa = {
                    mensaje: respuesta.data.mensaje + " ✔",
                    tipo: "ok",
                };
                this.estante = null;

                window.dispatchEvent(new CustomEvent("inventario-actualizado"));
            } catch (error) {
                this.manejarErrores(error, "erroresEstante");
            }
        },
    };
}
