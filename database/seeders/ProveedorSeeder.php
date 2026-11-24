<?php

namespace Database\Seeders;

use App\Models\Producto;
use App\Models\Proveedor;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ProveedorSeeder extends Seeder
{
    // Crea proveedores y vincula cada prenda con 1 o 2 de ellos (llena la tabla intermedia)
    public function run(): void
    {
        $proveedores = collect([
            ['nombre' => 'Textil Patagonia',  'email' => 'ventas@textilpatagonia.test', 'telefono' => '299-4001122'],
            ['nombre' => 'Hilos del Sur',     'email' => 'contacto@hilosdelsur.test',   'telefono' => '299-4002233'],
            ['nombre' => 'Moda Mayorista',    'email' => 'pedidos@modamayorista.test',  'telefono' => '11-45556677'],
            ['nombre' => 'Confecciones Norte', 'email' => null,                          'telefono' => '381-4223344'],
        ])->map(fn ($datos) => Proveedor::create($datos));

        foreach (Producto::all() as $producto) {
            foreach ($proveedores->random(rand(1, 2)) as $proveedor) {
                $producto->proveedores()->attach($proveedor->id, [
                    'precio_costo'     => round($producto->precio * 0.55, 2),
                    'codigo_proveedor' => Str::upper(Str::substr(Str::ascii($proveedor->nombre), 0, 3))
                        . '-' . str_pad($producto->id, 4, '0', STR_PAD_LEFT),
                ]);
            }
        }
    }
}