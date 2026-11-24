<?php

use App\Http\Controllers\AlmacenController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EstanteController;
use App\Http\Controllers\PanelController;
use App\Http\Controllers\ProductoController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ProductoProveedorController;
use App\Http\Controllers\ProveedorController;
use App\Http\Controllers\MovimientoController;

// ---------- Ingreso y salida ----------
Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'mostrarLogin'])->name('login');
    // throttle:5,1 = máximo 5 intentos por minuto (frena los intentos de adivinar contraseñas)
    Route::post('/login', [AuthController::class, 'ingresar'])->middleware('throttle:5,1')->name('login.ingresar');
});

Route::post('/logout', [AuthController::class, 'salir'])->middleware('auth')->name('logout');

// ---------- Todo lo demás requiere haber iniciado sesión ----------
Route::middleware('auth')->group(function () {

    Route::get('/', [PanelController::class, 'mostrar'])->name('panel');
    Route::get('/almacen', [AlmacenController::class, 'mostrar'])->name('almacen');
    // Proveedores de un producto (lectura, la usa la ficha)
    Route::get('/productos/{producto}/proveedores', [ProductoProveedorController::class, 'listar'])->name('productos.proveedores');
    // Historial de movimientos de stock
    Route::get('/movimientos', [MovimientoController::class, 'listar'])->name('movimientos.listar');

    // Datos en JSON que consulta el JavaScript
    Route::get('/almacen/estantes', [AlmacenController::class, 'listarEstantes'])->name('almacen.estantes');
    Route::get('/almacen/estantes/{estante}/productos', [AlmacenController::class, 'listarProductos'])->name('almacen.productos');
    Route::get('/almacen/productos/sin-ubicar', [AlmacenController::class, 'listarSinUbicar'])->name('almacen.sin-ubicar');

    // Operario y administrador: stock y movimiento de prendas
    Route::patch('/productos/{producto}/stock', [ProductoController::class, 'ajustarStock'])->name('productos.stock');
    Route::patch('/productos/{producto}/casillero', [ProductoController::class, 'moverACasillero'])->name('productos.casillero');
    Route::patch('/productos/{producto}/ubicar', [ProductoController::class, 'ubicarEnEstante'])->name('productos.ubicar');
    Route::patch('/productos/{producto}/mover', [ProductoController::class, 'mover'])->name('productos.mover');

    // Solo administrador: crear/editar/eliminar productos y editar el mapa de estantes
    Route::middleware('rol:administrador')->group(function () {
        Route::post('/productos', [ProductoController::class, 'guardar'])->name('productos.guardar');
        Route::patch('/productos/{producto}', [ProductoController::class, 'actualizar'])->name('productos.actualizar');
        Route::delete('/productos/{producto}', [ProductoController::class, 'eliminar'])->name('productos.eliminar');

        Route::post('/estantes', [EstanteController::class, 'guardar'])->name('estantes.guardar');
        Route::patch('/estantes/{estante}', [EstanteController::class, 'actualizar'])->name('estantes.actualizar');
        Route::delete('/estantes/{estante}', [EstanteController::class, 'eliminar'])->name('estantes.eliminar');
        Route::patch('/estantes/{estante}/geometria', [EstanteController::class, 'reubicar'])->name('estantes.geometria');

        // Proveedores (ABM) y vínculos con productos (attach / detach)
        Route::get('/proveedores', [ProveedorController::class, 'listar'])->name('proveedores.listar');
        Route::post('/proveedores', [ProveedorController::class, 'guardar'])->name('proveedores.guardar');
        Route::get('/proveedores/{proveedor}/editar', [ProveedorController::class, 'editar'])->name('proveedores.editar');
        Route::put('/proveedores/{proveedor}', [ProveedorController::class, 'actualizar'])->name('proveedores.actualizar');
        Route::delete('/proveedores/{proveedor}', [ProveedorController::class, 'eliminar'])->name('proveedores.eliminar');

        Route::post('/productos/{producto}/proveedores', [ProductoProveedorController::class, 'vincular'])->name('productos.proveedores.vincular');
        Route::delete('/productos/{producto}/proveedores/{proveedor}', [ProductoProveedorController::class, 'desvincular'])->name('productos.proveedores.desvincular');
    });
});