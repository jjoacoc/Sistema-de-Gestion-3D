<?php

namespace App\Http\Controllers;

use App\Models\Producto;
use App\Models\Proveedor;
use Illuminate\Http\Request;

class ProductoProveedorController extends Controller
{
    // Proveedores de un producto, con los datos de la tabla intermedia
    public function listar(Producto $producto)
    {
        return response()->json($this->formatear($producto));
    }

    // attach: vincula un proveedor al producto
    public function vincular(Request $solicitud, Producto $producto)
    {
        $datos = $solicitud->validate([
            'proveedor_id'     => ['required', 'exists:proveedores,id'],
            'precio_costo'     => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'codigo_proveedor' => ['nullable', 'string', 'max:40'],
        ], [
            'proveedor_id.required' => 'Elegí un proveedor.',
            'proveedor_id.exists'   => 'Ese proveedor no existe.',
            'precio_costo.required' => 'Escribí el precio de costo.',
            'precio_costo.numeric'  => 'El precio de costo debe ser un número.',
            'precio_costo.min'      => 'El precio de costo no puede ser negativo.',
        ]);

        if ($producto->proveedores()->where('proveedores.id', $datos['proveedor_id'])->exists()) {
            return response()->json(['mensaje' => 'Ese proveedor ya está vinculado a la prenda.'], 422);
        }

        $producto->proveedores()->attach($datos['proveedor_id'], [
            'precio_costo'     => $datos['precio_costo'],
            'codigo_proveedor' => $datos['codigo_proveedor'] ?? null,
        ]);

        return response()->json([
            'mensaje'      => 'Proveedor vinculado.',
            'proveedores'  => $this->formatear($producto),
        ], 201);
    }

    // detach: quita el vínculo (no borra al proveedor ni al producto)
    public function desvincular(Producto $producto, Proveedor $proveedor)
    {
        $producto->proveedores()->detach($proveedor->id);

        return response()->json([
            'mensaje'      => 'Proveedor desvinculado.',
            'proveedores'  => $this->formatear($producto),
        ]);
    }

    private function formatear(Producto $producto): array
    {
        return $producto->proveedores()->orderBy('nombre')->get()->map(fn ($proveedor) => [
            'id'               => $proveedor->id,
            'nombre'           => $proveedor->nombre,
            'precio_costo'     => $proveedor->pivot->precio_costo,
            'codigo_proveedor' => $proveedor->pivot->codigo_proveedor,
        ])->all();
    }
}