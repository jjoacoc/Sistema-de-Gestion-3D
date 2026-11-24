<?php

namespace App\Http\Controllers;

use App\Http\Requests\GuardarProductoRequest;
use App\Models\Estante;
use App\Models\Producto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductoController extends Controller
{
    // NUEVO: crea un producto. La validación ya ocurrió dentro de GuardarProductoRequest.
    public function guardar(GuardarProductoRequest $solicitud)
    {
        // validated() devuelve solo los campos que pasaron la validación
        $datos = $solicitud->validated();

        // Si no escribieron un código, el sistema genera uno
        if (empty($datos['codigo'])) {
            $datos['codigo'] = Producto::generarCodigo($datos['nombre'], $datos['color'], $datos['talle']);
        }

        // Si subieron una imagen, se guarda en public/imagenes/productos con un nombre propio
        if ($solicitud->hasFile('imagen')) {
            $archivo = $solicitud->file('imagen');

            // Nunca se usa el nombre original del archivo: podría repetirse o traer caracteres peligrosos
            $nombreArchivo = Str::slug($datos['codigo']) . '-' . Str::random(6) . '.' . $archivo->extension();

            $archivo->move(public_path('imagenes/productos'), $nombreArchivo);

            $datos['imagen'] = $nombreArchivo;
        }

        $producto = Producto::create($datos);
        
        // El stock con el que nace la prenda también queda registrado en el historial
        if ($producto->cantidad > 0) {
            $producto->movimientos()->create([
                'user_id' => $solicitud->user()->id,
                'tipo' => 'entrada',
                'cantidad' => $producto->cantidad,
                'stock_resultante' => $producto->cantidad,
                'motivo' => 'Stock inicial',
            ]);
        }

        // 201 = "creado"
        return response()->json([
            'mensaje' => 'Producto creado con el código ' . $producto->codigo . '.',
        ], 201);
    }

    // Edita los datos de un producto (el stock NO se toca acá: usa entradas y salidas).
    // La imagen es opcional: si no suben una nueva, se conserva la actual.
    public function actualizar(GuardarProductoRequest $solicitud, Producto $producto)
    {
        $datos = $solicitud->validated();

        // Código vacío: se conserva el actual
        if (empty($datos['codigo'])) {
            $datos['codigo'] = $producto->codigo;
        }

        if ($solicitud->hasFile('imagen')) {
            $archivo = $solicitud->file('imagen');
            $nombreArchivo = Str::slug($datos['codigo']) . '-' . Str::random(6) . '.' . $archivo->extension();
            $archivo->move(public_path('imagenes/productos'), $nombreArchivo);

            // La imagen vieja ya no sirve: se borra del disco
            $producto->borrarImagen();

            $datos['imagen'] = $nombreArchivo;
        } else {
            unset($datos['imagen']);
        }

        $producto->update($datos);

        return response()->json([
            'mensaje' => 'Producto ' . $producto->codigo . ' actualizado.',
        ]);
    }

    // Elimina un producto y su imagen. El casillero que ocupaba queda libre.
    public function eliminar(Producto $producto)
    {
        $nombre = $producto->nombre;

        $producto->borrarImagen();
        $producto->delete();

        return response()->json(['mensaje' => $nombre . ' fue eliminado.']);
    }

    // Suma (entrada) o resta (salida) unidades al stock de un producto y registra el movimiento.
    public function ajustarStock(Request $request, Producto $producto)
    {
        $datos = $request->validate([
            'tipo' => ['required', 'in:entrada,salida'],
            'cantidad' => ['required', 'integer', 'min:1', 'max:100000'],
        ]);

        $cantidad = (int) $datos['cantidad'];
        $unidades = $cantidad === 1 ? 'unidad' : 'unidades';

        // La transacción garantiza que el stock y su registro se guarden JUNTOS (o ninguno)
        $hayStock = DB::transaction(function () use ($request, $producto, $datos, $cantidad) {
            if ($datos['tipo'] === 'entrada') {
                $producto->increment('cantidad', $cantidad);
            } else {
                // Resta solo si alcanza el stock. La condición y la resta ocurren en UNA consulta SQL,
                // así dos personas restando a la vez no pueden dejar el stock en negativo.
                $filasAfectadas = Producto::where('id', $producto->id)
                    ->where('cantidad', '>=', $cantidad)
                    ->decrement('cantidad', $cantidad);

                if ($filasAfectadas === 0) {
                    return false;
                }
            }

            $producto->refresh();   // Vuelve a leer el stock ya actualizado

            // Se guarda el movimiento en el historial
            $producto->movimientos()->create([
                'user_id' => $request->user()->id,
                'tipo' => $datos['tipo'],
                'cantidad' => $cantidad,
                'stock_resultante' => $producto->cantidad,
            ]);

            return true;
        });

        if (!$hayStock) {
            $producto->refresh();

            return response()->json([
                'mensaje' => 'No hay stock suficiente: quedan ' . $producto->cantidad . ' unidades.',
            ], 422);
        }

        $mensaje = $datos['tipo'] === 'entrada'
            ? "Se sumaron $cantidad $unidades."
            : "Se restaron $cantidad $unidades.";

        return response()->json([
            'mensaje' => $mensaje,
            'cantidad' => $producto->cantidad,
        ]);
    }

    // Mueve una prenda a otro casillero del MISMO estante.
    // Si el casillero de destino ya tiene una prenda, las dos se intercambian.
    public function moverACasillero(Request $request, Producto $producto)
    {
        $datos = $request->validate([
            'casillero' => ['required', 'integer', 'min:0'],
        ]);

        $estante = $producto->estante;

        if ($estante === null) {
            return response()->json(['mensaje' => 'La prenda no está en un estante.'], 422);
        }

        if ($datos['casillero'] >= $estante->capacidad) {
            return response()->json(['mensaje' => 'Ese casillero no existe en este estante.'], 422);
        }

        // ¿Quién está hoy en el casillero de destino? (puede ser nadie)
        $ocupante = $estante->productos()
            ->where('casillero', $datos['casillero'])
            ->where('id', '!=', $producto->id)
            ->first();

        // Una transacción garantiza que se hagan TODOS los cambios o NINGUNO
        DB::transaction(function () use ($producto, $ocupante, $datos) {
            if ($ocupante) {
                $casilleroOriginal = $producto->casillero;

                // Primero se libera el casillero de la prenda que se mueve;
                // si no, la restricción "unique" de la base de datos rechazaría el intercambio
                $producto->update(['casillero' => null]);
                $ocupante->update(['casillero' => $casilleroOriginal]);
            }

            $producto->update(['casillero' => $datos['casillero']]);
        });

        return response()->json([
            'mensaje' => $ocupante
                ? 'Se intercambió con ' . $ocupante->nombre . '.'
                : 'Posición guardada',
        ]);
    }

    // Asigna una prenda sin ubicar a un casillero LIBRE de un estante
    // (se usa cuando la sueltas desde el panel "Sin ubicar" dentro del estante ampliado).
    public function ubicarEnEstante(Request $request, Producto $producto)
    {
        $datos = $request->validate([
            'estante_id' => ['required', 'exists:estantes,id'],
            'casillero' => ['required', 'integer', 'min:0'],
        ]);

        if ($producto->estante_id !== null) {
            return response()->json(['mensaje' => 'Esta prenda ya está en un estante.'], 422);
        }

        $estante = Estante::findOrFail($datos['estante_id']);

        if ($estante->productos()->count() >= $estante->capacidad) {
            return response()->json(['mensaje' => 'El estante está lleno.'], 422);
        }

        if ($datos['casillero'] >= $estante->capacidad) {
            return response()->json(['mensaje' => 'Ese casillero no existe en este estante.'], 422);
        }

        if ($estante->productos()->where('casillero', $datos['casillero'])->exists()) {
            return response()->json(['mensaje' => 'Ese casillero ya está ocupado.'], 422);
        }

        $producto->update($datos);

        return response()->json([
            'mensaje' => 'Prenda ubicada en ' . $estante->nombre,
            'ocupados' => $estante->productos()->count(),
        ]);
    }

    // Mueve una prenda a otro estante (arrastre en el mapa principal),
    // o la deja sin ubicar si no se indica estante.
    // El casillero lo elige el servidor: el primero que esté libre.
    public function mover(Request $request, Producto $producto)
    {
        $datos = $request->validate([
            'estante_id' => ['nullable', 'exists:estantes,id'],
        ]);

        // Sin estante de destino: la prenda vuelve a "sin ubicar"
        if (empty($datos['estante_id'])) {
            $producto->update(['estante_id' => null, 'casillero' => null]);

            return response()->json(['mensaje' => $producto->nombre . ' quedó sin ubicar.']);
        }

        $destino = Estante::findOrFail($datos['estante_id']);

        if ((int) $producto->estante_id === $destino->id) {
            return response()->json(['mensaje' => 'La prenda ya está en ese estante.'], 422);
        }

        if ($destino->productos()->count() >= $destino->capacidad) {
            return response()->json(['mensaje' => $destino->nombre . ' está lleno.'], 422);
        }

        $casillero = $destino->buscarCasilleroLibre();

        if ($casillero === null) {
            return response()->json(['mensaje' => 'No hay un casillero libre en ' . $destino->nombre . '.'], 422);
        }

        $producto->update(['estante_id' => $destino->id, 'casillero' => $casillero]);

        return response()->json(['mensaje' => $producto->nombre . ' se movió a ' . $destino->nombre . '.']);
    }
}