<?php

namespace Database\Seeders;

use App\Models\Producto;
use App\Models\User;
use Illuminate\Database\Seeder;

class MovimientoSeeder extends Seeder
{
    // Deja un historial coherente: el stock inicial de cada prenda, más una salida de ejemplo
    public function run(): void
    {
        $administrador = User::where('rol', User::ROL_ADMINISTRADOR)->first();
        $operario = User::where('rol', User::ROL_OPERARIO)->first();

        foreach (Producto::all() as $producto) {
            // Entrada con el stock inicial
            $producto->movimientos()->create([
                'user_id'          => $administrador?->id,
                'tipo'             => 'entrada',
                'cantidad'         => $producto->cantidad,
                'stock_resultante' => $producto->cantidad,
                'motivo'           => 'Stock inicial',
                'created_at'       => now()->subDays(7),
                'updated_at'       => now()->subDays(7),
            ]);
        }

        // Algunas salidas de ejemplo hechas por el operario (se descuentan del stock real)
        foreach (Producto::where('cantidad', '>', 3)->take(5)->get() as $producto) {
            $producto->decrement('cantidad', 2);

            $producto->movimientos()->create([
                'user_id'          => $operario?->id,
                'tipo'             => 'salida',
                'cantidad'         => 2,
                'stock_resultante' => $producto->cantidad,
                'created_at'       => now()->subDays(2),
                'updated_at'       => now()->subDays(2),
            ]);
        }
    }
}